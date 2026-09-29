import type { Metadata } from "next";
import { ModelBoard } from "@/components/model/ModelBoard";
import { MODEL_TITLE } from "@/components/model/model";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { getModel, getSummary } from "@/lib/data/server";

export const metadata: Metadata = { title: "AI" };

export default async function AiPage() {
  const [model, summary] = await Promise.all([getModel(), getSummary()]);

  return (
    <AppShell>
      {model ? (
        <ModelBoard model={model} summary={summary} />
      ) : (
        <>
          <h1 className="m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest">{MODEL_TITLE}</h1>
          <EmptyState heading="Model scores are pending">
            Training metrics appear here after <code>siret3 web-bundle</code> publishes model.json.
          </EmptyState>
        </>
      )}
    </AppShell>
  );
}
