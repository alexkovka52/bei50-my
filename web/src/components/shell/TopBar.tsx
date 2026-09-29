import { Bell, ChevronDown, Search } from "lucide-react";
import { formatDay, formatHa } from "@/lib/data/format";
import { getSummary } from "@/lib/data/server";

const FARM_PLACE = "Sireț3 vineyard";

export async function TopBar({ title }: { title: string }) {
  const summary = await getSummary();
  const farm =
    summary && Number.isFinite(summary.area_ha) ? `${summary.farm}, ${formatHa(summary.area_ha)}` : (summary?.farm ?? FARM_PLACE);
  const flown = summary?.flown_on ? `Flown ${formatDay(summary.flown_on)}` : "No flight published";

  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex min-w-0 flex-wrap items-center gap-[18px]">
        <h1 className="m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest">{title}</h1>
        <button
          type="button"
          className="inline-flex min-h-11 items-center gap-2 rounded-pill border border-lichen bg-paper px-4 text-[15px] text-forest"
        >
          {farm}
          <ChevronDown aria-hidden="true" size={16} strokeWidth={1.8} />
        </button>
        <div className="text-sm text-ink-muted">{flown}</div>
      </div>
      <div className="flex w-full min-w-0 items-center gap-3 min-[701px]:w-auto">
        <label className="flex h-11 w-full max-w-[300px] min-w-0 items-center gap-2.5 rounded-pill bg-paper px-4 text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-moss min-[701px]:w-[300px]">
          <Search aria-hidden="true" size={18} strokeWidth={1.8} />
          <input
            type="search"
            name="q"
            placeholder="Search blocks, rows, tasks"
            aria-label="Search blocks, rows and tasks"
            className="w-full border-0 bg-transparent text-[15px] text-forest outline-none placeholder:text-ink-muted"
          />
        </label>
        <button
          type="button"
          aria-label="Notifications"
          className="inline-flex size-11 items-center justify-center rounded-full bg-paper text-forest"
        >
          <Bell aria-hidden="true" size={20} strokeWidth={1.8} />
        </button>
        <div className="inline-flex size-11 items-center justify-center rounded-full bg-moss text-[15px] font-semibold text-dew">CP</div>
      </div>
    </header>
  );
}
