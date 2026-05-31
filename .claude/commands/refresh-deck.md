---
description: Audit the workshop deck for drift against its sources. Args: empty (whole deck), `MM` (one module), `MM.NN` (one slide). Produces a Markdown report under docs/refresh-reports/.
argument-hint: "[MM | MM.NN]"
allowed-tools: Read, Bash, Write, Agent
---

# /refresh-deck — Deck Drift Audit

User input: `$ARGUMENTS`

You are the orchestrator for a deck-refresh audit. Your job: parse the scope, dispatch parallel `slide-refresh-worker` subagents, aggregate their reports, and write the final document.

## 1. Parse scope

Trim `$ARGUMENTS`. Then:

- empty → **whole-deck mode**
- matches `^\d{2}$` (e.g. `02`) → **single-module mode**, module = the value
- matches `^\d{2}\.\d{2}$` (e.g. `02.05`) → **single-slide mode**, slide = the value
- anything else → reply with `Usage: /refresh-deck [MM | MM.NN]` and stop

## 2. Enumerate modules

Read `src/lib/manifest.ts` to learn which modules and slides exist. The manifest is a TypeScript array of `{index, title, slides[]}`. Module indices are: 0, 1, 2, 3, 4, 5, 6, 99.

For whole-deck: dispatch one worker per module, all 8 in parallel.
For single-module: dispatch one worker for that module.
For single-slide: dispatch one worker with `slide=NN.MM`.

## 3. Dispatch workers (PARALLEL)

For whole-deck mode, you MUST send all 8 Agent calls in a SINGLE message (parallel tool use), not one after another. Each call:

```
Agent({
  subagent_type: "slide-refresh-worker",
  description: "Audit module 02",
  prompt: "Audit module=02. Use Glob to find all src/content/02-*.mdx files. Run the full Phase A→D procedure for each slide. Return your Markdown output verbatim — no preamble, no closing."
})
```

For single-slide mode, the prompt becomes `"Audit slide=02.05. Read src/content/02-05-*.mdx and run the full procedure."`.

## 4. Aggregate

Each worker returns a Markdown string. Collect them in module order: 00, 01, 02, 03, 04, 05, 06, 99.

Parse each module summary line by line to count totals:
- ✅ current
- ⚠ minor
- 🔴 outdated
- 💀 tote Links
- ⏳ pending

Compute total slides checked = sum of "Slides geprüft" across modules.

Identify Top-Prioritäten: every slide marked `🔴` — extract its `MM.NN` ID + one-line reason from the first finding.

## 5. Pick output filename

```bash
DATE=$(date +%Y-%m-%d)
TIME=$(date +%H%M)
```

If `docs/refresh-reports/${DATE}-deck-refresh.md` does NOT exist → use that filename.
Otherwise → use `docs/refresh-reports/${DATE}-${TIME}-deck-refresh.md`.

## 6. Write the report

Use Write tool to create the report file with this structure:

```markdown
# Slide Refresh Report — <YYYY-MM-DD>

**Lauf:** <HH:MM lokale Zeit> · ~<duration> · <N> parallele Worker
**Scope:** <whole deck | module NN | slide NN.MM>

## Executive Summary

| Status | Slides | Anteil |
|---|---|---|
| ✅ current | N | NN % |
| ⚠ minor drift | N | NN % |
| 🔴 outdated | N | NN % |
| 💀 tote Links | N | — |
| ⏳ pending | N | — |

**Top-Prioritäten:**

1. 🔴 02.05 Modellauswahl — Sonnet 4.6 → 4.7
2. 🔴 ...
3. ...

(falls 0 🔴: "Keine outdated-Slides — Deck ist auf Stand der geprüften Quellen.")

## Per-Modul

<aggregated worker outputs verbatim>

---

**Legende:** ✅ aligned · ⚠ unklar/leichte Drift · 🔴 widersprochen · 💀 tote Quelle · ⏳ check pending
```

## 7. Confirm to user

After writing, output a short summary message to the user:

```
✓ Refresh-Lauf abgeschlossen.

Report: docs/refresh-reports/<filename>
Slides geprüft: N · ✅ N · ⚠ N · 🔴 N · 💀 N

Top-Prio:
- 02.05 Modellauswahl
- ...

Nächster Schritt: Diff-Blöcke aus dem Report in die jeweiligen src/content/*.mdx übertragen, researchedOn aktualisieren, im Changelog ergänzen.
```

## Rules

- Do NOT edit any MDX files yourself. The agent is report-only by design.
- Dispatch in PARALLEL for whole-deck mode (single message, multiple Agent calls).
- If a worker fails or returns garbage, include its module section verbatim with a `⚠ Worker error` note — never silently drop modules.
- The report MUST be committed (git add + commit) at the end if you have permission. Otherwise just write it and tell the user to commit.
