---
schema_version: 1
open_count: 2
waived_count: 0
fixed_count: 0
total_count: 2
last_updated: 2026-08-09T02:04:06.667Z
---

# Broken Windows Ledger

> Cross-phase defect register. `/gsd-ship` blocks while `open_count > 0`.
> Waive with `gsd-tools windows waive <id> "<reason>"` (reason required).
> Mark fixed with `gsd-tools windows fixed <id>`.

| id | phase | kind | file | line | description | status | reason | recorded_at | resolved_at |
|----|-------|------|------|------|-------------|--------|--------|-------------|-------------|
| 1 | 02 | unrun-verify | app/page.tsx |  | Task 2 human-check: physical-iPhone import/persistence verification (real .mp3/.m4a/.m4b, force-quit/relaunch) not performed — no iPhone available in this environment | open |  | 2026-08-09T02:04:06.488Z |  |
| 2 | 02 | deviation | scripts/check-pwa-assets.mjs |  | pnpm verify:pwa fails 2/27 assertions (empty-state text absent from raw SSR HTML) — expected consequence of useLiveQuery's undefined-first-render design (Pattern 2), not a regression; 25/27 installability assertions still pass | open |  | 2026-08-09T02:04:06.667Z |  |

````json
[
  {
    "id": 1,
    "kind": "unrun-verify",
    "phase": "02",
    "file": "app/page.tsx",
    "line": null,
    "description": "Task 2 human-check: physical-iPhone import/persistence verification (real .mp3/.m4a/.m4b, force-quit/relaunch) not performed — no iPhone available in this environment",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T02:04:06.488Z",
    "resolved_at": null
  },
  {
    "id": 2,
    "kind": "deviation",
    "phase": "02",
    "file": "scripts/check-pwa-assets.mjs",
    "line": null,
    "description": "pnpm verify:pwa fails 2/27 assertions (empty-state text absent from raw SSR HTML) — expected consequence of useLiveQuery's undefined-first-render design (Pattern 2), not a regression; 25/27 installability assertions still pass",
    "status": "open",
    "reason": "",
    "recorded_at": "2026-08-09T02:04:06.667Z",
    "resolved_at": null
  }
]
````
