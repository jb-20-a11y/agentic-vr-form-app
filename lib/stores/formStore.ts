import { create } from "zustand";
import type { ConversationMessage, FieldSource, FormSchema } from "@/lib/types/form";

interface FormState {
  // Current form data (single source of truth)
  formData: Record<string, string | number | boolean>;

  // Field metadata
  fieldConfidence: Record<string, number>;
  fieldSource: Record<string, FieldSource>;

  // Agent state
  conversationHistory: ConversationMessage[];
  agentActive: boolean;
  completionScore: number;

  // Actions
  updateField: (fieldId: string, value: string | number | boolean, source: FieldSource, confidence?: number) => void;
  updateMultipleFields: (
    updates: Record<string, string | number | boolean>,
    source: FieldSource,
    confidences?: Record<string, number>
  ) => void;
  addConversationMessage: (message: ConversationMessage) => void;
  setAgentActive: (active: boolean) => void;
  clearForm: () => void;
  calculateCompletionScore: (schema: FormSchema) => void;
}

export const useFormStore = create<FormState>()((set, get) => ({
  formData: {},
  fieldConfidence: {},
  fieldSource: {},
  conversationHistory: [],
  agentActive: false,
  completionScore: 0,

  updateField: (fieldId, value, source, confidence = 1.0) =>
    set((state) => ({
      formData: { ...state.formData, [fieldId]: value },
      fieldConfidence: { ...state.fieldConfidence, [fieldId]: confidence },
      fieldSource: { ...state.fieldSource, [fieldId]: source },
    })),

  updateMultipleFields: (updates, source, confidences = {}) =>
    set((state) => ({
      formData: { ...state.formData, ...updates },
      fieldConfidence: {
        ...state.fieldConfidence,
        ...Object.fromEntries(
          Object.keys(updates).map((key) => [key, confidences[key] ?? 0.85])
        ),
      },
      fieldSource: {
        ...state.fieldSource,
        ...Object.fromEntries(Object.keys(updates).map((key) => [key, source])),
      },
    })),

  addConversationMessage: (message) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, message],
    })),

  setAgentActive: (active) => set({ agentActive: active }),

  clearForm: () =>
    set({
      formData: {},
      fieldConfidence: {},
      fieldSource: {},
      conversationHistory: [],
      completionScore: 0,
    }),

  calculateCompletionScore: (schema) => {
    const state = get();
    const allFields = schema.sections.flatMap((s) => s.fields);
    const requiredFields = allFields.filter((f) => f.required);
    const filledRequired = requiredFields.filter((f) => {
      const val = state.formData[f.id];
      return val !== undefined && val !== "";
    });

    const score = requiredFields.length > 0 ? filledRequired.length / requiredFields.length : 0;
    set({ completionScore: Math.round(score * 100) });
  },
}));
