export function PageHeader({ title }: { title: string }) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <h1 className="m-0 font-display text-[40px] font-bold leading-none tracking-[-1px] text-forest">{title}</h1>
      <div className="flex w-full min-w-0 items-center gap-3 min-[701px]:w-auto" aria-hidden="true">
        <div className="h-11 w-full max-w-[300px] rounded-pill bg-paper min-[701px]:w-[300px]" />
        <div className="size-11 shrink-0 rounded-full bg-paper" />
        <div className="size-11 shrink-0 rounded-full bg-moss/30" />
      </div>
    </header>
  );
}
