"use client";

import { useState, useRef, useEffect } from "react";
import { useFormStore } from "@/lib/stores/formStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, User, Sparkles } from "lucide-react";
import type { FormSchema, AgentResponse } from "@/lib/types/form";

interface Props {
  formSchema: FormSchema;
}

export default function AIAgentMode({ formSchema }: Props) {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  const {
    formData,
    conversationHistory,
    updateMultipleFields,
    addConversationMessage,
    setAgentActive,
    calculateCompletionScore,
  } = useFormStore();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, loading]);

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;

    const userInput = input.trim();
    setInput("");
    setError(null);
    setLoading(true);
    setAgentActive(true);

    // Add user message immediately
    addConversationMessage({
      role: "user",
      content: userInput,
      timestamp: Date.now(),
    });

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formSchemaId: formSchema.id,
          userInput,
          conversationHistory,
          currentFormData: formData,
        }),
      });

      const result: AgentResponse & { success: boolean; error?: string } = await response.json();

      if (result.success) {
        // Update form state with AI extractions
        if (Object.keys(result.formData).length > 0) {
          updateMultipleFields(result.formData, "ai", result.fieldConfidence);
        }

        // Add assistant message
        addConversationMessage({
          role: "assistant",
          content: result.agentMessage,
          timestamp: Date.now(),
        });

        calculateCompletionScore(formSchema);
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Agent error:", err);
      setError("Failed to connect to AI agent. Please check your connection.");
    } finally {
      setLoading(false);
      setAgentActive(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Chat area */}
      <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {/* Welcome message */}
          {conversationHistory.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="size-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="size-7 text-primary" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">
                AI Form Assistant
              </h3>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Describe your session or paste your notes, and I will extract the relevant
                information to fill out the form. You can also answer my questions to
                complete missing fields.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {[
                  "I had a session with John Smith today...",
                  "Paste your session notes here",
                  "The client used JAWS screen reader...",
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => setInput(suggestion)}
                    className="text-xs px-3 py-1.5 rounded-full border border-border bg-card text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Messages */}
          {conversationHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 ${msg.role === "user" ? "flex-row-reverse" : ""}`}
            >
              <div
                className={`shrink-0 size-8 rounded-full flex items-center justify-center ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-secondary-foreground"
                }`}
              >
                {msg.role === "user" ? (
                  <User className="size-4" />
                ) : (
                  <Bot className="size-4" />
                )}
              </div>
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-card text-card-foreground border border-border rounded-bl-md"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {loading && (
            <div className="flex gap-3">
              <div className="shrink-0 size-8 rounded-full bg-secondary text-secondary-foreground flex items-center justify-center">
                <Bot className="size-4" />
              </div>
              <div className="bg-card border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  Analyzing your input...
                </div>
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-2 px-3 py-2 bg-destructive/10 text-destructive text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* Input area */}
      <div className="border-t border-border p-4 bg-card">
        <div className="max-w-2xl mx-auto flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe your session, paste notes, or answer questions..."
            rows={2}
            disabled={loading}
            className="resize-none bg-background min-h-[44px]"
            aria-label="Chat input"
          />
          <Button
            onClick={handleSubmit}
            disabled={loading || !input.trim()}
            size="icon"
            className="shrink-0 size-11 self-end"
            aria-label="Send message"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
