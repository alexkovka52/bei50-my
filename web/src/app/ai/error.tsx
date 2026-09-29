"use client";

import { AppShell } from "@/components/shell/AppShell";
import { PageProblem } from "@/components/shell/PageProblem";

export default function AiError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <PageProblem title="AI" message="The model board could not be loaded." onRetry={reset} />
    </AppShell>
  );
}
