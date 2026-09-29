"use client";

import { ChevronDown, ChevronUp, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { BlockFacts, DisruptedBar } from "@/components/blocks/BlockFacts";
import { BlockMap } from "@/components/blocks/BlockMap";
import type { Block } from "@/lib/data/types";
import {
  blocksHeadingCount,
  blocksToCsv,
  filterBlocks,
  formatRowKm,
  nextSort,
  selectedBlockId,
  sortBlocks,
  type BlockSort,
  type BlockSortKey,
} from "@/lib/blocks/blocks";
import { formatHa, formatInt } from "@/lib/data/format";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const COLUMNS: { key: BlockSortKey; label: string; align: "left" | "right" }[] = [
  { key: "id", label: "Block", align: "left" },
  { key: "rows", label: "Rows", align: "right" },
  { key: "row_km", label: "Row length", align: "right" },
  { key: "plants", label: "Plants", align: "right" },
  { key: "disrupted_pct", label: "Disrupted rows", align: "left" },
  { key: "gaps", label: "Gaps", align: "right" },
  { key: "waste", label: "Waste", align: "right" },
  { key: "interrow_ha", label: "Inter-row", align: "right" },
];

function ariaSort(sort: BlockSort, key: BlockSortKey): "ascending" | "descending" | "none" {
  if (sort.key !== key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function downloadCsv(csv: string) {
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "dementra-blocks.csv";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

export function BlocksWorkspace({ blocks, initialSelected }: { blocks: Block[]; initialSelected: string | null }) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<BlockSort>({ key: "row_km", direction: "desc" });
  const [selectedId, setSelectedId] = useState<string | null>(() => selectedBlockId(blocks, initialSelected));

  useEffect(() => {
    if (!selectedId) return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("selected") === selectedId) return;
    url.searchParams.set("selected", selectedId);
    window.history.replaceState(null, "", `${url.pathname}?${url.searchParams.toString()}`);
  }, [selectedId]);

  const ordered = useMemo(() => sortBlocks(blocks, sort.key, sort.direction), [blocks, sort]);
  const visible = useMemo(() => filterBlocks(ordered, query), [ordered, query]);
  const selected = blocks.find((block) => block.id === selectedId) ?? null;

  function select(id: string) {
    setSelectedId(id);
  }

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 max-w-full flex-col gap-1 min-[720px]:flex-row min-[720px]:items-baseline min-[720px]:gap-4">
          <h1 className="m-0 font-display text-[32px] font-bold leading-none tracking-[-1px] text-forest min-[720px]:text-[40px]">
            Blocks
          </h1>
          <p className="m-0 max-w-full text-[15px] leading-snug text-ink-muted">{blocksHeadingCount(blocks.length, sort)}</p>
        </div>
        <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
          <label className="flex h-11 w-full max-w-[260px] items-center gap-2.5 rounded-pill bg-paper px-4 text-ink-muted focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-solid focus-within:outline-moss">
            <Search aria-hidden="true" size={18} strokeWidth={2} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Filter blocks"
              aria-label="Filter blocks"
              className="w-full border-0 bg-transparent text-[15px] text-forest outline-none placeholder:text-ink-muted"
            />
          </label>
          <Button
            type="button"
            onClick={() => downloadCsv(blocksToCsv(ordered))}
          >
            Export CSV
          </Button>
        </div>
      </header>

      <div className="grid min-w-0 items-start gap-[22px] min-[1201px]:grid-cols-[minmax(0,1fr)_380px]">
        <section className="min-w-0 overflow-hidden rounded-card bg-paper pt-2">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px] border-collapse text-sm">
              <caption className="sr-only">Vineyard blocks</caption>
              <thead>
                <tr className="text-[13px] text-ink-muted">
                  {COLUMNS.map((column) => {
                    const state = ariaSort(sort, column.key);
                    const active = sort.key === column.key;
                    return (
                      <th
                        key={column.key}
                        scope="col"
                        aria-sort={state}
                        className={cn("p-0 font-medium", column.key === "id" && "pl-1", column.key === "interrow_ha" && "pr-1")}
                      >
                        <button
                          type="button"
                          aria-sort={state}
                          aria-label={
                            active
                              ? `${column.label}, sorted ${sort.direction === "asc" ? "ascending" : "descending"}`
                              : `Sort by ${column.label}`
                          }
                          className={cn(
                            "inline-flex min-h-11 w-full items-center gap-1 bg-transparent px-3 text-[13px] font-medium text-ink-muted hover:text-forest",
                            column.align === "right" ? "justify-end text-right" : "justify-start text-left",
                            active && "text-forest",
                          )}
                          onClick={() => setSort((current) => nextSort(current, column.key))}
                        >
                          {column.label}
                          {active ? (
                            sort.direction === "asc" ? (
                              <ChevronUp aria-hidden="true" size={14} strokeWidth={1.8} />
                            ) : (
                              <ChevronDown aria-hidden="true" size={14} strokeWidth={1.8} />
                            )
                          ) : null}
                        </button>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {visible.map((block) => {
                  const isSelected = block.id === selectedId;
                  return (
                    <tr
                      key={block.id}
                      tabIndex={0}
                      aria-selected={isSelected}
                      onClick={() => select(block.id)}
                      onKeyDown={(event) => {
                        if (event.key !== "Enter" && event.key !== " ") return;
                        event.preventDefault();
                        select(block.id);
                      }}
                      className={cn("cursor-pointer border-t border-line outline-none", isSelected && "bg-dew")}
                    >
                      <th
                        scope="row"
                        className={cn(
                          "px-4 py-[13px] text-left font-semibold",
                          isSelected && "font-bold shadow-[inset_3px_0_0_#375534]",
                        )}
                      >
                        {block.id}
                      </th>
                      <td className="px-3 py-[13px] text-right tabular-nums">{formatInt(block.rows)}</td>
                      <td className="px-3 py-[13px] text-right whitespace-nowrap tabular-nums">{formatRowKm(block.row_km)}</td>
                      <td className="px-3 py-[13px] text-right tabular-nums">{formatInt(block.plants)}</td>
                      <td className="px-3 py-[13px]">
                        <DisruptedBar percent={block.disrupted_pct} />
                      </td>
                      <td className="px-3 py-[13px] text-right tabular-nums">{formatInt(block.gaps)}</td>
                      <td
                        className={cn(
                          "px-3 py-[13px] text-right tabular-nums",
                          block.waste > 0 ? "font-semibold text-[#A1321F]" : "text-ink-muted",
                        )}
                      >
                        {formatInt(block.waste)}
                      </td>
                      <td className="px-4 py-[13px] text-right whitespace-nowrap tabular-nums">{formatHa(block.interrow_ha)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {visible.length === 0 ? (
            <p className="m-0 px-4 py-6 text-sm text-ink-muted">No blocks match this filter.</p>
          ) : null}
          {query.trim() ? (
            <p className="m-0 px-4 pt-2.5 pb-3 text-[13px] text-ink-muted">
              Showing {formatInt(visible.length)} of {formatInt(blocks.length)} blocks
            </p>
          ) : (
            <div className="h-3" />
          )}
        </section>

        {selected ? (
          <aside
            aria-label={`Block ${selected.id}`}
            className="overflow-hidden rounded-card bg-paper min-[1201px]:sticky min-[1201px]:top-6"
          >
            <BlockMap block={selected} preview className="h-[190px] w-full" />
            <div className="px-[22px] py-5">
              <BlockFacts block={selected} level="h2" linkToPage />
            </div>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
