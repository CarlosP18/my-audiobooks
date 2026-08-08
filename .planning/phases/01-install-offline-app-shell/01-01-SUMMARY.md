---
phase: 01-install-offline-app-shell
plan: 01
subsystem: ui
tags: [nextjs, tailwindcss, shadcn, pwa, ios, app-router, turbopack, pnpm]

# Dependency graph
requires: []
provides:
  - Next.js 16 App Router + TypeScript + Tailwind v4 + pnpm scaffold
  - shadcn/ui registry config (components.json) for Phase 2/3 to add components without reconfiguring
  - Locked design-token system (6 colors, 4 typography roles, 7 spacing steps) in app/globals.css
  - Final "My Library" empty-library screen (D-04), not a placeholder
  - Full iOS PWA installability metadata surface (manifest, apple-touch-icon, standalone meta tags)
  - Shared IconGlyph module (book + audio-wave) driving all three icon sizes
  - Dependency-free, fail-first installability gate (scripts/check-pwa-assets.mjs, verify:pwa script)
affects: [01-02-offline-service-worker, 02-import-library, 03-playback-resume]

# Actuals (#2632)
actuals:
  tokens: 7474
  tasks: 3
  commits: 2

# Tech tracking
tech-stack:
  added: [next@16.3.0, react@19.2.8, tailwindcss@4.3.3, lucide-react@1.30.0, shadcn (CLI, dev-only via pnpm dlx)]
  patterns:
    - "One shared IconGlyph module rendered at 180/192/512 so the home-screen icon and manifest icons cannot drift apart"
    - "Design tokens declared once in app/globals.css (Tailwind v4 CSS-first @theme), consumed by all later phases rather than reinvented"
    - "scripts/check-pwa-assets.mjs as the single, extensible installability harness — plan 01-02 appends a service-worker assertion to this same file"

key-files:
  created:
    - app/layout.tsx
    - app/page.tsx
    - app/manifest.ts
    - app/icon-glyph.tsx
    - app/apple-icon.tsx
    - app/pwa-icon/route.tsx
    - app/globals.css
    - components.json
    - scripts/check-pwa-assets.mjs
  modified:
    - package.json

key-decisions:
  - "Scaffolded into a temp sibling directory and moved generated files in, preserving .planning/ and .claude/ (repo was non-empty, create-next-app refuses to write into it)"
  - "shadcn CLI has moved to a new major-version architecture (base=radix/base/aria, named presets) that no longer accepts --style/--base-color flags; pinned shadcn@2 instead, which still writes the classic components.json shape (style/tailwind.baseColor/iconLibrary) the plan and Phase 2/3 depend on"
  - "shadcn@2 init failed after writing components.json because ui.shadcn.com is blocked by this environment's outbound proxy policy (403, not an npm registry issue); manually added lucide-react (the one dependency init would have installed for iconLibrary=lucide) since zero components are added in Phase 1"
  - "Next 16.3.0's Metadata API resolves appleWebApp.capable to the newer mobile-web-app-capable tag only, dropping the legacy apple-mobile-web-app-capable tag; added the legacy tag explicitly via metadata.other since PITFALLS.md Pitfall 1 and this plan's own verify gate require it for iOS versions before 17.4"
  - "Decorative empty-state glyph mark uses lucide-react's BookAudio icon (matches D-02's book + audio-wave concept) rather than re-rendering the IconGlyph SVG in the page — IconGlyph is reserved for the generative icon routes"

patterns-established:
  - "Icon generation: one IconGlyph({size}) component consumed by apple-icon.tsx (180x180) and pwa-icon/route.tsx (192/512 via ?size= query) — never duplicate the glyph definition"
  - "Installability verification: scripts/check-pwa-assets.mjs takes a base URL, prints one PASS/FAIL line per assertion, and exits non-zero on any failure — reusable against localhost, a deployed origin, or an arbitrary URL as a fail-first proof"

requirements-completed: [INST-01, INST-02]

