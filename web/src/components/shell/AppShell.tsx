import type { ReactNode } from "react";
import { MainColumn } from "@/components/shell/MainColumn";
import { Rail } from "@/components/shell/Rail";

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-dvh bg-dew text-forest">
      <Rail />
      <MainColumn>{children}</MainColumn>
    </div>
  );
}
