# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Worum es geht

Interaktive **Konzept-Werkstatt** (Schulungs- + Erarbeitungsplattform) für den
**Zweitages-Workshop „KI – Fiktion oder Realität"** (16./17.09.2026) zum BIK-Betriebsmodell
**„Der KI-augmentierte Verbands-CEO"** (Untertitel). Teilnehmende: Vertreter des
**Fachverbands Betonbohren und -sägen Deutschland e. V. (FBS)**, Darmstadt.
Veranstalter: **DIE INNOVATIONSWERKSTATT** (Harald Ostermann, federführend) und
**BIK GmbH** (Dr. Stefan Reinheimer) als Partner. Logo-Reihenfolge überall: FBS prominent,
dann Innovationswerkstatt, dann BIK.

Anlass (Folie 00.03): Früher zwei Geschäftsführer + mehr Assistenz, aus Kostengründen
reduziert, Aufgaben kaum weniger. Ein früheres Digitalisierungsprojekt („Wilma") schuf keine
Akzeptanz, daher große Skepsis bei den Mitgliedsfirmen. **Das Förderthema ist bewusst komplett
aus dem Workshop entfernt.**

Die Plattform basiert technisch auf dem `claude-code-workshop`-Deck (gleiches Look & Feel,
gleiche Pipeline), ist inhaltlich aber komplett ersetzt und um eine **interaktive Erfassungs-
und Generierungsschicht** erweitert.

- **Format:** zwei Tage, erarbeitend (eine „Erarbeiten"-Übung pro Modul); Tag 1 = Module 0–3, Tag 2 = Module 4–7
- **Module:** 0 Auftakt · 1 Ausgangslage · 2 Aufgaben & Rolle · 3 Zielarchitektur · 4 Governance · 5 Roadmap & Wirtschaftlichkeit · 6 Beschluss · 7 Ergebnis · 99 Anhang (39 Slides)
- **Einstieg:** Route `/` ist die Landing Page (`src/routes/Landing.tsx`, Hero `public/brand/hero-ki-beton.webp`); Folien unter `/s/:id`
- **Sprache:** Deutsch-first, EN-Toggle bleibt erhalten
- **Grundlage:** Konzept-PDF „KI-augmentierter CEO V2" (BIK, Mai 2026)

## Die interaktive Schicht (das Besondere)

Aus „nur Folien" wird eine Konzept-Werkstatt — spiegelt die Konzept-Architektur (CDBrain → Composer):

1. **Erfassen** — `<WorkshopInput>`-Blöcke (Text/Vote/Decision/Checklist) auf den Erarbeiten-Folien,
   Freitext per Web-Speech-Diktat. Speicherung lokal via `src/lib/workshop-store.ts` (localStorage,
   kein Server). Snapshots sind **referenz-stabil gecacht** (Pflicht für `useSyncExternalStore`).
2. **Bündeln** — Route `/protokoll` (`src/routes/Protocol.tsx`): Live-Protokoll gruppiert nach Modul,
   Meta-Editor, **opt-in Audio-Rekorder** (`src/components/AudioRecorder.tsx`, MediaRecorder, lokal,
   Einwilligungs-Hinweis), Export als Markdown + JSON.
3. **Erzeugen** — Slash-Commands `/konzept-neu` (angepasstes Konzept + Folien aus dem Protokoll) und
   `/workshop-deck` (Canva-Marken-Deck). Plus eingebauter Print→PDF-Export.

## Befehle

| Command | Zweck |
|---|---|
| `npm run dev` | Vite Dev-Server :5174. `BASE_PATH=/` für lokal ohne `/verbands-ceo-workshop/`-Prefix. |
| `npm run build` | `tsc -b --noEmit` + `vite build` → `dist/`. **Pflicht vor jeder „fertig"-Meldung.** |
| `npm run typecheck` | Nur TypeScript prüfen. |
| `npm run export:pdf -- --lang=de` | DE-Konzept/Folien-PDF → `exports/workshop-de.pdf`. Headless Playwright. |
| `npm run preview` | Production-Build lokal :4173. |
| `node scripts/shot.mjs` | Schnelle Verifikations-Screenshots gegen den Preview-Server. |

## Architektur (Kurzfassung)

Single Source of Truth ist `src/lib/manifest.ts` (Modul-/Slide-Reihenfolge + IDs).
`src/content/<NN-MM-slug>.mdx` liefert Inhalt + Frontmatter; `src/lib/slides.ts` mappt Filename
`07-02-foo.mdx` → ID `07.02` und merged Frontmatter über das Manifest. Routing ist **HashRouter**
(GH-Pages). MDX-Komponenten werden in `SlideRenderer.tsx` **und** `Print.tsx` über `MDXProvider`
bereitgestellt — **neue Slide-Block-Komponente immer in BEIDEN registrieren**, sonst crasht der
Print-/PDF-Export.

### MDX-Konventionen (wirklich wichtig)
- **Keine geraden doppelten Anführungszeichen in JSX-Attributwerten** — brechen den Parser.
  Im Fließtext/Markdown sind deutsche „ " OK.
- **Kein rohes `<` in losem MDX-Text** (wird als JSX geparst). In `CommandBox`/`DemoBox` geschützt.
- Bilingual: `<I18n de="" en="" />` inline; `<De>…</De>`/`<En>…</En>` für Blöcke/Tabellen (GFM nur dort).
- Jede Inhalts-Folie endet mit `<SpeakerNotes>` (bilingual).
- `WorkshopInput`: `slideId` muss zur Datei-ID passen, `field` je Folie eindeutig.

## Branding

BIK-Echtfarben in `src/styles/tokens.css`: `#38B6AB` Türkis (`--workshop-accent`), `#13357A`
Tiefblau, `#181A27` Anthrazit. Co-Branding-Logo der Innovationswerkstatt in
`public/brand/innovationswerkstatt-1.png` (schwarz/monochrom → auf weißem Chip einbinden).

## CI / Deploy

`.github/workflows/deploy.yml` deployt auf GH-Pages bei Push auf `main` (Base-Path
`/verbands-ceo-workshop/`). E2E-Tests (`tests/e2e/`) stammen aus der Basis und prüfen teils
alte Inhalte — bei Bedarf an die neuen Slides anpassen, bevor man sich auf sie verlässt.