coverage:
  - id: D1
    description: "Next.js App Router + Tailwind v4 + shadcn/ui scaffold builds and lints cleanly (pnpm build, pnpm lint)"
    requirement: INST-01
    verification:
      - kind: other
        ref: "pnpm build (exit 0), pnpm lint (no errors)"
        status: pass
    human_judgment: false
  - id: D2
    description: "GET / serves the final 'My Library' empty-library screen with all three locked copy strings and the locked dark-neutral color tokens"
    requirement: INST-01
    verification:
      - kind: e2e
        ref: "node scripts/check-pwa-assets.mjs http://localhost:3000 (copy + color assertions, all PASS)"
        status: pass
    human_judgment: false
  - id: D3
    description: "Served HTML declares apple-touch-icon (180x180 opaque PNG), apple-mobile-web-app-capable=yes, black-translucent status bar, theme-color #0A0A0A, and viewport-fit=cover"
    requirement: INST-01
    verification:
      - kind: e2e
        ref: "node scripts/check-pwa-assets.mjs http://localhost:3000 (meta-tag + PNG-IHDR assertions, all PASS)"
        status: pass
    human_judgment: false
  - id: D4
    description: "app/manifest.ts declares name 'My Audiobooks', display standalone, background/theme #0A0A0A, and 192/512 icon entries that resolve to real PNGs"
    requirement: INST-02
    verification:
      - kind: e2e
        ref: "node scripts/check-pwa-assets.mjs http://localhost:3000 (manifest assertions, all PASS)"
        status: pass
    human_judgment: false
  - id: D5
    description: "Installability gate fails first — exits non-zero against an origin that is not this app, so it cannot pass vacuously"
    verification:
      - kind: e2e
        ref: "node scripts/check-pwa-assets.mjs https://example.com (exit code 1)"
        status: pass
    human_judgment: false
  - id: D6
    description: "Real-device install and standalone-launch verification on a physical iPhone (Share -> Add to Home Screen, icon appearance, full-screen launch)"
    requirement: INST-01
    verification: []
    human_judgment: true
    rationale: "No physical iPhone is available in this execution environment; PITFALLS.md and STACK.md both flag real-device testing as non-negotiable for iOS PWA installability. This is deferred to plan 01-02's real-device verification step, which runs the identical scripts/check-pwa-assets.mjs gate against the deployed HTTPS origin plus manual Add-to-Home-Screen confirmation."

duration: 45min
completed: 2026-08-08
status: complete
---

# Phase 1 Plan 1: Install & Offline App Shell — Scaffold Summary

**Next.js 16 App Router PWA shell with locked dark-neutral design tokens, a shared book+audio-wave IconGlyph driving all icon sizes, full iOS installability metadata, and a dependency-free fail-first installability gate script**

## Performance

- **Duration:** ~45 min (this continuation dispatch, from checkpoint approval to plan completion)
- **Started:** 2026-08-08T01:15:00Z (scaffold began)
- **Completed:** 2026-08-08T01:23:42Z
- **Tasks:** 3 (Task 1 checkpoint approval, Task 2 tracer scaffold, Task 3 gate script)
- **Files modified:** 27 (25 in Task 2's commit, 2 in Task 3's commit)

## Accomplishments

- Scaffolded a Next.js 16.3.0 (App Router, Turbopack, TypeScript, Tailwind v4, ESLint) project with pnpm, preserving the existing `.planning/` and `.claude/` directories
- Initialized shadcn/ui's registry config (`components.json`: style=new-york, baseColor=neutral, cssVariables=true, iconLibrary=lucide) with zero components added — structural preset only, for Phase 2/3 to consume
- Declared the complete locked design-token system in `app/globals.css`: 6 colors, 4 typography roles, 7 spacing steps, Tailwind v4 CSS-first (`@theme`), no `tailwind.config.*`
- Built one shared `IconGlyph` component (merged open-book + audio-wave SVG path, opaque `#171717` fill, `#F5F5F5` mark) consumed identically by `app/apple-icon.tsx` (180x180) and `app/pwa-icon/route.tsx` (192/512 via query param) — the home-screen icon and manifest icons can never drift apart
- Wired `app/layout.tsx` with the full iOS standalone metadata surface (appleWebApp capable/statusBarStyle/title, viewport themeColor/viewportFit, self-hosted Geist Sans + Geist Mono via `next/font/google`, safe-area-inset-top padding) plus an explicit `apple-mobile-web-app-capable` tag to cover a Next 16 metadata-resolver gap
- Rendered the final "My Library" empty-library screen (`app/page.tsx`) per D-04 — the actual Phase 2 target layout, not a placeholder
- Built `app/manifest.ts` with `display: standalone`, `#0A0A0A` background/theme, and 192/512/maskable icon entries
- Wrote `scripts/check-pwa-assets.mjs`: a dependency-free, `node:`-builtins-only installability gate that fetches a base URL, decodes the apple-touch-icon's PNG IHDR to confirm exactly 180x180, validates the manifest shape and all five iOS meta tags, and prints one PASS/FAIL line per assertion — verified to pass 24/24 against the local build and fail-first (exit 1) against an unrelated origin
- Added the `verify:pwa` npm script

## Task Commits

Each task was committed atomically:

1. **Task 1: Verify package legitimacy before any install** — checkpoint, no commit (approved by human in a prior dispatch: "Aprobado, instalado" — see Deviations/Issues below)
2. **Task 2: Scaffold the project and render the installable "My Library" shell end-to-end** — `390f1e2` (feat)
3. **Task 3: Build the installability gate as a runnable script** — `cb2d89b` (feat)

