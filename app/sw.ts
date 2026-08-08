import { defaultCache } from "@serwist/next/worker";
import { installSerwist } from "@serwist/sw";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";

// The app-shell precache manifest is injected here at build time by
// @serwist/next (see next.config.ts, swSrc -> swDest). Cache Storage on
// this worker holds static app-shell assets ONLY (JS/CSS/HTML/manifest/
// icons) — never route audio bytes or any user data through this file.
// See PITFALLS.md Pitfall 6 and SKELETON.md Architectural Constraint 2.
declare const self: ServiceWorkerGlobalScope &
  SerwistGlobalConfig & {
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  };

installSerwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // Exactly the default Next.js runtime-caching strategy for the app
  // shell's own requests — no bespoke route is added here. A personal
  // single-user app should take a new deploy immediately rather than
  // strand the user on a stale shell (see PITFALLS.md Recovery
  // Strategies), which is why skipWaiting + clientsClaim are both on.
  runtimeCaching: defaultCache,
});
