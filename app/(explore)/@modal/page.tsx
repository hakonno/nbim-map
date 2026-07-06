// Explicit match for "/" in the modal slot. On soft navigation, parallel-route
// slots RETAIN their previous content when nothing matches — so navigating
// from an open /property/[id] panel back to "/" must actively match here and
// render nothing, or the panel would stay stuck open (default.tsx only covers
// hard loads).
export default function EmptyModal() {
  return null;
}
