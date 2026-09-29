"use client";

import { PageProblem } from "@/components/shell/PageProblem";
import { Rail } from "@/components/shell/Rail";

export default function WalksError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="flex min-h-dvh bg-dew text-forest">
      <Rail />
      <main id="main" tabIndex={-1} className="flex min-w-0 flex-1 flex-col px-8 py-8 outline-none">
        <PageProblem title="Walks" message="The walks could not be loaded." onRetry={reset} />
      </main>
    </div>
  );
}
