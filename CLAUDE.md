# CLAUDE.md

Guidance for Claude Code when working in this repository.

## Worum es geht

Interaktive **Konzept-Werkstatt** (Schulungs- + Erarbeitungsplattform) für den
**Zweitages-Workshop „KI-Geschäftsführer: Fiktion oder Realität?"** (16./17.09.2026, **ohne**
Untertitel; der frühere Untertitel „Der KI-augmentierte Verbands-CEO" entfällt überall, weil er die
Antwort vorwegnimmt). Teilnehmende: Vertreter des **Fachverbands Betonbohren und -sägen
Deutschland e. V. (FBS)**, Darmstadt (bundesweiter Fachverband).

Veranstalter: **Harald Ostermann · Innovationswerkstatt & Digital Management School** (Moderation,
federführend) und **Dr. Stefan Reinheimer · BIK GmbH** (Experteninput KI & Digitalisierung).
Logo-Reihenfolge überall: FBS prominent, dann Innovationswerkstatt, Digital Management School, BIK.

**Herstellerneutrale, ergebnisoffene Beratungsveranstaltung, keine BIK-Werbung.** Keine Vorstellung
der BIK-Suite, keine Produkt- oder Anbieterempfehlung, keine vorweggenommene Antwort auf die
Leitfrage. Höchstens klar als optional markierte Demo-Slots. Verbindliche inhaltliche Referenz:
`docs/workshop-konzept.md` (Rahmen, Grundprinzipien, Zeitplan, Phasen).

Anlass: Früher zwei Geschäftsführer + mehr Assistenz, aus Kostengründen reduziert, Aufgaben kaum
weniger. Ein früheres Digitalisierungsprojekt („Wilma") schuf keine Akzeptanz, daher große Skepsis
bei den Mitgliedsfirmen. **Das Förderthema ist bewusst komplett aus dem Workshop entfernt.**

Die Plattform basiert technisch auf dem `claude-code-workshop`-Deck (gleiche Pipeline), ist
inhaltlich aber komplett ersetzt und um eine **interaktive Erfassungs- und Generierungsschicht**
erweitert.

- **Format:** zwei Tage, erarbeitend; jede Phase endet mit einer Poster-Folie (Felder `poster-…`); Tag 1 = Module 0–3, Tag 2 = Module 4–7
- **Module:** 0 Auftakt · 1 Analyse: Need to Move · 2 Vision · 3 Zielbild · 4 Realitätscheck FBS · 5 Wirtschaftlichkeit & Argumentation · 6 Roadmap · 7 Commitment · 99 Anhang (54 Folien, siehe `src/lib/manifest.ts`)
- **Einstieg:** Route `/` ist die Landing Page (`src/routes/Landing.tsx`, Hero `public/brand/hero-ki-beton.webp`); Folien unter `/s/:id`
- **Login:** Die ganze App liegt hinter einem clientseitigen Soft-Gate (`src/components/LoginGate.tsx`, SHA-256 von `user:passwort`, localStorage-Key `verbands-ceo.auth.v1`). Kein echter Schutz, nur gegen Zufallsbesucher. Für Playwright/Screenshots den Hash per `addInitScript` in localStorage setzen (siehe `scripts/shot.mjs`).
- **Sprache:** Deutsch-first, EN-Toggle bleibt erhalten

## Die interaktive Schicht (das Besondere)

1. **Erfassen** — `<WorkshopInput>`-Blöcke (Text/Vote/Decision/Checklist) auf den Erarbeiten- und
   Poster-Folien, Freitext per Web-Speech-Diktat. Speicherung lokal via `src/lib/workshop-store.ts`
   (localStorage, kein Server). Snapshots sind **referenz-stabil gecacht** (Pflicht für `useSyncExternalStore`).
2. **Bündeln** — Live-Protokoll rechts (`src/components/LiveProtocolPanel.tsx`) und Route `/protokoll`
   (`src/routes/Protocol.tsx`): gruppiert nach Modul, Meta-Editor, **opt-in Audio-Rekorder**
   (`src/components/AudioRecorder.tsx`), opt-in KI-Überarbeitung (`src/lib/ai-assist.ts`), Export als
   PDF/Word (`src/lib/protocol-export.ts`), Markdown + JSON.
3. **Erzeugen** — Slash-Commands `/konzept-neu` (Ergebnisdokument + Folien aus dem Protokoll) und
   `/workshop-deck` (Canva-Deck). Plus eingebauter Print→PDF-Export.

## Befehle

| Command | Zweck |
|---|---|
| `npm run dev` | Vite Dev-Server :5174. `BASE_PATH=/` für lokal ohne `/verbands-ceo-workshop/`-Prefix. |
| `npm run build` | `tsc -b --noEmit` + `vite build` → `dist/`. **Pflicht vor jeder „fertig"-Meldung.** |
| `npm run typecheck` | Nur TypeScript prüfen. |
| `npm run export:pdf -- --lang=de` | DE-Folien-PDF → `exports/workshop-de.pdf`. Headless Playwright. |
| `npm run preview` | Production-Build lokal :4173. |
| `node scripts/shot.mjs` | Schnelle Verifikations-Screenshots gegen den Preview-Server (setzt den Login-Hash). |

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
- Farben in Folien nur über Variablen (`var(--workshop-accent)`, `var(--fg)`, `var(--bg-elev)`, `var(--border)`), nie hart kodiert.

## Branding

Neutrales Design mit **Rot als einzigem Akzent** (Titel-Rot der Ablaufblätter „Verbandssitzung"),
Light und Dark Mode. Tokens in `src/styles/tokens.css`:

| Token | Light | Dark |
|---|---|---|
| `--workshop-accent` | `#CD184B` | `#DC3055` |
| `--workshop-accent-deep` | `#9B1238` | `#A3143C` |
| `--bg` / `--bg-elev` | `#ffffff` / `#f5f5f4` | `#111218` / `#1b1c26` |
| `--fg` / `--fg-muted` | `#181A27` / `#5a5e6b` | `#ececef` / `#a0a3ad` |
| `--border` | `#e5e5e3` | `#2a2b36` |

Weiße Schrift auf `--workshop-accent` hält in beiden Themes ≥ 4,5:1. Landing und Login sind immer
dunkel (`#111218`, Rot-Text dort `#EE4D6C`).

Logos in `public/brand/` jeweils in einer Variante für hellen und dunklen Grund, im Theme-Wechsel per
`.theme-img-light` / `.theme-img-dark` (setzen `display:block`): `fbs-logo(.png|-white.png)`,
`innovationswerkstatt-(dark|white).png`, `dms-logo-(dark|white).png` (Digital Management School),
`bik-logo-(dark|white).svg`. Keine weißen Chips hinter Logos.

## CI / Deploy

`.github/workflows/deploy.yml` deployt auf GH-Pages bei Push auf `main`. E2E-Tests (`tests/e2e/`)
stammen aus der Basis und prüfen teils alte Inhalte — bei Bedarf an die neuen Slides anpassen,
bevor man sich auf sie verlässt.
