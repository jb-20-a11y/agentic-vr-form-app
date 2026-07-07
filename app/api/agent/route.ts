import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { loadFormSchema } from "@/lib/schemas/loader";
import {
  buildExtractionSystemPrompt,
  buildExtractionUserMessage,
  buildNextQuestionSystemPrompt,
  buildNextQuestionUserMessage,
  getNextRequiredField,
  EXTRACTION_JSON_INSTRUCTION,
} from "@/lib/agent/prompts";
import { agentRequestSchema } from "@/lib/types/form";
import type { FormSchema } from "@/lib/types/form";

const github = createOpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_TOKEN ?? "",
});

const MODEL = github.chat("gpt-4o");

// ─── Extraction output shape ──────────────────────────────────────────────────

const extractionOutputSchema = z.object({
  extractedFields: z.record(z.string()),
  confidenceScores: z.record(z.number()),
  fieldsToRemove: z.array(z.string()).default([]),
});

type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

const JSON_INSTRUCTION = EXTRACTION_JSON_INSTRUCTION;

function parseModelJSON(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

// ─── Field value validation ───────────────────────────────────────────────────

function validateExtraction(
  extracted: Record<string, string>,
  formSchema: FormSchema
): string[] {
  const errors: string[] = [];
  const allFields = formSchema.sections.flatMap((s) => s.fields);
  const fieldMap = new Map(allFields.map((f) => [f.id, f]));

  for (const [fieldId, value] of Object.entries(extracted)) {
    if (value === undefined || value === "") continue;

    const fieldDef = fieldMap.get(fieldId);
    if (!fieldDef) {
      errors.push(`"${fieldId}" is not a valid field in this form. Do not invent field names.`);
      continue;
    }

    switch (fieldDef.type) {
      case "select": {
        const validValues = (fieldDef.options ?? []).map((o) => o.value);
        if (validValues.length > 0 && !validValues.includes(value)) {
          errors.push(
            `Field "${fieldId}" value "${value}" is not a valid option. Must be one of: ${validValues.join(", ")}`
          );
        }
        break;
      }
      case "date": {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
          errors.push(`Field "${fieldId}" must be in YYYY-MM-DD format. Got: "${value}"`);
        }
        break;
      }
      case "time": {
        if (!/^\d{2}:\d{2}$/.test(value)) {
          errors.push(`Field "${fieldId}" must be in HH:MM format. Got: "${value}"`);
        }
        break;
      }
      case "number": {
        if (isNaN(Number(value))) {
          errors.push(`Field "${fieldId}" must be a number. Got: "${value}"`);
        }
        break;
      }
      case "email": {
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
          errors.push(`Field "${fieldId}" must be a valid email address. Got: "${value}"`);
        }
        break;
      }
    }

    if (fieldDef.validation?.pattern) {
      const re = new RegExp(fieldDef.validation.pattern);
      if (!re.test(value)) {
        errors.push(`Field "${fieldId}" value "${value}" does not match the required format.`);
      }
    }
  }

  return errors;
}

// ─── Retry loop for extraction ────────────────────────────────────────────────

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const MAX_ATTEMPTS = 3;

async function runExtraction(
  systemPrompt: string,
  userMessage: string
): Promise<{ output: ExtractionOutput; validationErrors: string[] }> {
  const messages: Array<{ role: "user" | "assistant"; content: string }> = [
    { role: "user", content: userMessage },
  ];

  let lastOutput: ExtractionOutput | null = null;
  let lastErrors: string[] = [];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { text } = await generateText({
      model: MODEL,
      system: systemPrompt,
      messages,
    });

    let parsedJson: unknown;
    try {
      parsedJson = parseModelJSON(text);
    } catch {
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          "Your response was not valid JSON. Return only a raw JSON object — no markdown, no backticks, no extra text.",
      });
      continue;
    }

    const schemaResult = extractionOutputSchema.safeParse(parsedJson);
    if (!schemaResult.success) {
      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          `Your JSON was missing required keys or had wrong types:\n` +
          JSON.stringify(schemaResult.error.flatten().fieldErrors, null, 2) +
          `\nReturn the complete JSON object with all four required keys.`,
      });
      continue;
    }

    lastOutput = schemaResult.data;
    // We need formSchema for validation; it's passed in via closure through systemPrompt only.
    // Validation is done outside this helper — just break on structurally valid output.
    lastErrors = [];
    break;
  }

  if (!lastOutput) {
    throw new Error("Model returned no parseable output after retries");
  }

  return { output: lastOutput, validationErrors: lastErrors };
}

// ─── Error classification ─────────────────────────────────────────────────────

