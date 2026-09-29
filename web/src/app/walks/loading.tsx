import { Rail } from "@/components/shell/Rail";

export default function WalksLoading() {
  return (
    <div aria-busy="true" className="flex h-dvh overflow-hidden bg-dew text-forest">
      <div className="hidden h-full shrink-0 min-[481px]:flex">
        <Rail />
      </div>
      <main
        id="main"
        tabIndex={-1}
        className="relative flex h-full min-h-0 min-w-0 flex-1 flex-col min-[481px]:pt-6 min-[481px]:pr-8 min-[481px]:pb-8 min-[481px]:pl-2 min-[1024px]:flex-row min-[1024px]:gap-[22px]"
      >
        <h1 className="sr-only">Walks</h1>
        <p className="sr-only">Loading walks.</p>
        <div className="hidden min-h-0 w-full shrink-0 flex-col gap-[18px] min-[481px]:flex min-[1024px]:w-[420px]">
          <div className="h-11 w-48 rounded-pill bg-paper motion-safe:animate-pulse" />
          <div className="h-36 rounded-card bg-paper motion-safe:animate-pulse" />
          <div className="h-64 rounded-card bg-paper motion-safe:animate-pulse" />
        </div>
        <div className="min-h-[280px] flex-1 rounded-none bg-forest motion-safe:animate-pulse min-[1024px]:rounded-card" />
      </main>
    </div>
  );
}
