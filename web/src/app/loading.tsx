import { PageHeader } from "@/components/shell/PageHeader";
import { AppShell } from "@/components/shell/AppShell";

export default function Loading() {
  return (
    <AppShell>
      <div aria-busy="true" className="flex min-h-0 flex-1 flex-col gap-[22px]">
        <PageHeader title="Overview" />
        <p className="sr-only">Loading the overview.</p>
        <div className="grid min-h-0 flex-1 content-start grid-cols-1 items-start gap-[22px] min-[1201px]:grid-cols-[minmax(0,1fr)_520px] min-[1201px]:items-stretch">
          <div className="flex min-w-0 flex-col gap-[22px]">
            <div className="h-40 rounded-card bg-paper motion-safe:animate-pulse" />
            <div className="h-28 rounded-card bg-paper motion-safe:animate-pulse" />
            <div className="grid grid-cols-1 gap-[22px] min-[701px]:grid-cols-2">
              <div className="h-48 rounded-card bg-paper motion-safe:animate-pulse" />
              <div className="h-48 rounded-card bg-paper motion-safe:animate-pulse" />
            </div>
            <div className="h-64 rounded-card bg-paper motion-safe:animate-pulse" />
          </div>
          <div className="h-[560px] rounded-[32px] bg-forest motion-safe:animate-pulse min-[1201px]:h-full min-[1201px]:min-h-[680px]" />
        </div>
      </div>
    </AppShell>
  );
}