function classifyError(err: unknown): { message: string; status: number } {
  if (err && typeof err === "object") {
    const e = err as Record<string, unknown>;

    // OpenAI / GitHub Models rate limit — status 429
    const status =
      (e.status as number | undefined) ??
      (e.statusCode as number | undefined) ??
      ((e.response as Record<string, unknown> | undefined)?.status as number | undefined);

    if (status === 429) {
      // Try to surface reset time from headers or message
      const retryAfter =
        (e.headers as Record<string, string> | undefined)?.["retry-after"] ??
        (e.headers as Record<string, string> | undefined)?.["x-ratelimit-reset-requests"];

      const resetInfo = retryAfter
        ? ` You can try again in ${retryAfter} seconds.`
        : " Please wait a moment before trying again.";

      return {
        message: `Rate limit reached for the AI model.${resetInfo}`,
        status: 429,
      };
    }

    if (status === 401 || status === 403) {
      return {
        message: "Authentication error with the AI service. Please check your API key configuration.",
        status: 500,
      };
    }

    if (status === 503 || status === 502) {
      return {
        message: "The AI service is temporarily unavailable. Please try again in a moment.",
        status: 503,
      };
    }

    // Check for message containing rate-limit keywords
    const msg = String(e.message ?? "").toLowerCase();
    if (msg.includes("rate limit") || msg.includes("too many requests")) {
      return {
        message: "Rate limit reached for the AI model. Please wait a moment before trying again.",
        status: 429,
      };
    }
  }

  return { message: "Something went wrong communicating with the AI. Please try again.", status: 500 };
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const parsed = agentRequestSchema.safeParse(body);

    if (!parsed.success) {
      return Response.json(
        { success: false, error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { formSchemaId, userInput, conversationHistory, currentFormData, currentFieldId } =
      parsed.data;

    const formSchema = await loadFormSchema(formSchemaId);

    // ── PROMPT 1: Extraction only ─────────────────────────────────────────────
    const extractionSystem =
      buildExtractionSystemPrompt(formSchema, currentFieldId ?? null, currentFormData) +
      JSON_INSTRUCTION;
    const extractionUser = buildExtractionUserMessage(
      userInput,
      currentFormData,
      conversationHistory
    );

    const { output: extraction } = await runExtraction(extractionSystem, extractionUser);

    // Validate field values against schema
    const validationErrors = validateExtraction(extraction.extractedFields, formSchema);
    // If validation errors exist, do a quick correction pass
    if (validationErrors.length > 0) {
      // We'll just drop invalid fields rather than re-prompting to keep latency down
      for (const err of validationErrors) {
        const match = err.match(/^Field "([^"]+)"/);
        if (match) {
          delete extraction.extractedFields[match[1]];
          delete extraction.confidenceScores[match[1]];
        }
      }
    }

    // Compute merged state after this turn (updates + removals)
    const mergedData = { ...currentFormData };
    for (const [k, v] of Object.entries(extraction.extractedFields)) {
      mergedData[k] = v;
    }
    for (const fieldId of extraction.fieldsToRemove) {
      delete mergedData[fieldId];
    }

    // Compute completion
    const allRequiredFields = formSchema.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.required)
      .map((f) => f.id);

    const filledRequired = allRequiredFields.filter((id) => {
      const val = mergedData[id];
      return val !== undefined && val !== "";
    });

    const completionScore =
      allRequiredFields.length > 0
        ? Math.round((filledRequired.length / allRequiredFields.length) * 100)
        : 0;

    // The next field the interview should focus on
    const nextField = getNextRequiredField(formSchema, mergedData);
    const nextFieldId = nextField?.id ?? null;

    const lowConfidenceFields = Object.entries(extraction.confidenceScores)
      .filter(([, score]) => score < LOW_CONFIDENCE_THRESHOLD)
      .map(([fieldId]) => fieldId);

    // Recompute missingRequiredFields authoritatively from server side
    const serverMissingRequired = allRequiredFields.filter((id) => {
      const val = mergedData[id];
      return val === undefined || val === "";
    });

    // ── PROMPT 2: Next question generation ───────────────────────────────────
    const nextQuestionSystem = buildNextQuestionSystemPrompt(
      formSchema,
      currentFieldId ?? null,
      mergedData,
      {
        extractedFields: extraction.extractedFields,
        confidenceScores: extraction.confidenceScores,
        missingRequiredFields: serverMissingRequired,
      }
    );
    const nextQuestionUser = buildNextQuestionUserMessage(
      userInput,
      {
        extractedFields: extraction.extractedFields,
        fieldsToRemove: extraction.fieldsToRemove,
        missingRequiredFields: serverMissingRequired,
      },
      conversationHistory
    );

    const { text: agentMessage } = await generateText({
      model: MODEL,
      system: nextQuestionSystem,
      messages: [{ role: "user", content: nextQuestionUser }],
    });

    return Response.json({
      success: true,
      // Send all extracted fields + removals — client applies both atomically
      formData: extraction.extractedFields,
      fieldsToRemove: extraction.fieldsToRemove,
      fieldConfidence: extraction.confidenceScores,
      agentMessage: agentMessage.trim(),
      missingFields: serverMissingRequired,
      lowConfidenceFields,
      validationErrors,
      completionScore,
      currentFieldId: nextFieldId,
    });
  } catch (error) {
    console.error("Agent error:", error);
    const { message, status } = classifyError(error);
    return Response.json({ success: false, error: message }, { status });
  }
}
