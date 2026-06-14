import { ImageResponse } from "next/og";

export const alt =
  "NBIM Real Estate Map – Properties owned by Norway's sovereign wealth fund";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background:
            "radial-gradient(ellipse at 75% 30%, #1d4ed8 0%, transparent 55%), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
          color: "#f8fafc",
          fontFamily: "system-ui, -apple-system, Segoe UI, Roboto, sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 12,
              background: "#f8fafc",
              color: "#0f172a",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 28,
              fontWeight: 700,
            }}
          >
            N
          </div>
          <div
            style={{
              fontSize: 24,
              letterSpacing: 1.5,
              textTransform: "uppercase",
              color: "#cbd5f5",
              fontWeight: 600,
            }}
          >
            NBIM Real Estate Map
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 800,
              lineHeight: 1.05,
              maxWidth: 980,
              letterSpacing: -1.5,
            }}
          >
            Properties owned by Norway&apos;s $1.7T sovereign wealth fund.
          </div>
          <div
            style={{
              fontSize: 30,
              color: "#cbd5f5",
              lineHeight: 1.3,
              maxWidth: 900,
            }}
          >
            Explore an interactive map of NBIM-owned real estate in London,
            New York, Paris and more.
          </div>
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            color: "#94a3b8",
            fontSize: 22,
          }}
        >
          <div style={{ display: "flex", gap: 24 }}>
            <span>245+ cities</span>
            <span style={{ color: "#475569" }}>·</span>
            <span>15 countries</span>
            <span style={{ color: "#475569" }}>·</span>
            <span>Updated daily</span>
          </div>
          <div style={{ color: "#cbd5f5", fontWeight: 600 }}>
            nbim-map.vercel.app
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
