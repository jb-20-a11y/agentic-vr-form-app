import Link from "next/link";
import { Button } from "@/components/ui/button";
import { FileQuestion, ArrowLeft } from "lucide-react";

export default function FormNotFound() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-6">
      <div className="text-center max-w-md">
        <div className="size-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-6">
          <FileQuestion className="size-8 text-muted-foreground" />
        </div>
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Form Not Found
        </h1>
        <p className="text-muted-foreground mb-8">
          The form you are looking for does not exist or may have been removed.
        </p>
        <Button asChild>
          <Link href="/" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Forms
          </Link>
        </Button>
      </div>
    </div>
  );
}
