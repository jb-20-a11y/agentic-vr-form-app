"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bot, FileText, Columns2 } from "lucide-react";

export type ViewMode = "ai" | "manual" | "both";

interface Props {
  mode: ViewMode;
  onChange: (mode: ViewMode) => void;
}

export default function ModeToggle({ mode, onChange }: Props) {
  return (
    <Tabs value={mode} onValueChange={(v) => onChange(v as ViewMode)}>
      <TabsList>
        <TabsTrigger value="ai" className="gap-1.5">
          <Bot className="size-4" />
          <span className="hidden sm:inline">AI Agent</span>
        </TabsTrigger>
        <TabsTrigger value="manual" className="gap-1.5">
          <FileText className="size-4" />
          <span className="hidden sm:inline">Manual</span>
        </TabsTrigger>
        <TabsTrigger value="both" className="gap-1.5 hidden md:inline-flex">
          <Columns2 className="size-4" />
          <span className="hidden sm:inline">Split View</span>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  );
}
