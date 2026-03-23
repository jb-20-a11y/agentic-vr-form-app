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
  currentFieldId: string | null;

  // Actions
  updateField: (fieldId: string, value: string | number | boolean, source: FieldSource, confidence?: number) => void;
  removeField: (fieldId: string) => void;
  /**
   * Atomically applies field updates AND removals in one state transition.
   * This prevents the "wrong branch" bug where a correction was applied but
   * the old value wasn't removed because they were separate operations.
   */
  updateMultipleFields: (
    updates: Record<string, string | number | boolean>,
    source: FieldSource,
    confidences?: Record<string, number>,
    removals?: string[]
  ) => void;
  addConversationMessage: (message: ConversationMessage) => void;
  setAgentActive: (active: boolean) => void;
  setCurrentFieldId: (fieldId: string | null) => void;
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
  currentFieldId: null,

  updateField: (fieldId, value, source, confidence = 1.0) =>
    set((state) => ({
      formData: { ...state.formData, [fieldId]: value },
      fieldConfidence: { ...state.fieldConfidence, [fieldId]: confidence },
      fieldSource: { ...state.fieldSource, [fieldId]: source },
    })),

  removeField: (fieldId: string) =>
    set((state) => {
      const { [fieldId]: _f, ...newFormData } = state.formData;
      const { [fieldId]: _c, ...newConfidence } = state.fieldConfidence;
      const { [fieldId]: _s, ...newSource } = state.fieldSource;
      return {
        formData: newFormData,
        fieldConfidence: newConfidence,
        fieldSource: newSource,
      };
    }),

  updateMultipleFields: (updates, source, confidences = {}, removals = []) =>
    set((state) => {
      // Start from current state
      let newFormData = { ...state.formData, ...updates };
      let newConfidence = {
        ...state.fieldConfidence,
        ...Object.fromEntries(
          Object.keys(updates).map((key) => [key, confidences[key] ?? 0.85])
        ),
      };
      let newSource = {
        ...state.fieldSource,
        ...Object.fromEntries(Object.keys(updates).map((key) => [key, source])),
      };

      // Apply removals atomically in the same state update
      for (const fieldId of removals) {
        const { [fieldId]: _f, ...fd } = newFormData;
        const { [fieldId]: _c, ...fc } = newConfidence;
        const { [fieldId]: _s, ...fs } = newSource;
        newFormData = fd;
        newConfidence = fc;
        newSource = fs;
      }

      return {
        formData: newFormData,
        fieldConfidence: newConfidence,
        fieldSource: newSource,
      };
    }),

  addConversationMessage: (message) =>
    set((state) => ({
      conversationHistory: [...state.conversationHistory, message],
    })),

  setAgentActive: (active) => set({ agentActive: active }),

  setCurrentFieldId: (fieldId) => set({ currentFieldId: fieldId }),

  clearForm: () =>
    set({
      formData: {},
      fieldConfidence: {},
      fieldSource: {},
      conversationHistory: [],
      completionScore: 0,
      currentFieldId: null,
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
