import type { Metadata } from "next";
import { MeasureTable } from "@/components/reports/MeasureTable";
import { PrintButton } from "@/components/reports/PrintButton";
import { AppShell } from "@/components/shell/AppShell";
import { EmptyState } from "@/components/shell/EmptyState";
import { TopBar } from "@/components/shell/TopBar";
import { dataUrl } from "@/lib/data/client";
import { formatDay } from "@/lib/data/format";
import { getSummary } from "@/lib/data/server";
import { cn } from "@/lib/utils";
import { describeDownloads, readPublishedFiles } from "./downloads";
import { measurementTables } from "./measurements";
import styles from "./print.module.css";

export const metadata: Metadata = {
  title: "Reports",
  description: "Measurements, downloads and a printable summary of the published flight.",
};

export default async function ReportsPage() {
  const [summary, files] = await Promise.all([getSummary(), readPublishedFiles()]);
  const downloads = describeDownloads(files);
  const tables = summary ? measurementTables(summary) : null;

  if (!tables && downloads.length === 0) {
    return (
      <AppShell>
        <TopBar title="Reports" />
        <EmptyState heading="No report published">
          Measurements, downloads and a printable summary appear after <code>siret3 web-bundle</code> publishes a flight.
        </EmptyState>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <TopBar title="Reports" />
      <div className={cn("flex min-w-0 flex-col gap-[22px]", styles.sheet)}>
        {summary ? (
          <div className="hidden print:block">
            <p className="m-0 font-display text-[28px] font-bold">Reports</p>
            <p className="mt-1 mb-0 text-sm">{summary.farm}</p>
            <p className="mt-1 mb-0 text-sm">Flown {formatDay(summary.flown_on)}</p>
          </div>
        ) : null}

        {tables ? (
          <div className={cn("flex justify-end", styles.hide)}>
            <PrintButton />
          </div>
        ) : (
          <EmptyState heading="No report published">
            Measurements and a printable summary appear after <code>siret3 web-bundle</code> publishes a flight.
          </EmptyState>
        )}

        {tables ? (
          <div className={cn("grid gap-[22px] min-[800px]:grid-cols-2", styles.columns)}>
            <MeasureTable title="Survey" rows={tables.survey} />
            <MeasureTable title="Counts" rows={tables.counts} />
            <MeasureTable title="Inter-row cover" rows={tables.cover} />
            <MeasureTable title="Row structure" rows={tables.structure} />
          </div>
        ) : null}

        {downloads.length > 0 ? (
          <section className={cn("min-w-0 rounded-card bg-paper px-7 py-6", styles.hide)}>
            <h2 className="m-0 text-lg font-semibold">Downloads</h2>
            <p className="mt-1 mb-0 text-sm text-ink-muted">Every file published with this flight.</p>
            <div className="mt-3 min-w-0 overflow-x-auto">
              <table className="w-full min-w-[420px] border-collapse text-[15px]">
                <caption className="sr-only">Published data files</caption>
                <thead>
                  <tr className="text-left text-[13px] text-ink-muted">
                    <th scope="col" className="py-2.5 pr-3 font-medium">
                      File
                    </th>
                    <th scope="col" className="py-2.5 pl-3 text-right font-medium">
                      Size
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {downloads.map((file) => (
                    <tr key={file.path} className="border-t border-line">
                      <th scope="row" className="py-3 pr-3 text-left font-normal">
                        <a href={dataUrl(file.path)} download={file.path.split("/").pop()} className="font-semibold no-underline">
                          {file.label}
                        </a>
                        <div className="text-[13px] font-normal text-ink-muted">{file.path}</div>
                      </th>
                      <td className="py-3 pl-3 text-right whitespace-nowrap tabular-nums">{file.size}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </div>
    </AppShell>
  );
}
