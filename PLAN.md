# Verbands-CEO Workshop — Plan

> **Resume-Anchor.** Bei Context-Switch: dieses File zuerst, dann `STATUS.md`. Hier das **Was/Wie**.

## Zweck

Halbtags-Vorstandsworkshop (~3,5 Std) zum BIK-Konzept „Der KI-augmentierte Verbands-CEO" für den
Fachverband Betonbohren und -sägen Deutschland e. V. (FBS). Veranstalter BIK GmbH × Innovationswerkstatt
Amberg. Die Plattform ist zugleich Schulungs- und **Erarbeitungs**-Werkzeug (Konzept-Werkstatt).

## Architektur

Vite + React 19 + MDX + Tailwind, HashRouter, GH-Pages (Base `/verbands-ceo-workshop/`).
Slide-Pipeline: `manifest.ts` (Reihenfolge/IDs) → `content/*.mdx` → `slides.ts` (glob + Frontmatter-merge)
→ `routes/Slide.tsx` / `routes/Print.tsx`. Interaktive Schicht: `workshop-store.ts` (localStorage,
gecachte Snapshots) + `WorkshopInput` + `Protocol`-Route + Audio-Rekorder. Generierung via Slash-Commands
`/konzept-neu` und `/workshop-deck`.

## Module (40 Slides)

0 Auftakt (5) · 1 Ausgangslage (5) · 2 Aufgaben & Rolle (5) · 3 Zielarchitektur (5) ·
4 Governance (4) · 5 Förderung/Roadmap (4) · 6 Beschluss (3) · 7 Ergebnis (4) · 99 Anhang (5).
Erarbeiten-Folien: 01.05, 02.05, 03.05, 04.04, 05.04, 06.03, 07.04.

## Konventionen

Siehe `CLAUDE.md` (MDX-Regeln, Branding, Build-Gate). Build muss vor jeder „fertig"-Meldung grün sein.
