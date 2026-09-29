"use client";

import { AppShell } from "@/components/shell/AppShell";
import { PageProblem } from "@/components/shell/PageProblem";

export default function BlockError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <AppShell>
      <PageProblem title="Block" message="This block could not be loaded." onRetry={reset} />
    </AppShell>
  );
}
