---
description: Aus einem Workshop-Protokoll ein Ergebnisdokument + aktualisierte Folien erzeugen (der „Composer")
argument-hint: <pfad/zum/workshop-protokoll.md | .json>
---

# /konzept-neu — Ergebnisdokument & Folien aus dem Workshop-Protokoll

Du nimmst die im Workshop „KI-Geschäftsführer: Fiktion oder Realität?" (Fachverband Betonbohren
und -sägen Deutschland e. V., FBS, 16./17.09.2026) erfassten Eingaben und machst daraus konkrete
Ergebnisse: ein **Ergebnisdokument** mit der gemeinsam erarbeiteten Antwort plus **aktualisierte
Folien**. Veranstalter: Harald Ostermann · Innovationswerkstatt & Digital Management School
(Moderation) und Dr. Stefan Reinheimer · BIK GmbH (Experteninput).

**Neutralität ist Pflicht:** Das Ergebnis gibt wieder, was die Gruppe erarbeitet hat. Keine
Produkt- oder Anbieterempfehlung (auch keine BIK-Produkte), kein vorweggenommener nächster
Schritt. Inhaltliche Referenz: `docs/workshop-konzept.md`.

## Eingabe

`$ARGUMENTS` = Pfad zum exportierten Workshop-Protokoll (Markdown oder JSON, erzeugt auf der
Route `/protokoll`). Falls kein Pfad übergeben wurde: im Downloads-Ordner des Nutzers bzw. im
Repo nach `workshop-protokoll-*.md` / `*.json` suchen und den neuesten nehmen — sonst nachfragen.

## Vorgehen

1. **Protokoll lesen** und strukturieren: pro Modul Entscheidungen, Votes, Checklisten, Freitexte
   und die Poster-Felder (`poster-…`) extrahieren. Module laut `src/lib/manifest.ts`:
   - Modul 0 Auftakt: Erwartungen, Barometer „Fiktion oder Realität?" (vorher)
   - Modul 1 Analyse: Need to Move — gesammelte Probleme, Cluster, Priorität, 5× Warum, Kernproblem
   - Modul 2 Vision — Möglichkeitsraum, Szenarien, gemeinsame Vision
   - Modul 3 Zielbild — Aufgaben, Fähigkeiten, Nutzen, Zusammenspiel mit Menschen, erste Use Cases
   - Modul 4 Realitätscheck „Wilma" — was gelungen ist, Herausforderungen, Lehren
   - Modul 5 Wirtschaftlichkeit & Argumentation — Aufwand/Nutzen, Argumente für die Mitglieder
   - Modul 6 Roadmap — 100 Tage, 12/24/36 Monate, Meilensteine
   - Modul 7 Commitment — Barometer (nachher), Entscheidungen, Verantwortliche, nächste Schritte
   - Anhang: eigene Fragen/Aufgaben aus dem Live-Protokoll (Felder `q-…`), auch unbeantwortete

2. **Ergebnisdokument schreiben**: `exports/ergebnis-fbs-ki-geschaeftsfuehrer.md` — je Phase ein
   Kapitel mit dem Poster-Ergebnis, dazu eine Zusammenfassung mit der gemeinsamen Antwort auf die
   Leitfrage. Markiere klar, was **entschieden**, was **offen** und was **Auflage/Bedingung** ist.
   Bleibe an Protokoll und Folien (`src/content/*.mdx`); erfinde keine Fakten.

3. **Folien aktualisieren** (optional, wenn der Nutzer es will): Passe die betroffenen
   `src/content/*.mdx` an, vor allem Poster- und Commitment-Folien. Setze `researchedOn` auf das
   heutige Datum. Halte die MDX-Konventionen ein (keine geraden `"` in JSX-Attributen, kein rohes
   `<` in Text, Farben nur über Variablen).

4. **PDF erzeugen**:
   ```bash
   npm run build
   npm run export:pdf -- --lang=de
   ```
   Ergebnis: `exports/workshop-de.pdf` (das aktualisierte Folien-Deck).

5. **Deck (optional)**: Auf Wunsch zusätzlich `/workshop-deck` aufrufen.

6. **Zusammenfassen**: Liste auf, welche Dateien erzeugt/geändert wurden und welche offenen Punkte
   (aus Modul 7 und den offenen `q-…`-Fragen) noch zu klären sind.

## Leitplanken

- **KI bereitet vor, der Mensch entscheidet.** Kennzeichne klar, was Entwurf ist und vom Verband
  noch freigegeben werden muss.
- Keine personenbezogenen Daten über das Protokoll hinaus erfinden.
- Annahmen und Quellen transparent halten (Modellannahmen als solche kennzeichnen).
