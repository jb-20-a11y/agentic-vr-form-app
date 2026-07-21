# Agentic VR Form App

> **Status: Active development — prototype. Do not submit real client information; the app uses public cloud models.**

A Next.js web application that helps vocational rehabilitation (VR) service providers complete documentation faster using a conversational AI agent. Providers can describe a session in natural language and let the AI extract and populate form fields, or switch to manual entry at any time. Both modes share the same form state in real time.

---

## Overview

Filling out VR session documentation is repetitive and time-consuming. This app lets a provider paste their session notes — or simply describe what happened — and an AI agent walks through the form conversationally, extracting structured data field by field and flagging anything it's uncertain about for human review.

The core loop is a two-stage pipeline per turn:

1. **Extraction** — an LLM receives the provider's input alongside the form schema and current form state, and returns a JSON object of extracted field values with confidence scores.
2. **Conversation** — a second LLM call generates the next natural-language question or confirmation to send back to the user, based on what was just captured and what still needs to be filled in.

This separation keeps extraction structured and verifiable while keeping the conversation natural.

---

## Features

- **AI chat mode** — describe your session; the agent extracts structured values field by field with confidence scores
- **Manual entry mode** — a standard form UI; both modes sync to the same underlying state in real time
- **Confidence indicators** — every AI-populated field shows how confident the model was; low-confidence fields are visually flagged for review
- **Correction handling** — if a provider corrects a previously extracted value, the agent detects the correction and atomically removes the old value and applies the new one
- **First-person awareness** — the system prompt instructs the model to recognize that the person filling out the form *is* the instructor, not the client, and handles first-person phrasing accordingly
- **Retry loop with validation** — extraction output is validated against the form schema (field IDs, types, option values, date/time formats); invalid extractions are corrected or dropped without re-prompting, keeping latency low
- **Rate limit error handling** — surfaces model rate limit responses to the user with actionable messaging
- **JSON-schema-driven forms** — forms are defined as JSON files in `public/schemas/forms/`. Adding a new form requires no code changes.
- **PWA-ready** — includes a web manifest and app icons; can be added to the home screen on mobile

---

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| AI | Vercel AI SDK (`ai`, `@ai-sdk/openai`), GitHub Models (GPT-4o) |
| State | Zustand |
| UI | Tailwind CSS v4, Radix UI primitives, shadcn/ui |
| Forms | React Hook Form + Zod |

---

## Project Structure

```
agentic-vr-form-app/
├── app/
│   ├── api/
│   │   ├── route.ts              Top-level API route
│   │   └── agent/
│   │       └── route.ts          POST /api/agent — two-stage extraction + question generation
│   ├── form/
│   │   └── [formId]/             Dynamic route for each form
│   ├── layout.tsx                Root layout with analytics
│   └── page.tsx                  Home page — lists available forms
├── components/
│   ├── form/
│   │   ├── AIAgentMode.tsx       Conversational chat interface; fires opening question on mount
│   │   ├── ManualMode.tsx        Standard form field UI
│   │   ├── FormContainer.tsx     Shared container; owns mode toggle
│   │   ├── FormPreview.tsx       Live read-only preview of current form state
│   │   ├── ModeToggle.tsx        Switch between AI and manual modes
│   │   ├── FieldRenderer.tsx     Renders any field type from the schema
│   │   ├── CompletionBar.tsx     Progress bar for required field completion
│   │   └── ConfidenceIndicator.tsx  Per-field confidence badge
│   └── ui/                       shadcn/ui component library
├── lib/
│   ├── agent/
│   │   └── prompts.ts            All system and user prompt builders; field ordering helpers
│   ├── schemas/
│   │   └── loader.ts             Reads form JSON schemas from public/schemas/forms/
│   ├── stores/
│   │   └── formStore.ts          Zustand store — single source of truth for form + agent state
│   └── types/
│       └── form.ts               TypeScript interfaces and Zod schemas for forms and agent I/O
└── public/
    └── schemas/
        └── forms/
            └── at-training-report.json   Assistive Technology Training Report form definition
```

---

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm (or npm/yarn)
- A GitHub personal access token with access to [GitHub Models](https://github.com/marketplace/models) (for GPT-4o inference)

### Installation

```bash
git clone https://github.com/jb-20-a11y/agentic-vr-form-app.git
cd agentic-vr-form-app
pnpm install
```

### Environment Variables

Create a `.env.local` file in the project root:

```env
GITHUB_TOKEN=your_github_token_here
```

The app uses GitHub Models as its inference backend (`https://models.github.ai/inference`). The token is read server-side only and never exposed to the client.

### Development

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). Select a form from the home page to start.

### Build

```bash
pnpm build
pnpm start
```

---

## How It Works

### Agent API (`POST /api/agent`)

The client sends a request containing:
- `formSchemaId` — which form is being filled
- `userInput` — the provider's latest message
- `conversationHistory` — prior turns
- `currentFormData` — fields already filled
- `currentFieldId` — which field the conversation is currently focused on

The server performs two sequential LLM calls:

**Call 1 — Extraction**

The extraction system prompt lists every field in the schema (ID, label, type, required status, valid options, AI hints, and any first-person notes). The model is instructed to return a single raw JSON object with three keys:

```json
{
  "extractedFields": { "fieldId": "value" },
  "confidenceScores": { "fieldId": 0.95 },
  "fieldsToRemove": ["fieldIdToCorrect"]
}
```

The response is validated against a Zod schema. If the model returns malformed JSON or missing keys, the server retries up to three times with corrective feedback before failing. Extracted field values are then validated against the form schema (type, format, and option constraints); invalid values are dropped rather than passed through.

**Call 2 — Next question**

A separate system prompt tells the model its only job is to compose the next conversational message. It receives the extraction result and the current form state, and is told whether to ask a follow-up (low confidence or missing required field), confirm and advance, or close out the form. The model is explicitly instructed not to output JSON.

The two-prompt design keeps extraction deterministic and the conversation human-sounding without either bleeding into the other.

### Form Schema Format

Forms live as JSON files in `public/schemas/forms/`. Each file is loaded at runtime by `lib/schemas/loader.ts`. Adding a new form is as simple as dropping in a new JSON file — no code changes needed.

A minimal field definition:

```json
{
  "id": "fieldId",
  "label": "Human-readable label",
  "type": "text",
  "required": true,
  "placeholder": "Hint text",
  "question": "Optional custom question the agent will ask",
  "aiHints": {
    "extractionPriority": "high",
    "aliases": ["synonym1", "synonym2"],
    "expectedFormat": "description for the model",
    "firstPersonNote": "Guidance for handling first-person phrasing"
  }
}
```

Supported field types: `text`, `date`, `time`, `number`, `textarea`, `select`, `checkbox`, `email`, `phone`.

---

## Planned / In Progress

- Additional form schemas beyond the current Assistive Technology Training Report
- PDF export of completed forms
- Form submission / persistence backend
- Improved mobile layout for field-based use
- Expanded test coverage for the extraction pipeline
- Potential migration from GitHub Models to a provider with higher rate limits for production use

---

## Security Note

This is a prototype. All AI inference is done server-side. The `GITHUB_TOKEN` is never sent to the browser. Do not submit real client information — the app uses public cloud models and has no data retention controls in its current state.

---

## License

MIT License. See `LICENSE` for details.
