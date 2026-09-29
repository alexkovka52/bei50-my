type StatProps = {
  label: string;
  value: string;
  unit?: string;
  note?: string;
};

export function Stat({ label, value, unit, note }: StatProps) {
  return (
    <div>
      <div className="text-sm text-ink-muted">{label}</div>
      <div className="font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest tabular-nums">
        {value}
        {unit ? <span className="text-[20px] font-semibold">{unit}</span> : null}
      </div>
      {note ? <div className="mt-1 text-[13px] text-ink-muted">{note}</div> : null}
    </div>
  );
}
