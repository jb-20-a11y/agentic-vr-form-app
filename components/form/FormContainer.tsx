"use client";

import { useState, useCallback, useEffect } from "react";
import { useFormStore } from "@/lib/stores/formStore";
import ManualMode from "./ManualMode";
import AIAgentMode from "./AIAgentMode";
import FormPreview from "./FormPreview";
import ModeToggle, { type ViewMode } from "./ModeToggle";
import CompletionBar from "./CompletionBar";
import { Button } from "@/components/ui/button";
import { RotateCcw, Download, FileJson } from "lucide-react";
import type { FormSchema } from "@/lib/types/form";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import HandsFreeMode from "./HandsFreeMode";

interface Props {
  formSchema: FormSchema;
}

export default function FormContainer({ formSchema }: Props) {
  const [viewMode, setViewMode] = useState<ViewMode>("ai");
  const { formData, clearForm, calculateCompletionScore } = useFormStore();

  useEffect(() => {
    calculateCompletionScore(formSchema);
  }, [formData, formSchema, calculateCompletionScore]);

  const handleEditField = useCallback(() => {
    setViewMode("manual");
  }, []);

  const handleExportJSON = useCallback(() => {
    const exportData = {
      formId: formSchema.id,
      title: formSchema.title,
      exportedAt: new Date().toISOString(),
      data: formData,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${formSchema.id}-${new Date().toISOString().split("T")[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [formData, formSchema]);

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card px-4 py-3">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <div className="min-w-0">
              <h1 className="text-base font-semibold text-foreground truncate">
                {formSchema.title}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                <CompletionBar />
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ModeToggle mode={viewMode} onChange={setViewMode} />

            <div className="hidden sm:flex items-center gap-1 ml-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportJSON}
                className="gap-1.5"
              >
                <FileJson className="size-4" />
                <span className="hidden lg:inline">Export</span>
              </Button>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <RotateCcw className="size-4" />
                    <span className="hidden lg:inline">Reset</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Reset form?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all form data, conversation history, and
                      start fresh. This action cannot be undone.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction onClick={clearForm}>
                      Reset
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* Mobile export */}
            <div className="flex sm:hidden items-center gap-1">
              <Button variant="outline" size="icon" onClick={handleExportJSON} aria-label="Export JSON">
                <Download className="size-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="flex-1 flex overflow-hidden">
        {/* AI Agent Panel */}
        {(viewMode === "ai" || viewMode === "both") && (
          <div
            className={
              viewMode === "both"
                ? "w-1/2 border-r border-border"
                : "w-full"
            }
          >
            <AIAgentMode formSchema={formSchema} />
          </div>
        )}
        
        {/* Hands-Free Panel */}
        {(viewMode === "hands-free" || viewMode === "both") && (
          <div
            className={
              viewMode === "both"
                ? "w-1/2 border-r border-border"
                : "w-full"
            }
          >
            <HandsFreeMode formSchema={formSchema} />
          </div>
        )}

        {/* Manual Form */}
        {viewMode === "manual" && (
          <div className="w-full">
            <ManualMode formSchema={formSchema} />
          </div>
        )}

        {/* Preview panel (side-by-side mode) */}
        {viewMode === "both" && (
          <div className="w-1/2">
            <FormPreview
              formSchema={formSchema}
              onEditField={handleEditField}
            />
          </div>
        )}
      </main>
    </div>
  );
}
