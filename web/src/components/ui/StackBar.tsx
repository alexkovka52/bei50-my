export type StackSegment = {
  label: string;
  value: number;
  color: string;
};

type StackBarProps = {
  label: string;
  segments: StackSegment[];
};

export function StackBar({ label, segments }: StackBarProps) {
  const total = segments.reduce((sum, segment) => sum + (Number.isFinite(segment.value) ? Math.max(0, segment.value) : 0), 0);
  const text =
    total > 0
      ? segments
          .map((segment) => {
            const share = Math.round((Math.max(0, segment.value) / total) * 100);
            return `${segment.label} ${share}%`;
          })
          .join(", ")
      : "nothing to show";

  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-pill bg-unset" aria-hidden="true">
        {segments.map((segment) => (
          <div
            key={segment.label}
            style={{
              width: total > 0 ? `${(Math.max(0, segment.value) / total) * 100}%` : 0,
              background: segment.color,
            }}
          />
        ))}
      </div>
      <p className="sr-only">
        {label}: {text}
      </p>
    </div>
  );
}
