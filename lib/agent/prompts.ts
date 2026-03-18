import type { FormSchema, ConversationMessage } from "@/lib/types/form";

export function buildExtractionSystemPrompt(schema: FormSchema): string {
  const fieldDescriptions = schema.sections
    .flatMap((section) =>
      section.fields.map((field) => {
        const aliases = field.aiHints?.aliases?.join(", ") || "";
        const format = field.aiHints?.expectedFormat || field.type;
        return `- "${field.id}" (${field.label}): type=${format}, required=${field.required}${aliases ? `, aliases=[${aliases}]` : ""}${field.options ? `, options=[${field.options.map((o) => o.value).join(", ")}]` : ""}`;
      })
    )
    .join("\n");

  const now = new Date();
  const dateStr = now.toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
  const timeStr = now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  return `You are an AI assistant helping a vocational rehabilitation service provider fill out a form documenting a service provided to a client: "${schema.title}".
Current date and time: ${dateStr} at ${timeStr}.
${schema.description ? `Form description: ${schema.description}` : ""}

Your job is to:
1. Extract relevant information from the user's input and map it to form fields
2. Ask follow-up questions about missing required fields
3. Provide confidence scores (0.0 to 1.0) for each extraction
4. Be conversational and helpful

FORM FIELDS:
${fieldDescriptions}

EXTRACTION RULES:
- For "select" fields, match user input to the closest option value
- For "date" fields, normalize to YYYY-MM-DD format
- For "number" fields, extract numeric values only
- Assign confidence: 1.0 for explicit mentions, 0.7-0.9 for inferred values, 0.5-0.7 for guesses
- If a field value is ambiguous, set lower confidence and ask for clarification
- Only extract fields you are confident about; do not hallucinate values

CORRECTION RULES:
- If the user's input implies a previously extracted value was assigned to the wrong field (e.g., "no, that's the client" / "I said my name, not theirs"), include the incorrectly assigned field ID in the "fieldsToRemove" array
- Re-extract the correct value into "extractedFields" if determinable from context
- Do not include a field in both "fieldsToRemove" and "extractedFields" with the same value

CONVERSATION RULES:
- Be brief and professional
- After extraction, summarize what you found
- Ask about the most important missing required fields first
- If the user provides bulk notes, extract everything possible at once`;
}

export function buildUserMessage(
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

  return `${historyContext}
Currently filled fields:
${filledFields || "  (none yet)"}

User's new input: "${userInput}"

Extract any form field values from the user's input. Return the extracted fields, confidence scores, and a helpful response message.`;
}
