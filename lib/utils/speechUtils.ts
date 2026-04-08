"use client";

/**
 * Web Speech API utilities for hands-free mode.
 */

export interface SpeechRecognitionConfig {
  language?: string;
  continuous?: boolean;
  interimResults?: boolean;
  maxAlternatives?: number;
}

export interface SpeechSynthesisConfig {
  rate?: number;
  pitch?: number;
  volume?: number;
  lang?: string;
}

export interface RecognitionResult {
  transcript: string;
  isFinal: boolean;
  confidence: number;
}

class SpeechRecognitionManager {
  private recognition: SpeechRecognition | null = null;
  private isListening = false;
  private interim = "";
  private onResult: (result: RecognitionResult) => void = () => {};
  private onError: (error: string) => void = () => {};
  private onStart: () => void = () => {};
  private onEnd: () => void = () => {};

  constructor() {
    if (typeof window !== "undefined") {
      const SpeechRecognition =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;

      if (SpeechRecognition) {
        this.recognition = new SpeechRecognition();
        this.setupListeners();
      }
    }
  }

  private setupListeners() {
    if (!this.recognition) return;

    this.recognition.onstart = () => {
      this.isListening = true;
      this.interim = "";
      this.onStart();
    };

    this.recognition.onresult = (event: SpeechRecognitionEvent) => {
      this.interim = "";
      let isFinal = false;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        const confidence = event.results[i][0].confidence || 0;

        if (event.results[i].isFinal) {
          isFinal = true;
        } else {
          this.interim += transcript;
        }

        if (i === event.results.length - 1) {
          this.onResult({
            transcript: isFinal ? transcript : this.interim,
            isFinal,
            confidence,
          });
        }
      }
    };

    this.recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const errorMessage = this.getErrorMessage(event.error);
      this.onError(errorMessage);
    };

    this.recognition.onend = () => {
      this.isListening = false;
      this.onEnd();
    };
  }

  private getErrorMessage(error: string): string {
    const errorMap: Record<string, string> = {
      "no-speech": "No speech detected. Please try again.",
      "audio-capture": "No microphone detected. Please check your audio input.",
      "not-allowed": "Microphone permission denied. Please allow access.",
      "network": "Network error. Please check your connection.",
      "service-not-allowed": "Speech recognition service is not available.",
    };
    return errorMap[error] || `Speech recognition error: ${error}`;
  }

  public isSupported(): boolean {
    return this.recognition !== null;
  }

  public start(config: SpeechRecognitionConfig = {}): void {
    if (!this.recognition) {
      throw new Error("Speech Recognition is not supported in this browser.");
    }

    if (this.isListening) return;

    this.recognition.lang = config.language || "en-US";
    this.recognition.continuous = config.continuous ?? true;
    this.recognition.interimResults = config.interimResults ?? true;
    this.recognition.maxAlternatives = config.maxAlternatives ?? 1;

    this.recognition.start();
  }

  public stop(): void {
    if (this.recognition) {
      this.recognition.stop();
    }
  }

  public abort(): void {
    if (this.recognition) {
      this.recognition.abort();
      this.isListening = false;
    }
  }

  public setOnResult(callback: (result: RecognitionResult) => void): void {
    this.onResult = callback;
  }

  public setOnError(callback: (error: string) => void): void {
    this.onError = callback;
  }

  public setOnStart(callback: () => void): void {
    this.onStart = callback;
  }

  public setOnEnd(callback: () => void): void {
    this.onEnd = callback;
  }

  public getListeningState(): boolean {
    return this.isListening;
  }
}

class SpeechSynthesisManager {
  private synthesis: SpeechSynthesis | null = null;
  private isPlaying = false;
  private onStart: () => void = () => {};
  private onEnd: () => void = () => {};
  private onError: (error: string) => void = () => {};

  constructor() {
    if (typeof window !== "undefined") {
      this.synthesis =
        window.speechSynthesis || (window as any).webkitSpeechSynthesis;

      if (this.synthesis) {
        this.setupListeners();
      }
    }
  }

  private setupListeners() {
    if (!this.synthesis) return;
  }

  public isSupported(): boolean {
    return this.synthesis !== null;
  }

  public speak(text: string, config: SpeechSynthesisConfig = {}): Promise<void> {
    if (!this.synthesis) {
      return Promise.reject(
        new Error("Speech Synthesis is not supported in this browser.")
      );
    }

    this.synthesis.cancel();

    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = config.rate ?? 1;
      utterance.pitch = config.pitch ?? 1;
      utterance.volume = config.volume ?? 1;
      utterance.lang = config.lang ?? "en-US";

      utterance.onstart = () => {
        this.isPlaying = true;
        this.onStart();
      };

      utterance.onend = () => {
        this.isPlaying = false;
        this.onEnd();
        resolve();
      };

      utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
        this.isPlaying = false;
        const errorMsg = `Speech synthesis error: ${event.error}`;
        this.onError(errorMsg);
        reject(new Error(errorMsg));
      };

      this.synthesis!.speak(utterance);
    });
  }

  public stop(): void {
    if (this.synthesis) {
      this.synthesis.cancel();
      this.isPlaying = false;
    }
  }

  public setOnStart(callback: () => void): void {
    this.onStart = callback;
  }

  public setOnEnd(callback: () => void): void {
    this.onEnd = callback;
  }

  public setOnError(callback: (error: string) => void): void {
    this.onError = callback;
  }

  public getPlayingState(): boolean {
    return this.isPlaying;
  }
}

let recognitionInstance: SpeechRecognitionManager | null = null;
let synthesisInstance: SpeechSynthesisManager | null = null;

export function getSpeechRecognition(): SpeechRecognitionManager {
  if (!recognitionInstance) {
    recognitionInstance = new SpeechRecognitionManager();
  }
  return recognitionInstance;
}

export function getSpeechSynthesis(): SpeechSynthesisManager {
  if (!synthesisInstance) {
    synthesisInstance = new SpeechSynthesisManager();
  }
  return synthesisInstance;
}