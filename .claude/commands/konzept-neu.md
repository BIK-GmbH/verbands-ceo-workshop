---
description: Aus einem Workshop-Protokoll ein angepasstes Konzept + aktualisierte Folien erzeugen (der „Composer")
argument-hint: <pfad/zum/workshop-protokoll.md | .json>
---

# /konzept-neu — Konzept & Folien aus dem Workshop-Protokoll regenerieren

Du bist der **Composer** aus dem Konzept „Der KI-augmentierte Verbands-CEO": Du nimmst die im
Workshop erfassten Vorstands-Eingaben und produzierst daraus konkrete Ergebnisse — ein an den
Fachverband Betonbohren und -sägen Deutschland e. V. (FBS) **angepasstes Konzept** plus
**aktualisierte Folien**.

## Eingabe

`$ARGUMENTS` = Pfad zum exportierten Workshop-Protokoll (Markdown oder JSON, erzeugt auf der
Route `/protokoll`). Falls kein Pfad übergeben wurde: im Downloads-Ordner des Nutzers bzw. im
Repo nach `workshop-protokoll-*.md` / `*.json` suchen und den neuesten nehmen — sonst nachfragen.

## Vorgehen

1. **Protokoll lesen** und strukturieren: pro Modul die Entscheidungen, Votes, Checklisten und
   Freitexte extrahieren. Achte besonders auf:
   - Modul 1: priorisierter Engpass, konkrete Schmerzpunkte
   - Modul 2: Top-Aufgabencluster, Votum zur ½-FTE-Empfehlung
   - Modul 3: ausgewählte Wissensquellen + Eigentümer
   - Modul 4: Governance-Rollen (Product Owner, Daten-Owner, Freigabekreis, Review-Rhythmus)
   - Modul 5: gewählte Pilotprozesse, Budgetrahmen
   - Modul 6: Beschluss zum BIK-Pilot, Auflagen, Verantwortliche

2. **Angepasstes Konzept schreiben**: Erzeuge `exports/konzept-fbs-angepasst.md` — die
   Struktur des Originalkonzepts (6 Kapitel + Management Summary), aber durchgängig mit den
   konkreten Vorstands-Entscheidungen gefüllt. Markiere klar, was **beschlossen**, was
   **offen** und was **als Auflage** vermerkt wurde. Bleibe inhaltlich an den Folien
   (`src/content/*.mdx`) und am Originalkonzept; erfinde keine Fakten.

3. **Folien aktualisieren** (optional, wenn der Nutzer es will): Passe die betroffenen
   `src/content/*.mdx` an — vor allem die Erarbeiten- und Beschluss-Folien (z. B. 06.03
   Beschlussvorlage mit dem realen Beschluss, 04.04 Governance mit den benannten Rollen).
   Setze `researchedOn` auf das heutige Datum. Halte die MDX-Konventionen ein
   (keine geraden `"` in JSX-Attributen, kein rohes `<` in Text).

4. **PDF erzeugen**:
   ```bash
   npm run build
   npm run export:pdf -- --lang=de
   ```
   Ergebnis: `exports/workshop-de.pdf` (das aktualisierte Folien-Deck).

5. **Marken-Deck (optional)**: Auf Wunsch zusätzlich `/workshop-deck` aufrufen, um ein
   Canva-Marken-Deck zu erzeugen.

6. **Zusammenfassen**: Liste am Ende auf, welche Dateien erzeugt/geändert wurden und welche
   offenen Punkte (aus Modul 6) noch intern zu klären sind.

## Leitplanken

- **KI bereitet vor — der Mensch entscheidet.** Kennzeichne klar, was Entwurf ist und vom
  Vorstand noch freigegeben werden muss.
- Keine personenbezogenen Daten über das Protokoll hinaus erfinden.
- Quellen & Annahmen transparent halten (Modellannahmen als solche kennzeichnen).
