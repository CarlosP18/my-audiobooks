import { ImageResponse } from "next/og";
import { IconGlyph } from "../icon-glyph";

// Serves the manifest's icon array (192x192 and 512x512). iOS ignores
// manifest icons entirely for the home-screen icon — see app/apple-icon.tsx
// for the icon that actually matters — but these must still be correct for
// spec compliance and any non-iOS consumer of the manifest.
const ALLOWED_SIZES = [192, 512] as const;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sizeParam = Number(searchParams.get("size"));

  if (!ALLOWED_SIZES.includes(sizeParam as (typeof ALLOWED_SIZES)[number])) {
    return new Response("Invalid size. Must be 192 or 512.", { status: 400 });
  }

  return new ImageResponse(<IconGlyph size={sizeParam} />, {
    width: sizeParam,
    height: sizeParam,
  });
}
