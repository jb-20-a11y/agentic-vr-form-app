"use client";

import { useFormStore } from "@/lib/stores/formStore";
import ConfidenceIndicator from "./ConfidenceIndicator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle2, Circle } from "lucide-react";
import type { FormSchema } from "@/lib/types/form";

interface Props {
  formSchema: FormSchema;
  onEditField?: (fieldId: string) => void;
}

export default function FormPreview({ formSchema, onEditField }: Props) {
  const { formData, fieldConfidence, fieldSource } = useFormStore();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 pb-24">
        <div className="max-w-2xl mx-auto">
          <h2 className="text-lg font-semibold text-foreground mb-1">
            Form Preview
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Live view of all extracted and manually entered data.
          </p>

          {formSchema.sections.map((section) => (
            <div key={section.id} className="mb-8">
              <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-3">
                {section.title}
              </h3>
              <div className="h-px bg-border mb-4" />

              <div className="flex flex-col gap-3">
                {section.fields.map((field) => {
                  const value = formData[field.id];
                  const confidence = fieldConfidence[field.id];
                  const source = fieldSource[field.id];
                  const isFilled = value !== undefined && value !== "";

                  // Find display value for select fields
                  let displayValue = String(value ?? "");
                  if (field.type === "select" && field.options && isFilled) {
                    const option = field.options.find((o) => o.value === String(value));
                    displayValue = option ? option.label : displayValue;
                  }

                  return (
                    <div
                      key={field.id}
                      className={`group rounded-lg border p-3 transition-colors ${
                        !isFilled
                          ? "border-border bg-muted/30"
                          : confidence !== undefined && confidence < 0.75
                            ? "border-warning/40 bg-warning/5"
                            : "border-success/40 bg-success/5"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {isFilled ? (
                            <CheckCircle2 className="size-4 shrink-0 text-success" />
                          ) : (
                            <Circle className="size-4 shrink-0 text-muted-foreground" />
                          )}
                          <span className="text-sm font-medium text-foreground truncate">
                            {field.label}
                            {field.required && (
                              <span className="text-destructive ml-0.5">*</span>
                            )}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {isFilled && (
                            <ConfidenceIndicator
                              confidence={confidence}
                              source={source}
                            />
                          )}
                          {onEditField && (
                            <button
                              onClick={() => onEditField(field.id)}
                              className="text-xs text-primary hover:underline opacity-0 group-hover:opacity-100 transition-opacity"
                            >
                              Edit
                            </button>
                          )}
                        </div>
                      </div>

                      <div className="mt-1.5 ml-6">
                        {isFilled ? (
                          <p className="text-sm text-foreground/80 whitespace-pre-wrap break-words">
                            {displayValue}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground italic">
                            Not yet filled
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
