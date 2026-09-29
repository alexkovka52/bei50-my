import type { VineyardRow } from "@/lib/data/types";
import { formatMetres, structureLabel } from "@/lib/blocks/blocks";
import { formatInt } from "@/lib/data/format";
import { cn } from "@/lib/utils";

export function BlockRows({ rows }: { rows: VineyardRow[] | null }) {
  if (!rows) {
    return (
      <section className="rounded-card bg-paper px-7 py-6">
        <h2 className="m-0 text-lg font-semibold">Rows</h2>
        <p className="mt-3 mb-0 text-ink-muted">Not measured</p>
      </section>
    );
  }

  const disrupted = rows.filter((row) => row.structure === "disrupted").length;

  return (
    <section className="min-w-0 rounded-card bg-paper px-4 py-5 min-[700px]:px-7 min-[700px]:py-6">
      <h2 className="m-0 text-lg font-semibold">Rows</h2>
      {rows.length === 0 ? (
        <p className="mt-3 mb-0 text-ink-muted">No rows published for this block</p>
      ) : (
        <>
          <p className="mt-1 mb-0 flex flex-wrap gap-x-4 text-sm text-ink-muted">
            <span>{formatInt(rows.length)} rows</span>
            <span>{formatInt(disrupted)} disrupted</span>
          </p>
          <div className="mt-4 min-w-0 overflow-x-auto">
            <table className="w-full min-w-[420px] border-collapse text-sm">
              <caption className="sr-only">Rows in this block, with length and structure</caption>
              <thead>
                <tr className="text-left text-[13px] text-ink-muted">
                  <th scope="col" className="py-2.5 pr-3 font-medium">
                    Row
                  </th>
                  <th scope="col" className="px-3 py-2.5 text-right font-medium">
                    Length
                  </th>
                  <th scope="col" className="py-2.5 pl-3 font-medium">
                    Structure
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const disruptedRow = row.structure === "disrupted";
                  return (
                    <tr
                      key={row.id}
                      className={cn(
                        "border-t border-line",
                        disruptedRow && "bg-[#F4E4C4] shadow-[inset_3px_0_0_#E09A2D]",
                      )}
                    >
                      <th scope="row" className="py-2.5 pr-3 text-left font-semibold">
                        Row {formatInt(row.row)}
                        <span className="sr-only"> {row.id}</span>
                      </th>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatMetres(row.length_m)}</td>
                      <td className={cn("py-2.5 pl-3", disruptedRow && "font-semibold")}>{structureLabel(row.structure)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
