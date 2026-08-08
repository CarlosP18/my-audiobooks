import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

// Serwist compiles app/sw.ts (swSrc) into public/sw.js (swDest) at build
// time, injecting the precache manifest for the app shell.
//
// Constraint for any future phase: if middleware.ts is ever added, its
// matcher MUST explicitly exclude the manifest route (/manifest.webmanifest),
// the worker script (/sw.js), and the icon routes (/apple-icon, /pwa-icon).
// A matcher that swallows them breaks install and offline in production
// while continuing to work in local development (PITFALLS.md Integration
// Gotchas; SKELETON.md Architectural Constraint 4). No middleware exists
// yet in Phase 1.
const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
});

export default withSerwist(nextConfig);
