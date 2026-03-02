"use client";

import { useFormStore } from "@/lib/stores/formStore";
import FieldRenderer from "./FieldRenderer";
import type { FormSchema } from "@/lib/types/form";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Props {
  formSchema: FormSchema;
}

export default function ManualMode({ formSchema }: Props) {
  const { formData, updateField } = useFormStore();

  return (
    <ScrollArea className="h-full">
      <div className="p-6 pb-24">
        <div className="max-w-2xl mx-auto">
          {formSchema.sections.map((section) => (
            <section key={section.id} className="mb-10" aria-labelledby={`section-${section.id}`}>
              <div className="mb-6">
                <h2
                  id={`section-${section.id}`}
                  className="text-lg font-semibold text-foreground"
                >
                  {section.title}
                </h2>
                {section.description && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {section.description}
                  </p>
                )}
                <div className="h-px bg-border mt-3" />
              </div>

              <div className="flex flex-col gap-5">
                {section.fields.map((field) => (
                  <FieldRenderer
                    key={field.id}
                    field={field}
                    value={formData[field.id]}
                    onChange={(value) => updateField(field.id, value, "manual")}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      </div>
    </ScrollArea>
  );
}
