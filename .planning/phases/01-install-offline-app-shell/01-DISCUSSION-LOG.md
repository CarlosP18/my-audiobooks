# Phase 1: Install & Offline App Shell - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-08-07
**Phase:** 1-Install & Offline App Shell
**Areas discussed:** App name and icon, Shell screen content, Scaffold conventions

---

## App Name and Icon

| Option | Description | Selected |
|--------|-------------|----------|
| My Audiobooks | Matches the repo/project name | ✓ |
| Audiobooks | Shorter, fits better under the icon on small screens | |

**User's choice:** My Audiobooks

| Option | Description | Selected |
|--------|-------------|----------|
| Simple/minimalist, generated | A simple glyph (book + audio waves) in a solid color, generated as SVG/PNG by code — no external design needed | ✓ |
| User supplies an image | User shares an icon file, resized to iOS's required sizes | |
| Claude decides | No preference | |

**User's choice:** Simple/minimalist, generated

| Option | Description | Selected |
|--------|-------------|----------|
| Dark neutral | Black/graphite — typical audio-app aesthetic, comfortable for night use | ✓ |
| Other specific color | User names a color | |
| Claude decides | No preference | |

**User's choice:** Dark neutral (black/graphite)

**Notes:** None.

---

## Shell Screen Content

| Option | Description | Selected |
|--------|-------------|----------|
| Empty library structure | Already show the final layout (title "My Library", empty list area) with an empty state ("No audiobooks yet") so Phase 2 only fills the list | ✓ |
| Generic "coming soon" screen | Simple splash with the app name only, no commitment to the final library layout yet | |

**User's choice:** Empty library structure

| Option | Description | Selected |
|--------|-------------|----------|
| Loads normally, no indicator | Shell loads from cache with no network-state indicator — nothing in this phase depends on the network | ✓ |
| Subtle offline-mode indicator | Small text/icon confirming the cached version is being shown | |

**User's choice:** Loads normally, no indicator

**Notes:** None.

---

## Scaffold Conventions

| Option | Description | Selected |
|--------|-------------|----------|
| Next.js + Tailwind + shadcn/ui | Same stack as the sibling project (neoancestral) — familiar, and shadcn provides accessible components (buttons, sliders) useful for the future player | ✓ |
| Next.js minimal, no UI library | Just Next.js + plain CSS/Tailwind — fewer dependencies for a small personal app | |

**User's choice:** Next.js + Tailwind + shadcn/ui

| Option | Description | Selected |
|--------|-------------|----------|
| pnpm | Matches neoancestral's lockfile convention | ✓ |
| npm | Default, no extra install | |

**User's choice:** pnpm

**Notes:** None.

---

## Claude's Discretion

- Exact icon glyph design, spacing, and generated asset sizes (within "simple/minimalist, dark neutral" direction)
- Exact `create-next-app` scaffold flags (TypeScript, ESLint, directory structure) — follow standard conventions consistent with neoancestral

## Deferred Ideas

None — discussion stayed within phase scope.
