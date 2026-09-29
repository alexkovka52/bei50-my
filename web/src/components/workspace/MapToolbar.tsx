"use client";

import { ChevronLeft, Layers, Search } from "lucide-react";
import Link from "next/link";
import type { FormEvent } from "react";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";
import { ModeSwitch } from "./ModeSwitch";
import { focusRing, glassButton } from "./styles";

type MapToolbarProps = {
  farm: string;
  flown: string;
  query: string;
  mode: "2d" | "3d";
  layersOpen: boolean;
  onQuery: (value: string) => void;
  onSearch: () => void;
  onMode: (mode: "2d" | "3d") => void;
  onOpenLayers: () => void;
};

export function MapToolbar({ farm, flown, query, mode, layersOpen, onQuery, onSearch, onMode, onOpenLayers }: MapToolbarProps) {
  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSearch();
  }

  return (
    <header
      className={cn(
        "absolute top-4 right-4 left-4 z-20 flex items-center gap-2.5",
        "min-[1025px]:top-5 min-[1025px]:right-auto min-[1025px]:left-1/2 min-[1025px]:w-max min-[1025px]:-translate-x-1/2",
        "min-[1025px]:rounded-pill min-[1025px]:border min-[1025px]:border-[rgba(227,238,212,0.14)] min-[1025px]:bg-[rgba(15,42,29,0.72)]",
        "min-[1025px]:py-1.5 min-[1025px]:pr-1.5 min-[1025px]:pl-4 min-[1025px]:backdrop-blur-[16px]",
      )}
    >
      <Link href="/" aria-label="Back to overview" className={cn(glassButton, "min-[1025px]:hidden")}>
        <ChevronLeft aria-hidden="true" size={20} strokeWidth={2} />
      </Link>
      <Link
        href="/"
        aria-label="Back to overview"
        className={cn("hidden size-11 items-center justify-center rounded-full min-[1025px]:inline-flex", focusRing)}
      >
        <BrandMark variant="dark" size={26} />
      </Link>
      <div className="hidden pr-1.5 text-[15px] font-semibold min-[1025px]:block">{farm}</div>
      <form role="search" onSubmit={onSubmit} className="min-w-0 flex-1 min-[1025px]:w-60 min-[1025px]:flex-none">
        <label
          className="flex h-11 items-center gap-2 rounded-pill border border-[rgba(227,238,212,0.14)] bg-[rgba(15,42,29,0.76)] px-3.5 text-mist backdrop-blur-[16px] min-[1025px]:border-transparent min-[1025px]:bg-[rgba(227,238,212,0.08)]"
        >
          <Search aria-hidden="true" size={16} strokeWidth={2} />
          <input
            value={query}
            onChange={(event) => onQuery(event.target.value)}
            aria-label="Find a block or row"
            placeholder="Find a block or row"
            autoComplete="off"
            spellCheck={false}
            className={cn("w-full min-w-0 border-0 bg-transparent text-sm text-dew outline-none placeholder:text-mist", focusRing)}
          />
        </label>
      </form>
      <button
        type="button"
        className={cn(glassButton, "min-[1025px]:hidden")}
        aria-label="Layers"
        aria-expanded={layersOpen}
        aria-controls="layers-sheet"
        onClick={onOpenLayers}
      >
        <Layers aria-hidden="true" size={20} strokeWidth={1.8} />
      </button>
      <ModeSwitch value={mode} onChange={onMode} />
      <div className="hidden px-2.5 text-[13px] text-mist min-[1025px]:block">{flown}</div>
    </header>
  );
}
