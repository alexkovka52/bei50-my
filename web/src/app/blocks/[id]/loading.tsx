import { AppShell } from "@/components/shell/AppShell";

export default function BlockLoading() {
  return (
    <AppShell>
      <div aria-busy="true" className="flex min-w-0 flex-col gap-[22px]">
        <p className="m-0 text-[15px] text-ink-muted">Blocks</p>
        <h1 className="m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest">Block</h1>
        <p className="sr-only">Loading this block.</p>
        <div className="grid min-w-0 items-start gap-[22px] min-[1201px]:grid-cols-[minmax(0,1fr)_400px]">
          <div className="h-[240px] rounded-card bg-paper motion-safe:animate-pulse min-[700px]:h-[420px]" />
          <div className="h-[280px] rounded-card bg-paper motion-safe:animate-pulse" />
          <div className="h-64 rounded-card bg-paper motion-safe:animate-pulse min-[1201px]:col-span-2" />
        </div>
      </div>
    </AppShell>
  );
}
