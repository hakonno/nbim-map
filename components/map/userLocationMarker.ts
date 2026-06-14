// Shared "little man" location marker markup, used by both map engines
// (MapLibre via a custom HTMLElement, Leaflet via L.divIcon). Styling lives in
// app/globals.css under `.nbim-user-location`. The position is drawn entirely
// client-side and is never transmitted anywhere — that's the privacy guarantee.

export const USER_LOCATION_MARKER_HTML = `
  <span class="nbim-user-location__pulse" aria-hidden="true"></span>
  <span class="nbim-user-location__badge" aria-hidden="true">
    <svg viewBox="0 0 24 24" width="16" height="16">
      <path fill="currentColor" d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm0 2c-3.4 0-8 1.7-8 5v.5A1.5 1.5 0 0 0 5.5 21h13a1.5 1.5 0 0 0 1.5-1.5V19c0-3.3-4.6-5-8-5Z"/>
    </svg>
  </span>
`;

/** Build the DOM element MapLibre's Marker wraps around. */
export function createUserLocationElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "nbim-user-location";
  el.setAttribute("role", "img");
  el.setAttribute("aria-label", "Your location");
  el.innerHTML = USER_LOCATION_MARKER_HTML;
  return el;
}
