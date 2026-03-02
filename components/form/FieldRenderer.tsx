"use client";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormField } from "@/lib/types/form";

interface Props {
  field: FormField;
  value: string | number | boolean | undefined;
  onChange: (value: string | number | boolean) => void;
}

export default function FieldRenderer({ field, value, onChange }: Props) {
  const id = `field-${field.id}`;

  return (
    <div className="flex flex-col gap-2">
      <Label htmlFor={id} className="text-sm font-medium text-foreground">
        {field.label}
        {field.required && (
          <span className="text-destructive ml-1" aria-label="required">
            *
          </span>
        )}
      </Label>

      {field.type === "text" || field.type === "email" || field.type === "phone" ? (
        <Input
          id={id}
          type={field.type === "phone" ? "tel" : field.type}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="bg-background"
        />
      ) : field.type === "number" ? (
        <Input
          id={id}
          type="number"
          value={value !== undefined ? String(value) : ""}
          onChange={(e) => onChange(e.target.value ? Number(e.target.value) : "")}
          placeholder={field.placeholder}
          className="bg-background"
        />
      ) : field.type === "date" ? (
        <Input
          id={id}
          type="date"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background"
        />
      ) : field.type === "time" ? (
        <Input
          id={id}
          type="time"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          className="bg-background"
        />
      ) : field.type === "textarea" ? (
        <Textarea
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          rows={4}
          className="bg-background resize-y"
        />
      ) : field.type === "select" && field.options ? (
        <Select
          value={String(value ?? "")}
          onValueChange={(v) => onChange(v)}
        >
          <SelectTrigger id={id} className="bg-background">
            <SelectValue placeholder={`Select ${field.label.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {field.options.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : field.type === "checkbox" ? (
        <div className="flex items-center gap-2">
          <Checkbox
            id={id}
            checked={Boolean(value)}
            onCheckedChange={(checked) => onChange(Boolean(checked))}
          />
          <Label htmlFor={id} className="text-sm text-muted-foreground cursor-pointer">
            {field.placeholder || field.label}
          </Label>
        </div>
      ) : (
        <Input
          id={id}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder}
          className="bg-background"
        />
      )}
    </div>
  );
}
