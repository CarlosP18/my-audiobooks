# Walking Skeleton — My Audiobooks

**Phase:** 1 (install-offline-app-shell)
**Generated:** 2026-08-08

## Capability Proven End-to-End

> One sentence: the smallest user-visible capability that exercises the full stack.

Carlos can add My Audiobooks to his iPhone home screen from Safari, tap the branded icon to launch it full-screen with no browser chrome, and open it again in airplane mode to see the "My Library" screen load from the service-worker cache.

This is the whole-application tracer. It proves the riskiest platform assumption (iOS Safari PWA installability + standalone launch + offline shell load) before Phase 2 or Phase 3 build a single feature on top of it. If any leg of this fails on real hardware, everything downstream is invalidated — which is exactly why it ships first.

## Architectural Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Framework | Next.js 16.x, App Router, Turbopack default, TypeScript | D-06 (CONTEXT.md) locks it for familiarity with the sibling `neoancestral` project. App Router gives `app/manifest.ts`, `app/apple-icon.tsx`, and `ImageResponse` icon generation with zero extra dependencies. Turbopack-default is what forces the Serwist choice below. |
| Package manager | pnpm | D-07 (CONTEXT.md) — matches `neoancestral`'s convention. |
| Styling / component system | Tailwind CSS v4 (CSS-first `@theme`) + shadcn/ui (`style: new-york`, `baseColor: neutral`, `cssVariables: true`, `tsx: true`, `iconLibrary: lucide`) | D-06. shadcn is initialized in Phase 1 but adds **zero components** — the empty-library screen is pure Tailwind typography/layout. Init now so Phase 2 (Button, Card) and Phase 3 (Slider, Button) can `shadcn add` without reconfiguring. Structural preset only — `neoancestral`'s color tokens and fonts are explicitly NOT copied. |
| Service worker | Serwist (`serwist` + `@serwist/next` 9.5.x), `swSrc: app/sw.ts` → `swDest: public/sw.js` | STACK.md: `next-pwa` is unmaintained and webpack-only, so it fights Next 16's Turbopack default. Serwist is the maintained Workbox-based successor with an official Next integration that injects the precache manifest at build time. |
| Cache boundary | Service-worker Cache Storage holds **static app-shell assets only** (JS/CSS/HTML/manifest/icons). User data never touches it. | PITFALLS.md Pitfall 6 — iOS Cache Storage is capped near 50MB per partition, while IndexedDB is orders of magnitude larger. This boundary is architectural, not stylistic: violating it produces early `QuotaExceededError` and silent data loss. |
| Data layer | **None in Phase 1.** IndexedDB via Dexie 4.4.x behind a single `lib/db.ts` chokepoint arrives in Phase 2. | Phase 1 has no persistence, no imports, no player — the shell is stateless. Recorded here so Phase 2 inherits the chokepoint decision rather than reinventing it. |
| Auth | **None, ever.** Single user, single device, no accounts. | PROJECT.md constraints — no backend, no account system exists to authenticate against. |
| Deployment target | Vercel, HTTPS origin | PROJECT.md Key Decisions: "Host on Vercel — Free, HTTPS out of the box, integrates cleanly with a Next.js app and GitHub." HTTPS is non-optional: service-worker registration and Add to Home Screen both silently fail without it. |
| Icon generation | Programmatic via `next/og` `ImageResponse` — one shared glyph module rendered at 180 / 192 / 512 | D-02 (code-generated, single-glyph, no external design tools). PITFALLS.md Pitfall 1: iOS ignores manifest icons entirely and reads only `<link rel="apple-touch-icon">`, so the 180x180 opaque `apple-icon` is the load-bearing asset and the manifest array is spec-compliance. |
| Directory layout | Flat App Router — `app/*` for routes, layout, metadata routes and icon routes; `scripts/*` for verification harnesses; `lib/*` reserved for Phase 2's storage chokepoint. | Smallest structure that fits a three-screen personal app. No feature-folder ceremony for a codebase this size. |
| Verification harness | `scripts/check-pwa-assets.mjs <baseUrl>` — dependency-free Node script, exits non-zero on any installability regression | Everything this phase ships is metadata that renders correctly or not at all. A repeatable CLI gate that runs against localhost AND the deployed origin is the only way later phases can prove they did not break installability. |

