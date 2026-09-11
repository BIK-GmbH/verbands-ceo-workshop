---
description: Ein deutsches Slide-Deck zum FBS-Workshop „KI-Geschäftsführer: Fiktion oder Realität?" über Canva erzeugen
argument-hint: [protokoll.md] [anzahl-slides]
---

# /workshop-deck — Deck über Canva

Erzeuge ein **deutsches Slide-Deck** für den Workshop „KI-Geschäftsführer: Fiktion oder
Realität?" (Fachverband Betonbohren und -sägen Deutschland e. V., FBS, 16./17.09.2026) über die
**Canva-MCP-Integration**. Herstellerneutral und ergebnisoffen: keine Produkt- oder
Anbieterwerbung, keine vorweggenommene Antwort.

## Vorgehen

1. **Quelle bestimmen**: Wenn `$ARGUMENTS` ein Protokoll enthält, nutze die erarbeiteten Ergebnisse
   (Poster je Phase); sonst die Kerninhalte der Plattform (`src/content/*.mdx`) entlang der Module
   aus `src/lib/manifest.ts`: Auftakt · Analyse: Need to Move · Vision · Zielbild ·
   Realitätscheck „Wilma" · Wirtschaftlichkeit & Argumentation · Roadmap · Commitment.
2. **Canva prüfen**: Mit einer leichten Canva-MCP-Abfrage (z. B. Brand-Kits/Designs auflisten)
   testen, ob der Connector authentifiziert ist. Falls nicht: den Nutzer bitten, Canva in den
   Connector-Einstellungen zu verbinden.
3. **Deck generieren** (Canva MCP, `generate-design` / `create-design-from-candidate`):
   - Titel: „KI-Geschäftsführer: Fiktion oder Realität?" (kein Untertitel), Zeile „Zweitages-Workshop · 16./17. September 2026"
   - ~10–14 Slides, Deutsch, je Phase eine Kernaussage + 3–5 Bullets
   - Design: neutral (Weiß/helles Grau, Text Anthrazit #181A27) mit Rot als einzigem Akzent #CD184B (dunkler #9B1238)
   - Logos/Veranstalter: FBS prominent, dann Innovationswerkstatt & Digital Management School (Harald Ostermann, Moderation) und BIK GmbH (Dr. Stefan Reinheimer, Experteninput)
4. **Exportieren**: Als PDF/PPTX exportieren (`export-design`) und den Link/Datei zurückgeben.

## Hinweise

- Inhalte aus den Folien/Protokoll übernehmen, nichts erfinden. Modellannahmen kennzeichnen.
- Das eingebaute Folien-PDF (`npm run export:pdf`) bleibt die primäre, versionierte Quelle;
  das Canva-Deck ist die repräsentative Variante für Präsentationen.
