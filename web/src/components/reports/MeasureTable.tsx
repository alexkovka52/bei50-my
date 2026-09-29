type MeasureRow = { label: string; value: string };

export function MeasureTable({ title, rows }: { title: string; rows: MeasureRow[] }) {
  return (
    <section className="min-w-0 rounded-card bg-paper px-4 py-5 min-[700px]:px-7 min-[700px]:py-6">
      <h2 className="m-0 text-lg font-semibold">{title}</h2>
      <div className="min-w-0 overflow-x-auto">
        <table className="mt-3 w-full border-collapse text-[15px]">
          <caption className="sr-only">{title}</caption>
          <thead>
            <tr className="text-left text-[13px] text-ink-muted">
              <th scope="col" className="py-2.5 pr-3 font-medium">
                Measurement
              </th>
              <th scope="col" className="py-2.5 pl-3 text-right font-medium">
                Value
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-t border-line">
                <th scope="row" className="py-3 pr-3 text-left font-normal">
                  {row.label}
                </th>
                <td className="py-3 pl-3 text-right font-semibold whitespace-nowrap tabular-nums">{row.value}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