## Stack Touched in Phase 1

- [ ] Project scaffold (Next.js + TypeScript + Tailwind v4 + ESLint + pnpm, then shadcn init)
- [ ] Routing — one real route (`/`) rendering the final "My Library" empty-state screen, plus three metadata/icon routes (`/manifest.webmanifest`, `/apple-icon`, `/pwa-icon`)
- [ ] Database — **N/A in Phase 1** (no persistence exists; Dexie/IndexedDB lands in Phase 2). The Phase 1 substitute for a real read/write is the service-worker cache: a real precache write at install and a real cache read on an offline navigation.
- [ ] UI — the shell renders the locked layout and copy from `01-UI-SPEC.md`, not a placeholder screen (D-04)
- [ ] Deployment — deployed to a live HTTPS Vercel origin and verified on a physical iPhone

## Out of Scope (Deferred to Later Slices)

> Anything that is *not* in the skeleton. Explicit, so future phases do not re-litigate Phase 1's minimalism.

- IndexedDB / Dexie, `lib/db.ts`, any schema or migration (Phase 2)
- File import, the iOS file picker, Blob storage (Phase 2 — IMPT-01, IMPT-02)
- The library list, per-book titles, progress indicators, delete (Phase 2 — LIBR-01..05)
- The player, `<audio>`, transport controls, scrub bar, resume (Phase 3 — PLAY-01..06)
- MediaSession / lock-screen controls (v2, spike first)
- Any shadcn component — init only, zero components added
- Any "Import" CTA button (Phase 2 introduces it; Phase 1 renders no interactive control)
- Any offline banner or connectivity indicator (D-05 — the shell renders identically online and offline)
- Any install-instruction banner or standalone-mode detection UI (PITFALLS.md flags this as a good UX idea; it is not in Phase 1's requirements and is not being smuggled in)
- Storage-eviction handling and re-import recovery UX (Phase 2, where there is finally data to evict)
- Any analytics, telemetry, error reporting, or third-party script

## Architectural Constraints Later Phases Inherit

1. **The deployed origin binds all future storage.** IndexedDB and Cache Storage are origin-scoped. Changing the Vercel project name, moving to a custom domain, or switching hosts after Phase 2 orphans the user's entire library with no migration path — the user would have to delete the home-screen icon, re-install, and re-import every book. Phase 1 is the last cheap moment to change it, because there is no data yet. Lock the origin here.
2. **Cache Storage is app-shell only.** Phase 2 and Phase 3 must route every audio byte and every metadata record through IndexedDB. No audio ever passes through `app/sw.ts`.
3. **Design tokens are locked in `app/globals.css`.** The six colors, four typography roles, and seven spacing steps from `01-UI-SPEC.md` are the base design system, not Phase 1 decoration. Phase 2 and Phase 3 consume them; they do not invent new ones. Accent `#E8B34A` and Destructive `#DC2626` are declared now and deliberately render nowhere in Phase 1.
4. **No middleware exists yet.** If any phase adds `middleware.ts`, its matcher MUST exclude `manifest.webmanifest`, `sw.js`, and the icon routes — a matcher that swallows them breaks install and offline in production while still working in local dev (PITFALLS.md Integration Gotchas).
5. **Desktop and simulator testing is insufficient.** Every phase touching install, storage, or playback needs a physical-iPhone verification step in its acceptance criteria.

## Subsequent Slice Plan

Each later phase adds one vertical slice on top of this skeleton without altering its architectural decisions:

- **Phase 2 — Import & Library:** add `lib/db.ts` (Dexie, versioned from day one), an import control on the existing `/` screen, and the populated list state that replaces the empty state this phase ships. Reuses the layout, tokens, and service worker unchanged.
- **Phase 3 — Playback & Resume:** add a `/player/[id]` route owning a native `<audio>` element and the object-URL lifecycle, with throttled position writes through `lib/db.ts`. Reuses the layout, tokens, service worker, and Geist Mono (already wired in Phase 1 for timecode display).
