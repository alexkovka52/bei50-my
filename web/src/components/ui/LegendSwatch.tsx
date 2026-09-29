type LegendSwatchProps = {
  color: string;
  label: string;
  bordered?: boolean;
};

export function LegendSwatch({ color, label, bordered = false }: LegendSwatchProps) {
  return (
    <span className="inline-flex items-center gap-2 text-sm text-forest">
      <span
        aria-hidden="true"
        className="size-3.5 shrink-0 rounded-[4px]"
        style={{
          background: color,
          border: bordered ? "1px solid #0F2A1D" : undefined,
        }}
      />
      {label}
    </span>
  );
}
