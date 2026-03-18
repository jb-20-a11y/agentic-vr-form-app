import { generateText } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import { z } from "zod";
import { loadFormSchema } from "@/lib/schemas/loader";
import { buildExtractionSystemPrompt, buildUserMessage } from "@/lib/agent/prompts";
import { agentRequestSchema } from "@/lib/types/form";
import type { FormSchema } from "@/lib/types/form";

const github = createOpenAI({
  baseURL: "https://models.github.ai/inference",
  apiKey: process.env.GITHUB_TOKEN ?? "",
});

const MODEL = github.chat("gpt-4o");

const extractionOutputSchema = z.object({
  extractedFields: z.record(z.string()),
  confidenceScores: z.record(z.number()),
  fieldsToRemove: z.array(z.string()).default([]),
  agentMessage: z.string(),
  missingRequiredFields: z.array(z.string()),
});

type ExtractionOutput = z.infer<typeof extractionOutputSchema>;

const JSON_OUTPUT_INSTRUCTION = `

RESPONSE FORMAT — CRITICAL:
You must respond with a single raw JSON object and nothing else.
Do not include markdown code fences, backticks, or any text before or after the JSON.
The JSON object must have exactly these five keys:
{
  "extractedFields": { "<fieldId>": "<value>", ... },
  "confidenceScores": { "<fieldId>": <0.0-1.0>, ... },
  "fieldsToRemove": [ "fieldId", ... ],
  "agentMessage": "<conversational summary string>",
  "missingRequiredFields": ["<fieldId>", ...]
}`;

function parseModelJSON(raw: string): unknown {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  return JSON.parse(cleaned);
}

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
          errors.push(`Field "${fieldId}" value "${value}" is not a valid option. Must be one of: ${validValues.join(", ")}`);
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

const LOW_CONFIDENCE_THRESHOLD = 0.6;
const MAX_ATTEMPTS = 3;

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

    const { formSchemaId, userInput, conversationHistory, currentFormData } = parsed.data;

    const formSchema = await loadFormSchema(formSchemaId);
    const systemPrompt = buildExtractionSystemPrompt(formSchema) + JSON_OUTPUT_INSTRUCTION;
    const userMessage = buildUserMessage(userInput, currentFormData, conversationHistory);

    let lastOutput: ExtractionOutput | null = null;
    let lastErrors: string[] = [];

    const messages: Array<{ role: "user" | "assistant"; content: string }> = [
      { role: "user", content: userMessage },
    ];

    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const { text } = await generateText({
        model: MODEL,
        system: systemPrompt,
        messages,
      });

      // Step 1: parse JSON
      let parsedJson: unknown;
      try {
        parsedJson = parseModelJSON(text);
      } catch {
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content: "Your response was not valid JSON. Return only a raw JSON object — no markdown, no backticks, no extra text.",
        });
        continue;
      }

      // Step 2: validate schema shape
      const schemaResult = extractionOutputSchema.safeParse(parsedJson);
      if (!schemaResult.success) {
        messages.push({ role: "assistant", content: text });
        messages.push({
          role: "user",
          content:
            `Your JSON was missing required keys or had wrong types:\n` +
            JSON.stringify(schemaResult.error.flatten().fieldErrors, null, 2) +
            `\nReturn the complete JSON object with all five required keys.`,
        });
        continue;
      }

      lastOutput = schemaResult.data;

      // Step 3: validate field values against form schema
      lastErrors = validateExtraction(lastOutput.extractedFields, formSchema);
      if (lastErrors.length === 0) break;

      messages.push({ role: "assistant", content: text });
      messages.push({
        role: "user",
        content:
          `Your extracted field values had these validation errors:\n` +
          lastErrors.map((e) => `  - ${e}`).join("\n") +
          `\n\nCorrect only these issues and return the full JSON object again.`,
      });
    }

    if (!lastOutput) {
      return Response.json(
        { success: false, error: "Model returned no parseable output after retries" },
        { status: 500 }
      );
    }

    const allRequiredFields = formSchema.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.required)
      .map((f) => f.id);

    const mergedData = { ...currentFormData, ...lastOutput.extractedFields };
    for (const fieldId of lastOutput.fieldsToRemove) {
      delete mergedData[fieldId];
    }
    const filledRequired = allRequiredFields.filter((id) => {
      const val = mergedData[id];
      return val !== undefined && val !== "";
    });

    const completionScore =
      allRequiredFields.length > 0
        ? Math.round((filledRequired.length / allRequiredFields.length) * 100)
        : 0;

    const lowConfidenceFields = Object.entries(lastOutput.confidenceScores)
      .filter(([, score]) => score < LOW_CONFIDENCE_THRESHOLD)
      .map(([fieldId]) => fieldId);

    const now = Date.now();
    const updatedHistory = [
      ...conversationHistory,
      { role: "user" as const, content: userInput, timestamp: now },
      { role: "assistant" as const, content: lastOutput.agentMessage, timestamp: now + 1 },
    ];

    return Response.json({
      success: true,
      formData: lastOutput.extractedFields,
      fieldConfidence: lastOutput.confidenceScores,
      fieldsToRemove: lastOutput.fieldsToRemove,
      conversationHistory: updatedHistory,
      completionScore,
      agentMessage: lastOutput.agentMessage,
      missingFields: lastOutput.missingRequiredFields,
      lowConfidenceFields,
      validationErrors: lastErrors,
    });
  } catch (error) {
    console.error("Agent error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}