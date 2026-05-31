# Der KI-augmentierte Verbands-CEO — Vorstands-Workshop

Interaktive Konzept-Werkstatt für einen **Halbtags-Vorstandsworkshop (~3,5 Std)** zum
BIK-Betriebsmodell **„Der KI-augmentierte Verbands-CEO"** — erstellt für den Vorstand des
**Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS)**.

Veranstalter: **BIK GmbH** · in Kooperation mit **DIE INNOVATIONSWERKSTATT Amberg**.

## Was diese Plattform kann

- **Durchgehen:** 40 Folien entlang der 6 Konzeptkapitel (Auftakt → Beschluss → Ergebnis), DE/EN.
- **Erarbeiten:** Pro Modul eine Übung mit Live-Erfassung (tippen oder **einsprechen**) —
  Entscheidungen, Prioritäten, Votes, Anmerkungen. Alles landet lokal im **Workshop-Protokoll**.
- **Aufnehmen (optional):** Lokaler Sitzungs-Rekorder (mit Einwilligung, kein Upload), Auswertung
  nachträglich per `audio`-Skill.
- **Erzeugen:** Aus dem Protokoll ein **angepasstes Konzept + neue Folien** — über den
  Slash-Command `/konzept-neu`, ein **Canva-Marken-Deck** (`/workshop-deck`) und den
  Print→PDF-Export. Das ist der „Composer" aus dem Konzept, live.

## Schnellstart

```bash
npm install
npm run dev            # http://localhost:5174  (Dev)
npm run build          # tsc + vite build → dist/
npm run export:pdf -- --lang=de   # exports/workshop-de.pdf
```

Navigation: Pfeiltasten / `J`/`K`, `⌘K` Suche, `P` Presenter, `F` Vollbild.
Oben rechts **„Protokoll"** → Live-Mitschrieb + Export.

## Aufbau

- `src/content/*.mdx` — Folieninhalte (Frontmatter + bilingual)
- `src/lib/manifest.ts` — Reihenfolge & IDs (Single Source of Truth)
- `src/lib/workshop-store.ts` + `src/lib/useWorkshop.ts` — Erfassungs-Store (localStorage)
- `src/components/slide-blocks/WorkshopInput.tsx` — Erfassungs-Block (Text/Vote/Decision/Checklist + Diktat)
- `src/routes/Protocol.tsx` — Protokoll-Seite (`/protokoll`) + Export
- `.claude/commands/` — `/konzept-neu`, `/workshop-deck`

Details für Mitwirkende: siehe `CLAUDE.md`.

---

Grundlage: BIK-Konzept „Der KI-augmentierte Verbands-CEO" (Dokument BIK-FB-CEO-2026-01, Mai 2026).
Technische Basis: `claude-code-workshop` (BIK GmbH).
