"use client";

import { FileText, Footprints, LayoutDashboard, Map, Rows3, ScanEye, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BrandMark } from "@/components/BrandMark";
import { cn } from "@/lib/utils";

const ITEMS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/", label: "Overview", icon: LayoutDashboard },
  { href: "/map", label: "Map", icon: Map },
  { href: "/walks", label: "Walks", icon: Footprints },
  { href: "/blocks", label: "Blocks", icon: Rows3 },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/ai", label: "AI", icon: ScanEye },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function Rail() {
  const pathname = usePathname();

  return (
    <nav aria-label="Main" className="flex w-[88px] shrink-0 flex-col items-center gap-1.5 py-6">
      <Link href="/" aria-label="Dementra" className="mb-[22px] rounded-item text-forest no-underline">
        <BrandMark variant="light" size={36} />
      </Link>
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        const Icon = item.icon;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex w-16 min-h-[60px] flex-col items-center justify-center gap-1 rounded-item text-[11px] leading-none no-underline",
              active ? "bg-forest text-dew" : "text-ink-muted hover:bg-paper",
            )}
          >
            <Icon aria-hidden="true" size={22} strokeWidth={1.8} />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
