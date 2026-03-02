"use client";

import { useFormStore } from "@/lib/stores/formStore";
import { Progress } from "@/components/ui/progress";

export default function CompletionBar() {
  const { completionScore } = useFormStore();

  return (
    <div className="flex items-center gap-3">
      <Progress value={completionScore} className="h-2 w-24" />
      <span className="text-xs font-medium text-muted-foreground tabular-nums">
        {completionScore}%
      </span>
    </div>
  );
}
