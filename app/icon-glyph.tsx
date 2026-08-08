// Shared glyph renderer consumed by every icon route (apple-icon, pwa-icon) so the
// home-screen icon and the manifest icons can never drift apart (D-02).
//
// A single merged SVG path: an open-book silhouette (two mirrored page shapes)
// with vertical audio-wave bars rising from the spine. One flat foreground
// color on a fully opaque background fill — no gradients, no alpha, no
// drop shadow. iOS renders any non-opaque icon pixel as pure black, so the
// background below is a plain hex fill and nothing else.
export function IconGlyph({ size }: { size: number }) {
  // Centred safe area of ~70% of the canvas — iOS applies its own
  // corner-radius mask on top, so nothing load-bearing sits within ~15%
  // of any edge.
  const safe = Math.round(size * 0.7);

  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "#171717",
      }}
    >
      <svg
        width={safe}
        height={safe}
        viewBox="0 0 100 100"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M6 24 L48 16 L48 78 L6 86 Z M94 24 L52 16 L52 78 L94 86 Z M44 38 L44 62 M52 32 L52 68 M60 38 L60 62 M68 44 L68 56"
          stroke="#F5F5F5"
          strokeWidth="6"
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="none"
        />
      </svg>
    </div>
  );
}
