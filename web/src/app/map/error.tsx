"use client";

import Link from "next/link";
import { PageProblem } from "@/components/shell/PageProblem";

export default function MapError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" tabIndex={-1} className="flex min-h-dvh flex-col bg-forest px-8 py-10 text-dew">
      <PageProblem title="Map" message="The map could not be loaded." onRetry={reset} tone="dark" />
      <Link href="/" className="mt-6 inline-flex min-h-11 items-center font-semibold text-dew">
        Back to overview
      </Link>
    </main>
  );
}
