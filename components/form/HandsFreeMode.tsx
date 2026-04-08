"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useFormStore } from "@/lib/stores/formStore";
import { getSpeechRecognition, getSpeechSynthesis } from "@/lib/utils/speechUtils";
import { Button } from "@/components/ui/button";
import { Loader2, Mic, MicOff, Volume2, VolumeX, AlertCircle } from "lucide-react";
import type { FormSchema, AgentResponse } from "@/lib/types/form";

interface Props {
  formSchema: FormSchema;
}

export default function HandsFreeMode({ formSchema }: Props) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [volume, setVolume] = useState(1);
  const [speechEnabled, setSpeechEnabled] = useState(true);
  const endRef = useRef<HTMLDivElement>(null);
  const openingFired = useRef(false);

  const recognition = getSpeechRecognition();
  const synthesis = getSpeechSynthesis();

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

  // Check browser support on mount
  useEffect(() => {
    if (!recognition.isSupported() || !synthesis.isSupported()) {
      setError("Speech API not supported in this browser. Please use Chrome, Edge, or Safari.");
      setIsListening(false);
    }
  }, [recognition, synthesis]);

  // Auto-scroll to end of conversation
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [conversationHistory, isProcessing]);

  // Setup speech recognition callbacks
  useEffect(() => {
    recognition.setOnStart(() => {
      setIsListening(true);
      setError(null);
      setTranscript("");
      setInterimTranscript("");
    });

    recognition.setOnResult(({ transcript: text, isFinal, confidence }) => {
      if (isFinal) {
        setTranscript(text);
        setInterimTranscript("");
      } else {
        setInterimTranscript(text);
      }
    });

    recognition.setOnError((errorMsg) => {
      setError(errorMsg);
      setIsListening(false);
    });

    recognition.setOnEnd(() => {
      setIsListening(false);
    });

    return () => {
      recognition.abort();
    };
  }, [recognition]);

  // Fire opening question on mount
  useEffect(() => {
    if (openingFired.current || conversationHistory.length > 0) return;
    openingFired.current = true;
    callAgent("", true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const callAgent = async (userInput: string, speakResponse = true) => {
    setError(null);
    setIsProcessing(true);
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

        // Speak the agent's response if speech is enabled
        if (speakResponse && speechEnabled) {
          try {
            await synthesis.speak(result.agentMessage, {
              rate: 0.95,
              pitch: 1,
              volume,
              lang: "en-US",
            });
          } catch (err) {
            console.error("Speech synthesis error:", err);
          }
        }
      } else {
        setError(result.error || "Something went wrong. Please try again.");
      }
    } catch (err) {
      console.error("Agent error:", err);
      setError("Failed to connect to AI agent. Please check your connection.");
    } finally {
      setIsProcessing(false);
      setAgentActive(false);
    }
  };

  const handleStartListening = useCallback(async () => {
    if (!recognition.isSupported()) {
      setError("Speech Recognition is not supported in this browser.");
      return;
    }

    if (isProcessing) return;

    try {
      recognition.start({ language: "en-US", continuous: false });
    } catch (err) {
      console.error("Error starting recognition:", err);
      setError("Failed to start listening. Please try again.");
    }
  }, [recognition, isProcessing]);

  const handleStopListening = useCallback(() => {
    recognition.stop();
    setIsListening(false);

    // If we have a final transcript, process it
    if (transcript.trim()) {
      callAgent(transcript, true);
      setTranscript("");
    }
  }, [recognition, transcript]);

  const handleCancelListening = useCallback(() => {
    recognition.abort();
    setIsListening(false);
    setTranscript("");
    setInterimTranscript("");
  }, [recognition]);

  const toggleSpeech = useCallback(() => {
    setSpeechEnabled((prev) => !prev);
    synthesis.stop();
  }, [synthesis]);

  return (
    <div className="h-full flex flex-col bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* Conversation Area */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="flex flex-col gap-4 max-w-2xl mx-auto">
          {conversationHistory.map((msg, idx) => (
            <div
              key={idx}
              className={`flex gap-3 animate-fade-in ${
                msg.role === "user" ? "flex-row-reverse" : ""
              }`}
            >
              <div
                className={`shrink-0 size-10 rounded-full flex items-center justify-center font-semibold ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-gradient-to-br from-blue-400 to-blue-600 text-white"
                }`}
              >
                {msg.role === "user" ? "👤" : "🤖"}
              </div>
              <div
                className={`max-w-[75%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md shadow-md"
                    : "bg-white dark:bg-slate-800 text-foreground border border-border rounded-bl-md shadow-sm"
                }`}
              >
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            </div>
          ))}

          {/* Processing indicator */}
          {isProcessing && (
            <div className="flex gap-3 animate-fade-in">
              <div className="shrink-0 size-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 text-white flex items-center justify-center">
                🤖
              </div>
              <div className="bg-white dark:bg-slate-800 border border-border rounded-2xl rounded-bl-md px-4 py-3 shadow-sm">
                <div className="flex items-center gap-2 text-muted-foreground text-sm">
                  <Loader2 className="size-4 animate-spin" />
                  {conversationHistory.length === 0
                    ? "Starting interview..."
                    : "Processing your response..."}
                </div>
              </div>
            </div>
          )}

          {/* Interim transcript (shown while listening) */}
          {isListening && interimTranscript && (
            <div className="flex gap-3 opacity-60">
              <div className="shrink-0 size-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                👤
              </div>
              <div className="bg-primary/20 text-foreground rounded-2xl rounded-br-md px-4 py-3 text-sm italic">
                {interimTranscript}...
              </div>
            </div>
          )}

          <div ref={endRef} />
        </div>
      </div>

      {/* Error message */}
      {error && (
        <div className="mx-4 mb-3 px-4 py-3 bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 text-sm rounded-lg flex items-center gap-2">
          <AlertCircle className="size-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* Controls */}
      <div className="border-t border-border bg-card p-4">
        <div className="max-w-2xl mx-auto space-y-3">
          {/* Microphone and Speech Controls */}
          <div className="flex gap-2">
            <Button
              onClick={handleStartListening}
              disabled={isListening || isProcessing}
              size="lg"
              className="flex-1 gap-2 h-12"
              variant={isListening ? "secondary" : "default"}
            >
              <Mic className="size-5" />
              {isListening ? "Listening..." : "Start Speaking"}
            </Button>

            {isListening && (
              <Button
                onClick={handleStopListening}
                disabled={!transcript.trim()}
                size="lg"
                variant="outline"
                className="h-12"
                title="Submit your response"
              >
                <Loader2 className="size-5 animate-spin" />
              </Button>
            )}

            {isListening && (
              <Button
                onClick={handleCancelListening}
                size="lg"
                variant="outline"
                className="h-12"
                title="Cancel listening"
              >
                <MicOff className="size-5" />
              </Button>
            )}

            <Button
              onClick={toggleSpeech}
              size="lg"
              variant={speechEnabled ? "outline" : "secondary"}
              className="h-12"
              title={speechEnabled ? "Mute responses" : "Unmute responses"}
            >
              {speechEnabled ? (
                <Volume2 className="size-5" />
              ) : (
                <VolumeX className="size-5" />
              )}
            </Button>
          </div>

          {/* Volume Control */}
          {speechEnabled && (
            <div className="flex items-center gap-2">
              <VolumeX className="size-4 text-muted-foreground" />
              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer"
                aria-label="Response volume"
              />
              <Volume2 className="size-4 text-muted-foreground" />
            </div>
          )}

          {/* Transcript Display */}
          {(transcript || interimTranscript) && (
            <div className="p-3 bg-slate-100 dark:bg-slate-700 rounded-lg text-sm">
              <p className="text-muted-foreground mb-1">Your input:</p>
              <p className="font-medium">
                {transcript || interimTranscript}
                {interimTranscript && !transcript && <span className="animate-pulse">...</span>}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}