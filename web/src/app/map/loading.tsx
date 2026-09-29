export default function MapLoading() {
  return (
    <main id="main" tabIndex={-1} aria-busy="true" className="fixed inset-0 overflow-hidden bg-forest text-dew">
      <h1 className="sr-only">Map</h1>
      <p className="sr-only">Loading the map.</p>
      <div className="absolute top-4 right-4 left-4 z-20 flex items-center gap-2.5">
        <div className="size-11 shrink-0 rounded-full bg-[rgba(15,42,29,0.76)]" />
        <div className="h-11 min-w-0 flex-1 rounded-pill bg-[rgba(15,42,29,0.76)]" />
        <div className="h-11 w-24 shrink-0 rounded-pill bg-[rgba(15,42,29,0.76)]" />
      </div>
    </main>
  );
}
