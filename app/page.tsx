import { listFormSchemas } from "@/lib/schemas/loader";
import Link from "next/link";
import { FileText, Bot, ArrowRight, Shield, Zap, Layers } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function HomePage() {
  const schemas = await listFormSchemas();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero */}
      <header className="border-b border-border bg-card">
        <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary flex items-center justify-center">
              <FileText className="size-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground">AT Forms</span>
          </div>
        </div>
      </header>

      <main>
        {/* Hero section */}
        <section className="max-w-5xl mx-auto px-6 py-20">
          <div className="max-w-2xl">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium mb-6">
              <Bot className="size-4" />
              AI-Powered Documentation
            </div>
            <h1 className="text-4xl md:text-5xl font-bold text-foreground leading-tight text-balance">
              Healthcare Form Documentation, Simplified
            </h1>
            <p className="mt-4 text-lg text-muted-foreground leading-relaxed text-pretty">
              Fill out clinical forms faster with AI-assisted extraction. Describe your
              session naturally and let the AI populate the fields, or enter data manually.
              Switch between modes anytime.
            </p>
          </div>
        </section>

        {/* Features grid */}
        <section className="max-w-5xl mx-auto px-6 pb-16">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                icon: Bot,
                title: "AI Extraction",
                description:
                  "Paste session notes or describe your visit. The AI extracts structured data with confidence scores.",
              },
              {
                icon: Layers,
                title: "Dual Mode",
                description:
                  "Switch between AI chat and manual entry. Both modes sync to the same form in real-time.",
              },
              {
                icon: Shield,
                title: "Confidence Tracking",
                description:
                  "Every AI-populated field shows a confidence score. Low confidence fields are flagged for review.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="rounded-xl border border-border bg-card p-6"
              >
                <div className="size-10 rounded-lg bg-secondary flex items-center justify-center mb-4">
                  <feature.icon className="size-5 text-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-2">
                  {feature.title}
                </h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Available Forms */}
        <section className="max-w-5xl mx-auto px-6 pb-20">
          <h2 className="text-2xl font-bold text-foreground mb-2">
            Available Forms
          </h2>
          <p className="text-muted-foreground mb-8">
            Select a form to start filling it out with AI assistance.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {schemas.map((schema) => (
              <Link
                key={schema.id}
                href={`/form/${schema.id}`}
                className="group"
              >
                <div className="rounded-xl border border-border bg-card p-6 hover:border-primary/50 hover:shadow-sm transition-all">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className="size-4 text-primary" />
                        <span className="text-xs font-medium text-primary uppercase tracking-wider">
                          AI Ready
                        </span>
                      </div>
                      <h3 className="font-semibold text-foreground text-lg">
                        {schema.title}
                      </h3>
                    </div>
                    <ArrowRight className="size-5 text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <Button className="mt-4 gap-2" size="sm">
                    <Bot className="size-4" />
                    Start with AI
                  </Button>
                </div>
              </Link>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
