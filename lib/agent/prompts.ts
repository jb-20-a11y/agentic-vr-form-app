import type { FormSchema, FormField, ConversationMessage } from "@/lib/types/form";

// Returns fields in schema array order, flattening all sections.
export function getOrderedFields(schema: FormSchema): FormField[] {
  return schema.sections.flatMap((s) => s.fields);
}

// Returns the first required field that has no filled value, in schema order.
export function getNextRequiredField(
  schema: FormSchema,
  filledData: Record<string, unknown>
): FormField | null {
  return (
    getOrderedFields(schema).find(
      (f) =>
        f.required &&
        (filledData[f.id] === undefined || filledData[f.id] === "")
    ) ?? null
  );
}

// The natural-language prompt to use when asking about a field.
// Prefers the optional `question` property; falls back to the field label.
function fieldPrompt(field: FormField): string {
  return field.question ?? field.label;
}

// ─── EXTRACTION PROMPT ────────────────────────────────────────────────────────

export const EXTRACTION_JSON_INSTRUCTION = `

RESPONSE FORMAT — CRITICAL:
You must respond with a single raw JSON object and nothing else.
Do not include markdown code fences, backticks, or any text before or after the JSON.
The JSON object must have exactly these three keys:
{
  "extractedFields": { "<fieldId>": "<value>", ... },
  "confidenceScores": { "<fieldId>": <0.0-1.0>, ... },
  "fieldsToRemove": [ "fieldId", ... ]
}`;

