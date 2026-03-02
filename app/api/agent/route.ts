import { generateText, Output } from "ai";
import { z } from "zod";
import { loadFormSchema } from "@/lib/schemas/loader";
import { buildExtractionSystemPrompt, buildUserMessage } from "@/lib/agent/prompts";
import { agentRequestSchema } from "@/lib/types/form";

const extractionOutputSchema = z.object({
  extractedFields: z
    .record(z.string())
    .describe("Map of fieldId to extracted value"),
  confidenceScores: z
    .record(z.number())
    .describe("Map of fieldId to confidence 0.0-1.0"),
  agentMessage: z
    .string()
    .describe("A helpful conversational response to the user summarizing what was extracted and asking about missing fields"),
  missingRequiredFields: z
    .array(z.string())
    .describe("List of fieldIds that are still required but missing"),
});

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

    // Load the form schema
    const formSchema = await loadFormSchema(formSchemaId);

    // Build prompts
    const systemPrompt = buildExtractionSystemPrompt(formSchema);
    const userMessage = buildUserMessage(userInput, currentFormData, conversationHistory);

    // Use AI SDK 6 structured output
    const { output } = await generateText({
      model: "anthropic/claude-sonnet-4.6",
      system: systemPrompt,
      output: Output.object({
        schema: extractionOutputSchema,
      }),
      messages: [
        {
          role: "user",
          content: userMessage,
        },
      ],
    });

    if (!output) {
      return Response.json(
        { success: false, error: "No output from AI" },
        { status: 500 }
      );
    }

    // Calculate completion score
    const allRequiredFields = formSchema.sections
      .flatMap((s) => s.fields)
      .filter((f) => f.required)
      .map((f) => f.id);

    const mergedData = { ...currentFormData, ...output.extractedFields };
    const filledRequired = allRequiredFields.filter((id) => {
      const val = mergedData[id];
      return val !== undefined && val !== "";
    });

    const completionScore =
      allRequiredFields.length > 0
        ? Math.round((filledRequired.length / allRequiredFields.length) * 100)
        : 0;

    // Build updated conversation history
    const now = Date.now();
    const updatedHistory = [
      ...conversationHistory,
      { role: "user" as const, content: userInput, timestamp: now },
      { role: "assistant" as const, content: output.agentMessage, timestamp: now + 1 },
    ];

    return Response.json({
      success: true,
      formData: output.extractedFields,
      fieldConfidence: output.confidenceScores,
      conversationHistory: updatedHistory,
      completionScore,
      agentMessage: output.agentMessage,
      missingFields: output.missingRequiredFields,
    });
  } catch (error) {
    console.error("Agent error:", error);
    return Response.json(
      { success: false, error: "Internal server error" },
      { status: 500 }
    );
  }
}
