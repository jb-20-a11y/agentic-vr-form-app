"use client";

import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertTriangle, AlertCircle, Pencil } from "lucide-react";
import type { FieldSource } from "@/lib/types/form";

interface Props {
  confidence?: number;
  source?: FieldSource;
}

export default function ConfidenceIndicator({ confidence, source }: Props) {
  if (source === "manual") {
    return (
      <Badge variant="outline" className="bg-secondary text-secondary-foreground text-xs gap-1">
        <Pencil className="size-3" />
        Manual
      </Badge>
    );
  }

  if (!confidence) return null;

  if (confidence >= 0.9) {
    return (
      <Badge variant="outline" className="bg-success/15 text-success text-xs gap-1 border-success/30">
        <CheckCircle className="size-3" />
        High ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }

  if (confidence >= 0.75) {
    return (
      <Badge variant="outline" className="bg-warning/15 text-warning-foreground text-xs gap-1 border-warning/30">
        <AlertTriangle className="size-3" />
        Medium ({Math.round(confidence * 100)}%)
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="bg-destructive/10 text-destructive text-xs gap-1 border-destructive/30">
      <AlertCircle className="size-3" />
      Low ({Math.round(confidence * 100)}%)
    </Badge>
  );
}
