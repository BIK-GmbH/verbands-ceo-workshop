---
description: Ein deutsches Marken-Slide-Deck zum Verbands-CEO-Workshop über Canva erzeugen
argument-hint: [protokoll.md] [anzahl-slides]
---

# /workshop-deck — Marken-Deck über Canva (Claude Design)

Erzeuge ein **deutsches Slide-Deck im BIK-Look** für den Workshop „Der KI-augmentierte
Verbands-CEO" (FBS) über die **Canva-MCP-Integration**.

## Vorgehen

1. **Quelle bestimmen**: Wenn `$ARGUMENTS` ein Protokoll enthält, nutze die Vorstands-Ergebnisse;
   sonst die Kerninhalte der Plattform (`src/content/*.mdx`) — Auftakt, Idee in einem Satz,
   Aufgaben/Rolle, Zielarchitektur, Governance, Förderung/Roadmap, Beschluss.
2. **Canva prüfen**: Mit einer leichten Canva-MCP-Abfrage (z. B. Brand-Kits/Designs auflisten)
   testen, ob der Connector authentifiziert ist. Falls nicht: den Nutzer bitten, Canva in den
   Connector-Einstellungen zu verbinden.
3. **Deck generieren** (Canva MCP, `generate-design` / `create-design-from-candidate`):
   - Titel: „Der KI-augmentierte Verbands-CEO — Vorstands-Workshop"
   - ~10–14 Slides, Deutsch, je Konzeptkapitel eine Kernaussage + 3–5 Bullets
   - BIK-Farben: Türkis #38B6AB, Tiefblau #13357A, Anthrazit #181A27
   - Co-Branding-Hinweis: BIK GmbH × DIE INNOVATIONSWERKSTATT Amberg × FBS
4. **Exportieren**: Als PDF/PPTX exportieren (`export-design`) und den Link/Datei zurückgeben.

## Hinweise

- Inhalte aus den Folien/Protokoll übernehmen, nichts erfinden. Modellannahmen kennzeichnen.
- Das eingebaute Konzept-PDF (`npm run export:pdf`) bleibt die primäre, versionierte Quelle;
  das Canva-Deck ist die repräsentative Marken-Variante für Präsentationen.
