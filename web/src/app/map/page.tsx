import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shell/EmptyState";

export const metadata: Metadata = { title: "Map" };

export default function MapPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-forest text-dew">
      <div className="p-6">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center gap-2 rounded-pill bg-paper px-4 text-[15px] font-semibold text-forest no-underline"
        >
          <ArrowLeft aria-hidden="true" size={18} strokeWidth={1.8} />
          Back to overview
        </Link>
      </div>
      <div className="px-8 pb-16">
        <EmptyState tone="dark" level="h1" heading="No survey data yet">
          Run <code>siret3 web-bundle</code> to publish a flight.
        </EmptyState>
      </div>
    </div>
  );
}