**Plan metadata:** (this commit, made after this SUMMARY is written)

## Files Created/Modified

- `package.json` — pnpm manifest: next, react, react-dom, tailwindcss, lucide-react, dev typescript/eslint/eslint-config-next/@types/*; `verify:pwa` script
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` — generated
- `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `next-env.d.ts`, `.gitignore` — `create-next-app` output, unmodified
- `next.config.ts` — `create-next-app` output; plan 01-02 wraps it with Serwist
- `components.json` — shadcn registry config (style=new-york, baseColor=neutral, cssVariables=true, iconLibrary=lucide)
- `app/globals.css` — locked design tokens (6 colors, 4 typography roles, 7 spacing steps)
- `app/layout.tsx` — root layout: iOS PWA metadata, Geist fonts, safe-area padding
- `app/page.tsx` — the "My Library" empty-state screen
- `app/manifest.ts` — `MetadataRoute.Manifest`: standalone display, matching icon set
- `app/icon-glyph.tsx` — shared `IconGlyph` renderer
- `app/apple-icon.tsx` — 180x180 opaque apple-touch-icon route
- `app/pwa-icon/route.tsx` — 192/512 manifest icon route
- `scripts/check-pwa-assets.mjs` — dependency-free installability gate
- `AGENTS.md`, `CLAUDE.md` (root), `README.md`, `public/*.svg`, `app/favicon.ico` — standard `create-next-app` scaffold output, left as generated (root `CLAUDE.md` is a Next dev-generated pointer to `AGENTS.md`; it does not conflict with the project's own `.claude/CLAUDE.md`, which is untouched)

## Decisions Made

- **shadcn CLI version pin.** The latest `shadcn` CLI (v4.x) has moved to a new preset/base architecture (`radix`/`base`/`aria`, named presets like "Nova") that no longer produces the classic `components.json` shape (`style`, `tailwind.baseColor`, `iconLibrary`) this plan and downstream phases depend on. Pinned `pnpm dlx shadcn@2` instead, which still writes the required shape via `-y -d -b neutral`.
- **shadcn init dependency install done manually.** `shadcn@2 init` wrote `components.json` correctly, then failed fetching `https://ui.shadcn.com/r/index.json` (blocked by this environment's outbound proxy policy — confirmed via the proxy status endpoint, not an npm registry legitimacy issue). Since Task 2 explicitly adds zero shadcn components, the only dependency a successful init would have added is `lucide-react` (the configured icon library), which was installed directly via `pnpm add lucide-react` — the same already-approved package, no substitution.
- **Explicit legacy iOS meta tag.** Next.js 16.3.0's `appleWebApp.capable` metadata resolver only emits the newer, prefix-less `mobile-web-app-capable` tag (confirmed by reading `node_modules/next/dist/lib/metadata/metadata.js`). Added `apple-mobile-web-app-capable: yes` explicitly via `metadata.other` so the legacy tag PITFALLS.md Pitfall 1 and this plan's own `<verify>` gate require is still present for iOS versions before 17.4.
- **Decorative glyph in the empty state uses lucide-react's `BookAudio` icon**, not a re-render of the generative `IconGlyph`, to keep `IconGlyph` scoped to the icon routes it was designed for while still matching D-02's book+audio-wave concept in the UI.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Pinned an older shadcn CLI major version**
- **Found during:** Task 2, Step 2 (shadcn init)
- **Issue:** `pnpm dlx shadcn@latest init` failed validation — the current major version's `-b/--base` flag only accepts `radix|base|aria`, not `neutral`; there is no `--style` flag at all in the new preset-based architecture. The classic `components.json` shape the plan requires (style=new-york, tailwind.baseColor=neutral) is not produced by the latest CLI.
- **Fix:** Used `pnpm dlx shadcn@2 init -y -d -b neutral`, which still implements the classic init flow and wrote exactly the required `components.json`.
- **Files modified:** `components.json`
- **Verification:** `node -e` assertion on `components.json` fields (style/baseColor/cssVariables/tsx/iconLibrary) — PASS
- **Committed in:** `390f1e2` (Task 2 commit)

**2. [Rule 3 - Blocking] Manual lucide-react install after shadcn init's registry fetch was blocked**
- **Found during:** Task 2, Step 2 (shadcn init)
- **Issue:** After writing `components.json`, `shadcn@2 init` attempted to fetch `https://ui.shadcn.com/r/index.json` to install its base dependencies and failed with a 403 from this environment's outbound proxy (confirmed via `$HTTPS_PROXY/__agentproxy/status` — a policy denial on that host, not a package-legitimacy problem covered by Task 1's gate).
- **Fix:** Ran `pnpm add lucide-react` directly — the single dependency a successful zero-component init would have added, and the same package already approved in Task 1's legitimacy table. No new/different package was substituted.
- **Files modified:** `package.json`, `pnpm-lock.yaml`
- **Verification:** `pnpm build` and `pnpm lint` pass; `app/page.tsx` imports and renders `BookAudio` from `lucide-react` successfully
- **Committed in:** `390f1e2` (Task 2 commit)

**3. [Rule 2 - Missing Critical] Explicit apple-mobile-web-app-capable meta tag**
- **Found during:** Task 2, Step 8 (`app/layout.tsx`) verification — `grep -qi 'apple-mobile-web-app-capable'` against the served HTML failed
- **Issue:** Next.js 16.3.0's Metadata API resolves `appleWebApp.capable: true` to `<meta name="mobile-web-app-capable" content="yes">` only, not the legacy `apple-mobile-web-app-capable` tag. PITFALLS.md Pitfall 1 and this plan's own `must_haves.truths` explicitly require the apple-prefixed tag because iOS versions before 17.4 key standalone-launch detection off it — a missing capability tag is the documented usual cause of an "installed" app that still shows Safari's address bar.
- **Fix:** Added `other: { "apple-mobile-web-app-capable": "yes" }` to the `metadata` export in `app/layout.tsx`, alongside the existing `appleWebApp` block (which still correctly emits `apple-mobile-web-app-title` and `apple-mobile-web-app-status-bar-style`).
- **Files modified:** `app/layout.tsx`
- **Verification:** Rebuilt, restarted, re-fetched `/` — both `mobile-web-app-capable` and `apple-mobile-web-app-capable` now present; full `scripts/check-pwa-assets.mjs` run: 24/24 PASS
- **Committed in:** `390f1e2` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (2 blocking/Rule 3, 1 missing-critical/Rule 2)
**Impact on plan:** All three deviations were necessary to complete Task 2 as specified and to satisfy the plan's own acceptance criteria and threat-model mitigation (T-01-01, Spoofing — apple-touch-icon and manifest identity surface). No scope creep: no additional packages beyond the Task 1-approved table, no additional UI, no architecture change.

## Issues Encountered

- `ui.shadcn.com` is blocked by this execution environment's outbound proxy policy (403 on CONNECT, confirmed via the proxy status endpoint as a policy denial, not a TLS or npm-registry issue). This only affects the shadcn CLI's post-`components.json` dependency-install step, not npm package installs generally (which worked normally throughout via `registry.npmjs.org`, which is proxy-allowlisted). Documented above as deviation #2; no user action needed since the outcome (`components.json` correct, `lucide-react` installed) matches what a successful init would have produced.
- Port 3000 was left bound by a background `next start` process from an earlier verification pass mid-session; killed it before restarting to pick up the `apple-mobile-web-app-capable` fix. No lasting effect — purely a local verification-loop hiccup, not a deviation in the shipped code.

## User Setup Required

None — no external service configuration required. Deployment to Vercel and the real-device install/standalone-launch verification are plan 01-02's concern (see `## Next Phase Readiness` below and coverage item D6).

## Next Phase Readiness

- The app builds (`pnpm build`), lints clean (`pnpm lint`), and serves a fully installable shell at `/` with a passing `scripts/check-pwa-assets.mjs` run (24/24) against `http://localhost:3000`.
- `scripts/check-pwa-assets.mjs` is designed for plan 01-02 to extend with a two-line service-worker assertion rather than starting a second harness.
- Plan 01-02 still owns: the Serwist service worker (`app/sw.ts`, `next.config.ts` wrapper), a live HTTPS Vercel deployment, and the mandatory real-device iPhone verification (Add to Home Screen, icon appearance, standalone launch, offline shell load) — none of which is achievable from this execution environment.
- No blockers. Design tokens, the icon glyph module, and the shadcn registry config are locked and ready for Phase 2 (library list, Import CTA using the Accent token) and Phase 3 (player controls, Geist Mono already wired for timecode display).

## Self-Check: PASSED

All key files (`app/layout.tsx`, `app/page.tsx`, `app/manifest.ts`, `app/icon-glyph.tsx`, `app/apple-icon.tsx`, `app/pwa-icon/route.tsx`, `app/globals.css`, `components.json`, `scripts/check-pwa-assets.mjs`, `package.json`) confirmed present on disk. Both task commits (`390f1e2`, `cb2d89b`) confirmed present in `git log`.

---
*Phase: 01-install-offline-app-shell*
*Completed: 2026-08-08*
