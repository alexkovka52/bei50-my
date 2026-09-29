import { AppShell } from "@/components/shell/AppShell";

export default function BlocksLoading() {
  return (
    <AppShell>
      <div aria-busy="true" className="flex min-w-0 flex-col gap-5">
        <h1 className="m-0 font-display text-[32px] font-bold leading-none tracking-[-1px] text-forest min-[720px]:text-[40px]">
          Blocks
        </h1>
        <p className="sr-only">Loading blocks.</p>
        <div className="grid min-w-0 items-start gap-[22px] min-[1201px]:grid-cols-[minmax(0,1fr)_380px]">
          <div className="h-[640px] rounded-card bg-paper motion-safe:animate-pulse" />
          <div className="h-[420px] rounded-card bg-paper motion-safe:animate-pulse" />
        </div>
      </div>
    </AppShell>
  );
}
