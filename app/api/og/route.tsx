import { ImageResponse } from "next/og"

// Dynamic Open Graph image for blog posts (and any page that passes ?title=).
// Renders a branded 1200x630 card so every post has a unique social/AI card
// instead of the shared meta-banner. Edge runtime = fast, cacheable.
export const runtime = "edge"

export function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const rawTitle = searchParams.get("title") || "Risk-Averse Lead Engine For Your Business"
  const title = rawTitle.length > 130 ? rawTitle.slice(0, 127) + "…" : rawTitle
  const tag = (searchParams.get("tag") || "").split(",")[0].trim()

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px",
          background: "linear-gradient(135deg, #18042A 0%, #2E0A4F 55%, #701CC0 100%)",
          color: "#EFF3FF",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <div style={{ display: "flex", fontSize: 46, fontWeight: 800, letterSpacing: "-0.02em" }}>Vierra</div>
          <div style={{ display: "flex", fontSize: 22, color: "#C99DFF", textTransform: "uppercase", letterSpacing: "0.24em" }}>
            {tag || "Blog"}
          </div>
        </div>
        <div style={{ display: "flex", fontSize: title.length > 70 ? 58 : 70, fontWeight: 800, lineHeight: 1.08, maxWidth: "1010px" }}>
          {title}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: 26, color: "#C99DFF" }}>
          <div style={{ display: "flex", width: 14, height: 14, borderRadius: "50%", background: "#8F42FF" }} />
          Risk-Averse Lead Engine · vierradev.com
        </div>
      </div>
    ),
    { width: 1200, height: 630 }
  )
}
