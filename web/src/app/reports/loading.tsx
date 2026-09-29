import { AppShell } from "@/components/shell/AppShell";
import { PageHeader } from "@/components/shell/PageHeader";

export default function ReportsLoading() {
  return (
    <AppShell>
      <div aria-busy="true" className="flex min-w-0 flex-col gap-[22px]">
        <PageHeader title="Reports" />
        <p className="sr-only">Loading reports.</p>
        <div className="h-56 rounded-card bg-paper motion-safe:animate-pulse" />
        <div className="h-72 rounded-card bg-paper motion-safe:animate-pulse" />
      </div>
    </AppShell>
  );
}
