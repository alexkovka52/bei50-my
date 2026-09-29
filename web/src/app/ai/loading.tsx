import { MODEL_TITLE } from "@/components/model/model";
import { AppShell } from "@/components/shell/AppShell";

export default function AiLoading() {
  return (
    <AppShell>
      <div aria-busy="true" className="flex min-w-0 flex-col gap-[22px]">
        <h1 className="m-0 max-w-full font-display text-[32px] font-bold leading-tight tracking-[-1px] text-forest min-[720px]:text-[40px] min-[720px]:leading-none">
          {MODEL_TITLE}
        </h1>
        <p className="sr-only">Loading the model board.</p>
        <div className="grid grid-cols-1 gap-3 min-[700px]:grid-cols-2 min-[1100px]:grid-cols-3">
          <div className="h-28 rounded-card bg-paper motion-safe:animate-pulse" />
          <div className="h-28 rounded-card bg-paper motion-safe:animate-pulse" />
          <div className="h-28 rounded-card bg-paper motion-safe:animate-pulse" />
        </div>
        <div className="h-64 rounded-card bg-forest motion-safe:animate-pulse" />
      </div>
    </AppShell>
  );
}
