import { ImageResponse } from "next/og";
import { IconGlyph } from "./icon-glyph";

// This is the only icon iOS actually reads for "Add to Home Screen" — Next's
// apple-icon file convention auto-emits the corresponding <link
// rel="apple-touch-icon"> tag into the document head. Exactly 180x180,
// fully opaque (PITFALLS.md Pitfall 1).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<IconGlyph size={180} />, { ...size });
}
