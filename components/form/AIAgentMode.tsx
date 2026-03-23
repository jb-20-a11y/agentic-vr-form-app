"use client";

import { useState, useRef, useEffect } from "react";
import { useFormStore } from "@/lib/stores/formStore";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2, Bot, User } from "lucide-react";
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
  const openingFired = useRef(false);

  const {
    formData,
    conversationHistory,
    currentFieldId,
    updateMultipleFields,
    addConversationMessage,
    setAgentActive,
    setCurrentFieldId,
    calculateCompletionScore,
  } = useFormStore();

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, loading]);

  // Fire the opening question automatically on first mount.
  useEffect(() => {
    if (openingFired.current || conversationHistory.length > 0) return;
    openingFired.current = true;
    callAgent("");
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callAgent = async (userInput: string) => {
    setError(null);
    setLoading(true);
    setAgentActive(true);

    if (userInput.trim()) {
      addConversationMessage({
        role: "user",
        content: userInput.trim(),
        timestamp: Date.now(),
      });
    }

    try {
      const response = await fetch("/api/agent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          formSchemaId: formSchema.id,
          userInput,
          conversationHistory,
          currentFormData: formData,
          currentFieldId: currentFieldId ?? null,
        }),
      });

      const result: AgentResponse & {
        success: boolean;
        error?: string;
        fieldsToRemove?: string[];
      } = await response.json();

      if (result.success) {
        // One atomic call: apply all extracted field updates and removals together.
        // updateMultipleFields now accepts an optional removals list.
        updateMultipleFields(
          result.formData,
          "ai",
          result.fieldConfidence,
          result.fieldsToRemove ?? []
        );

        addConversationMessage({
          role: "assistant",
          content: result.agentMessage,
          timestamp: Date.now(),
        });

        setCurrentFieldId(result.currentFieldId ?? null);
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

  const handleSubmit = async () => {
    if (!input.trim() || loading) return;
    const userInput = input.trim();
    setInput("");
    await callAgent(userInput);
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
                  {conversationHistory.length === 0 ? "Starting interview..." : "Analyzing your input..."}
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
            placeholder="Answer the question above, or describe your session..."
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
