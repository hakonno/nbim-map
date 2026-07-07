type MapSkeletonProps = {
  message?: string;
};

// Calm placeholder while the map chunk loads: the soft basemap-toned backdrop
// (see .map-skeleton in globals.css) and a single pulsing "pin". No fake UI —
// phantom panels only flash-then-vanish when the real map mounts.
export default function MapSkeleton({ message = "Loading map…" }: MapSkeletonProps) {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-busy="true"
      className="map-skeleton absolute inset-0 overflow-hidden"
    >
      <span className="sr-only">{message}</span>

      <div
        aria-hidden="true"
        className="map-skeleton__pulse pointer-events-none absolute left-1/2 top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-slate-400 shadow-[0_0_0_8px_rgba(148,163,184,0.25),0_0_0_18px_rgba(148,163,184,0.12)]"
      />
    </div>
  );
}