export function buildExtractionSystemPrompt(
  schema: FormSchema,
  currentFieldId: string | null,
  filledData: Record<string, unknown>
): string {
  const allFields = getOrderedFields(schema);

  const fieldDescriptions = allFields
    .map((field) => {
      const aliases = field.aiHints?.aliases?.join(", ") || "";
      const format = field.aiHints?.expectedFormat || field.type;
      const firstPersonNote = (field.aiHints as Record<string, unknown> | undefined)?.firstPersonNote as string | undefined;
      return (
        `- "${field.id}" (${field.label}): type=${format}, required=${field.required}` +
        (aliases ? `, aliases=[${aliases}]` : "") +
        (field.options ? `, options=[${field.options.map((o) => o.value).join(", ")}]` : "") +
        (firstPersonNote ? `\n  ⚠ FIRST-PERSON NOTE: ${firstPersonNote}` : "")
      );
    })
    .join("\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return `You are an AI assistant helping a vocational rehabilitation service provider fill out a form: "${schema.title}".
Current date and time: ${dateStr} at ${timeStr}.
${schema.description ? `Form description: ${schema.description}` : ""}

IMPORTANT CONTEXT: The person submitting this form is the INSTRUCTOR/PROVIDER themselves. When they use first-person pronouns ("I", "me", "my", "we") they are referring to themselves as the instructor. Do NOT store literal first-person phrases as field values. If a field requires a proper name and the user only gave a first-person answer, do not extract that field.

Your job is ONLY to extract field values. Do NOT generate any conversational message here.

FORM FIELDS:
${fieldDescriptions}

EXTRACTION RULES:
- For "select" fields, match user input to the closest option value
- For "date" fields, normalize to YYYY-MM-DD format
- For "number" fields, extract numeric values only (e.g. "45 minutes" → 45)
- Assign confidence: 1.0 for explicit mentions, 0.7–0.9 for inferred values, 0.5–0.7 for guesses
- If a field value is ambiguous or given only in first-person, set confidence < 0.5 and omit from extractedFields
- Only extract fields you are confident about; do not hallucinate values

CORRECTION RULES:
- If the user's input implies a previously extracted value was wrong, include that field ID in "fieldsToRemove"
- Re-extract the correct value into "extractedFields" if determinable from context
- Do not include a field in both "fieldsToRemove" and "extractedFields" with the same corrected value`;
}

export function buildExtractionUserMessage(
  userInput: string,
  currentFormData: Record<string, unknown>,
  conversationHistory: ConversationMessage[]
): string {
  const filledFields = Object.entries(currentFormData)
    .filter(([, v]) => v !== undefined && v !== "")
    .map(([k, v]) => `  ${k}: ${String(v)}`)
    .join("\n");

  const historyContext =
    conversationHistory.length > 0
      ? `\nPrevious conversation:\n${conversationHistory
          .slice(-6)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}\n`
      : "";

  const inputLine = userInput.trim()
    ? `User's new input: "${userInput}"`
    : "(No user input yet — this is the opening turn. Return empty extractedFields.)";

  return `${historyContext}
Currently filled fields:
${filledFields || "  (none yet)"}

${inputLine}

Extract any form field values from the user's input and return the JSON.`;
}

// ─── NEXT-QUESTION PROMPT ─────────────────────────────────────────────────────

export function buildNextQuestionSystemPrompt(
  schema: FormSchema,
  currentFieldId: string | null,
  mergedData: Record<string, unknown>,
  extractionResult: {
    extractedFields: Record<string, string>;
    confidenceScores: Record<string, number>;
    missingRequiredFields: string[];
  }
): string {
  const allFields = getOrderedFields(schema);
  const fieldMap = new Map(allFields.map((f) => [f.id, f]));

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const currentField = currentFieldId ? fieldMap.get(currentFieldId) ?? null : null;
  const nextField = getNextRequiredField(schema, mergedData);
  const nextFieldAfterCurrent =
    nextField && currentField && nextField.id !== currentField.id
      ? nextField
      : !currentField
      ? nextField
      : null;

  // Detect if the current field was just answered
  const currentFieldJustAnswered =
    currentField &&
    mergedData[currentField.id] !== undefined &&
    mergedData[currentField.id] !== "";

  // Detect low confidence on current field
  const currentFieldConfidence = currentField
    ? (extractionResult.confidenceScores[currentField.id] ?? 1.0)
    : 1.0;
  const currentFieldNeedsClarity =
    currentField &&
    (!currentFieldJustAnswered || currentFieldConfidence < 0.6);

  let guidance: string;

  if (!currentField) {
    // Opening turn
    if (nextField) {
      guidance = `This is the opening turn. Greet the user warmly and ask the first question:
  Field: "${nextField.id}" | Prompt: "${fieldPrompt(nextField)}"
Keep it brief and natural.`;
    } else {
      guidance = `All required fields are already filled. Confirm this warmly and offer to review or change anything.`;
    }
  } else if (currentFieldNeedsClarity) {
    // Still need the current field
    guidance = `The current field "${currentField.id}" (${currentField.label}) was not clearly answered or the confidence is low.
Ask a natural follow-up question to get a complete, unambiguous answer. Do NOT advance to the next field yet.
Prompt hint: "${fieldPrompt(currentField)}"`;
  } else if (nextFieldAfterCurrent) {
    // Current field done, move to next
    const captured = mergedData[currentField.id];
    guidance = `The current field "${currentField.id}" (${currentField.label}) was just answered with: "${captured}".
In one short sentence, confirm what you captured. Then ask about the next field:
  Field: "${nextFieldAfterCurrent.id}" | Prompt: "${fieldPrompt(nextFieldAfterCurrent)}"`;
  } else {
    // All done
    guidance = `All required fields are now filled. Briefly confirm this, summarise what was just captured if applicable, and invite the user to review or correct anything.`;
  }

  return `You are an AI assistant helping a vocational rehabilitation service provider fill out a form: "${schema.title}".
Current date and time: ${dateStr} at ${timeStr}.

Your ONLY job right now is to compose the next conversational message to send to the user.
Do NOT attempt to extract or re-interpret form fields.
Do NOT output JSON.
Write in plain, warm, natural language.
Never mention field IDs or technical schema names.
Never ask about more than one new field per response.

GUIDANCE FOR THIS TURN:
${guidance}`;
}

export function buildNextQuestionUserMessage(
  userInput: string,
  extractionResult: {
    extractedFields: Record<string, string>;
    fieldsToRemove: string[];
    missingRequiredFields: string[];
  },
  conversationHistory: ConversationMessage[]
): string {
  const historyContext =
    conversationHistory.length > 0
      ? `Recent conversation:\n${conversationHistory
          .slice(-4)
          .map((m) => `${m.role}: ${m.content}`)
          .join("\n")}\n\n`
      : "";

  const justExtracted = Object.entries(extractionResult.extractedFields)
    .map(([k, v]) => `  ${k}: ${v}`)
    .join("\n");

  return `${historyContext}User just said: "${userInput}"

Fields just extracted from that input:
${justExtracted || "  (none)"}
Fields removed/corrected: ${extractionResult.fieldsToRemove.join(", ") || "(none)"}
Fields still missing: ${extractionResult.missingRequiredFields.join(", ") || "(none)"}

Now compose your next message to the user.`;
}
