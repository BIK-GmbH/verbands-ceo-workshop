# Status — Verbands-CEO Workshop

> Lies zuerst `PLAN.md`. Hier der aktuelle Stand.

## Letzte Aktualisierung: 2026-05-31

### Fertig
- Repo aus `claude-code-workshop` gescaffoldet, Branding/Config umgestellt (Titel, Base-Path, PWA, Cover).
- Manifest neu: 8 Module + Anhang, 40 Slides.
- Alle 40 MDX-Slides geschrieben (DE-first, EN-Toggle), personalisiert auf den FBS, je Modul eine
  Erarbeiten-Übung, Abschluss-Beschlussvorlage BIK-Pilot.
- Interaktive Schicht: `workshop-store` (localStorage, gecachte Snapshots), `WorkshopInput`
  (Text/Vote/Decision/Checklist + Web-Speech-Diktat), `/protokoll`-Route mit Export (MD+JSON) und
  opt-in Audio-Rekorder. Capture→Protokoll-Fluss verifiziert (Screenshots).
- Co-Branding Innovationswerkstatt Amberg (Logo lokal, Cover/Quellen).
- Slash-Commands `/konzept-neu` + `/workshop-deck`. Export-Script Windows-tauglich (`shell: true`),
  Print-Route um `WorkshopInput`/`AudioRecorder` ergänzt.
- `npm run build` grün; DE-PDF-Export erzeugt.

### Offen / Nächste Schritte
- Optional: echtes Canva-Marken-Deck via `/workshop-deck` erzeugen (Connector-Auth nötig).
- E2E-Tests (`tests/e2e/`) stammen aus der Basis und prüfen teils Alt-Inhalte → bei Bedarf anpassen.
- GH-Pages-Repo anlegen/Deploy, falls live gewünscht.
