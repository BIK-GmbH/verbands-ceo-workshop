# KI-Geschäftsführer: Fiktion oder Realität? — Workshop-Plattform

Interaktive Workshop-Plattform für den Zweitages-Workshop **„KI-Geschäftsführer: Fiktion oder Realität?"**
des **Fachverbands Betonbohren und -sägen Deutschland e. V.** am 16./17.09.2026.

**Veranstalter:** Harald Ostermann · Innovationswerkstatt & Digital Management School ·
Dr. Stefan Reinheimer · BIK GmbH

## Funktionen

- **Folien** in 8 Modulen und 7 Phasen, nach dem Poster-Prinzip aufgebaut
- **Live-Protokoll** mit Diktat (Web Speech) und optionaler KI-Überarbeitung (opt-in)
- **Protokoll-Export** als PDF, Word, Markdown und JSON
- **Interview-Modus** mit Transkription und Meinungsbildern
- **Poster-Generator** für Workshop-Ergebnisse
- **Light/Dark-Modus** und **DE/EN**
- **Soft-Login** (Zugangsdaten bei der Moderation)

## Quick Start

Voraussetzung: Node.js 20+ und npm.

```bash
npm install
npm run dev        # http://localhost:5174/verbands-ceo-workshop/
npm run build      # Typecheck + Production-Build nach dist/
npm run preview    # Production-Build lokal auf http://localhost:4173
```

Ohne Pfad-Präfix lokal starten: `BASE_PATH=/ npm run dev` → http://localhost:5174/

## API-Keys

Einige Funktionen nutzen externe KI-Dienste:

- **Claude (Anthropic):** Textüberarbeitung und Zusammenfassungen
- **OpenAI:** Transkription im Interview-Modus

Die Keys werden in der App eingegeben und **nur im Browser** gespeichert. Sie gehören nie ins
Repository. Ohne Keys laufen Folien, Protokoll und Export trotzdem, nur die KI-Funktionen fehlen.

## Deploy

GitHub Pages über `.github/workflows/deploy.yml`, automatisch bei jedem Push auf `main`.

## Weiterführend

- `CLAUDE.md`: Architektur, MDX-Konventionen, Befehle für Mitwirkende
- `docs/workshop-konzept.md`: inhaltliches Workshop-Konzept
