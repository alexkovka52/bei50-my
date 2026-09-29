"use client";

import { AppShell } from "@/components/shell/AppShell";
import { PageProblem } from "@/components/shell/PageProblem";

export default function BlocksError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <PageProblem title="Blocks" message="The block list could not be loaded." onRetry={reset} />
    </AppShell>
  );
}
