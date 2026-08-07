# Phase 1: Install & Offline App Shell - Context

**Gathered:** 2026-08-07
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver an installable, standalone, offline-launching PWA app shell on iPhone (INST-01, INST-02, INST-03). No library, no import, no player yet — those are Phase 2 and Phase 3. This phase proves the riskiest platform assumption (iOS Safari PWA installability + offline shell load) before any product feature is built on top of it.

</domain>

<decisions>
## Implementation Decisions

### App Identity
- **D-01:** App name shown under the home-screen icon is "My Audiobooks".
- **D-02:** Icon is simple/minimalist and code-generated — a single glyph (book + audio waves) in a solid color, produced as SVG/PNG assets without needing external design tools or user-supplied artwork.
- **D-03:** Theme/accent color is dark neutral (black/graphite) — used for splash screen background and status bar styling.

### Shell Screen Content
- **D-04:** The shell already renders the final empty-library layout (page title "My Library", empty list area with an "No audiobooks yet" empty state) rather than a generic placeholder/"coming soon" screen. Phase 2 fills the list; it does not rebuild the shell. — **Reversibility:** reversible — pure UI, easy to restyle later.
- **D-05:** Opening the app offline loads normally from the service worker cache with no special offline-mode indicator or banner. Nothing in this phase depends on the network anyway.

### Scaffold Conventions
- **D-06:** Repo is scaffolded as Next.js (App Router) + Tailwind CSS + shadcn/ui, matching the user's other project (neoancestral) for familiarity and to get accessible, ready-made components (buttons, sliders) that Phase 3's player will need.
- **D-07:** Package manager is pnpm, matching neoancestral's convention.

### Claude's Discretion
- Exact glyph design, spacing, and generated icon sizes (all required iOS sizes: 180×180 `apple-touch-icon`, plus standard PWA manifest sizes) are Claude's call within the "simple/minimalist, dark neutral" direction above.
- Exact Next.js/Tailwind/shadcn scaffold options (TypeScript, ESLint config, directory structure) follow standard `create-next-app` conventions consistent with neoancestral's existing setup.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Research (this project)
- `.planning/research/STACK.md` — stack recommendation: Next.js + Serwist for the service worker (not `next-pwa`, unmaintained/webpack-only), rationale and version notes
- `.planning/research/PITFALLS.md` — iOS Safari PWA installability pitfalls: manifest icons are ignored by iOS, `apple-touch-icon` link tag is required separately; no native install-prompt UI; storage/eviction and autoplay pitfalls relevant to later phases
- `.planning/research/SUMMARY.md` — synthesized roadmap implications, confirms Phase 1 should validate installability first since failure here invalidates everything downstream

### Project-Level
- `.planning/PROJECT.md` — Core Value, constraints (iPhone Safari only, no native app, no backend)
- `.planning/REQUIREMENTS.md` — INST-01, INST-02, INST-03 definitions

</canonical_refs>

<code_context>
## Existing Code Insights

Repo is currently empty (no commits with code, only `.planning/` and `.claude/CLAUDE.md`). No existing code to reuse or established patterns to follow within this repo. Scaffold conventions above intentionally borrow from the sibling `neoancestral` project's stack choice (Next.js + Tailwind + shadcn/ui + pnpm) for consistency, not from any shared code.

### Integration Points
- This phase establishes `app/manifest.ts` (or `public/manifest.json`), an `apple-touch-icon`, and the Serwist service worker registration — all of which Phase 2 and Phase 3 build directly on top of without modification.

</code_context>

<specifics>
## Specific Ideas

- Icon concept: a book paired with audio waves, single solid color, no gradients or photographic elements — keep it simple enough to render cleanly at small iOS icon sizes.
- Dark neutral theme (black/graphite) should carry through consistently: splash screen background, `theme-color` meta tag, and status bar style.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Install & Offline App Shell*
*Context gathered: 2026-08-07*
