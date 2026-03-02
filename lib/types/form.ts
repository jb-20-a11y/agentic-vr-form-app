import { z } from "zod";

// --- Form Schema Types (JSON-driven) ---

export interface AIHints {
  extractionPriority: "high" | "medium" | "low";
  aliases: string[];
  requiredForCompletion?: boolean;
  defaultToToday?: boolean;
  expectedFormat?: string;
}

export interface FormField {
  id: string;
  label: string;
  type: "text" | "date" | "textarea" | "select" | "number" | "checkbox" | "time" | "email" | "phone";
  required: boolean;
  placeholder?: string;
  options?: { label: string; value: string }[];
  aiHints?: AIHints;
  validation?: {
    minLength?: number;
    maxLength?: number;
    pattern?: string;
  };
}

export interface FormSection {
  id: string;
  title: string;
  description?: string;
  fields: FormField[];
}

export interface CompletionRules {
  minimumRequiredFields: string[];
  confidenceThreshold: number;
}

export interface FormSchema {
  id: string;
  version: string;
  title: string;
  description?: string;
  sections: FormSection[];
  completionRules: CompletionRules;
}

// --- Runtime State Types ---

export type FieldSource = "manual" | "ai";

export interface ConversationMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

export interface AgentResponse {
  success: boolean;
  formData: Record<string, string | number | boolean>;
  fieldConfidence: Record<string, number>;
  conversationHistory: ConversationMessage[];
  completionScore: number;
  agentMessage: string;
  missingFields: string[];
}

// --- Zod Schemas for validation ---

export const agentRequestSchema = z.object({
  formSchemaId: z.string(),
  userInput: z.string().min(1),
  conversationHistory: z.array(
    z.object({
      role: z.enum(["user", "assistant"]),
      content: z.string(),
      timestamp: z.number(),
    })
  ),
  currentFormData: z.record(z.unknown()),
});

export type AgentRequest = z.infer<typeof agentRequestSchema>;
