import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";

export function StatusCard({ headline, detail }: { headline: string; detail: string }) {
  return (
    <Card className="flex flex-col gap-[18px]">
      <p className="m-0 max-w-[640px] font-display text-[28px] font-[650] leading-[1.1] tracking-[-0.6px] text-forest min-[701px]:text-[34px]">
        {headline}
      </p>
      <p className="m-0 max-w-[640px] text-base leading-normal text-ink-muted">{detail}</p>
      <div className="flex flex-wrap gap-3">
        <Button href="/walks">Start inspector walk</Button>
        <Button href="/walks#tasks" variant="outline">
          See all tasks
        </Button>
      </div>
    </Card>
  );
}
