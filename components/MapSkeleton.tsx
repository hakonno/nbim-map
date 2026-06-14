type MapSkeletonProps = {
  message?: string;
};

export default function MapSkeleton({
  message = "Loading city investment map…",
}: MapSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="map-skeleton relative flex h-[100dvh] min-h-[100svh] w-full overflow-hidden"
    >
      <span className="sr-only">{message}</span>

      <div aria-hidden="true" className="map-skeleton__pattern absolute inset-0" />

      <div
        aria-hidden="true"
        className="map-skeleton__pulse absolute inset-x-2 bottom-2 h-24 rounded-2xl border border-slate-200 bg-white/80 shadow-2xl backdrop-blur md:left-auto md:right-4 md:top-4 md:bottom-auto md:h-[min(58svh,30rem)] md:w-[360px]"
      />

      <div
        aria-hidden="true"
        className="map-skeleton__pulse pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 shadow-[0_0_0_8px_rgba(148,163,184,0.25),0_0_0_18px_rgba(148,163,184,0.12)]"
      />
    </div>
  );
}
