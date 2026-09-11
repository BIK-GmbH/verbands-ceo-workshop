# Brief für Folien-Autoren (Sub-Agents)

Lies zuerst `docs/workshop-konzept.md` (Inhalt, Zeitplan, Phasen, Grundprinzipien) und `src/lib/manifest.ts` (Folien-IDs und Titel). Alte Folien liegen als **Materialquelle** unter `docs/old-content/` – nur übernehmen, was neutral ist.

## Dateien
- Neue Folie = `src/content/NN-MM-slug.mdx`, ID `NN.MM` muss zu einem Eintrag in `src/lib/manifest.ts` passen (der Dateiname bestimmt die ID).
- Frontmatter:
  ```
  ---
  title:
    de: "…"
    en: "…"
  researchedOn: 2026-09-11
  ---
  ```
  Der Titel soll dem Manifest-Titel entsprechen (darf leicht präzisiert werden).
- Überschrift: `# <I18n de="…" en="…" />`

## Verfügbare Bausteine (MDX, bereits global registriert – nicht importieren)
- `<I18n de="…" en="…" />` inline; `<De>…</De>` / `<En>…</En>` für Blöcke, Listen und **Tabellen (GFM-Tabellen nur innerhalb von De/En, mit Leerzeilen davor/danach)**.
- `<NoteCard variant="tip|hint|warning" title="…">…</NoteCard>`
- `<ExerciseCard duration="15 Min" goal="…">…</ExerciseCard>` für Arbeitsaufträge (Methode, Sozialform, Zeit).
- `<WorkshopInput slideId="01.03" field="top-herausforderungen" prompt="…" kind="text|vote|decision|checklist" options={["…","…"]} rows={4} placeholder="…" />`
  - `slideId` = exakt die ID der Datei, `field` je Folie eindeutig (kebab-case). `prompt` ist ein deutscher String.
  - `text` = Freitext (Diktat eingebaut, KI-Glättung im Protokoll); `vote` = eine Option (Buttons nebeneinander); `decision` = eine Option (Liste); `checklist` = Mehrfachauswahl.
- `<SpeakerNotes><I18n de="…" en="…" /></SpeakerNotes>` – **jede Folie endet damit** (Moderationshinweise für Harald Ostermann bzw. bei Phase 2 für Stefan Reinheimer: Zeit, Ablauf, worauf achten, Überleitung).
- Layout-Kacheln mit `<div style={{ … }}>` wie in den alten Folien (CSS-Variablen `var(--border)`, `var(--bg-elev)`, `var(--fg-muted)`, `var(--workshop-accent)`).

## MDX-Regeln (Verstöße brechen den Build)
- **Keine geraden doppelten Anführungszeichen innerhalb von JSX-Attributwerten.** Deutsche „…" bzw. englische “…” verwenden.
- Kein rohes `<` in losem Text.
- JSX-Objekt-/Array-Attribute (`style={{…}}`, `options={[…]}`) sind ok; Strings darin in geraden Anführungszeichen sind ok (das ist JS, kein Attributwert).
- DE und EN immer inhaltsgleich.

## Inhaltliche Regeln
1. **Herstellerneutral, keine Vertriebsshow.** Keine BIK-Suite, keine Produktnamen (CDBrain, Personal Digital Brain, PDB, Composer, CDBOS) außer im ausdrücklich optionalen Demo-Slot (02.06 und in 07.05), dort mit Hinweis „eine von mehreren Möglichkeiten". Neutrale Begriffe: Wissensbasis, persönlicher KI-Assistent, Dokumenten-Generator, KI-Agent, Automatisierungsplattform, Chat-Assistent.
2. **Ergebnisoffen.** Keine vorweggenommene Empfehlung (kein „½ FTE mit KI", kein „BIK-Pilot", keine „beste Balance"). Die Gruppe erarbeitet die Antwort. Beispiele sind Anregungen, keine Vorgaben.
3. **Keine unbelegten Zahlen.** Keine Prozent-Effekte oder Preise ohne Quelle. Wo Zahlen nötig sind: als Eingabe der Gruppe oder als klar gekennzeichnete Bandbreite/Hypothese.
4. **Poster-Prinzip.** Jede Phase endet mit einer Poster-Folie (`NN-…-poster-….mdx`). Deren `WorkshopInput`-Felder heißen `poster-…` und bilden den Posterinhalt (z. B. `poster-kernproblem`, `poster-ursachen`). Kurzer Hinweis: „Das Poster entsteht analog an der Wand; hier halten wir es digital fest."
5. **Ton:** Deutsch, Anrede „ihr/euch", klar, konkret, verbandsnah (Betonbohren und -sägen). Wenige Gedankenstriche, keine Floskeln. FBS ist ein **bundesweiter Fachverband**.
6. **Zeiten und Methoden** exakt aus `docs/workshop-konzept.md` übernehmen (Phasen-Überblicksfolie: Kernfrage, Ziel/Output, Ablauf-Tabelle mit Zeit · Was wir tun · Methode · Output).
7. **Personen:** Moderation Harald Ostermann (Innovationswerkstatt & Digital Management School), Experteninput Dr. Stefan Reinheimer (BIK GmbH) nur in Phase 2 und als Fachkontakt.
8. Umfang: pro Folie so viel, wie auf eine Beamer-Seite passt; lieber knapp und handlungsleitend.

## Verifikation
- Baue mit eigenem Ausgabeordner, damit parallele Agenten sich nicht stören:
  `npx vite build --outDir C:/Users/StefanReinheimer/AppData/Local/Temp/claude/C--Users-StefanReinheimer-Apps-verbands-ceo-workshop/9f6637af-5455-4280-8f89-eeac8dfa2e47/scratchpad/build-<dein-kürzel> --emptyOutDir`
  Fehler in Dateien außerhalb deines Scopes ignorieren (andere schreiben parallel), eigene Fehler beheben.
- Danach per Grep in deinen Dateien prüfen: keine Produktnamen (außer Demo-Slot), keine geraden `"` in Attributwerten von I18n/NoteCard/ExerciseCard/WorkshopInput.
- Nicht committen. Nur Dateien in deinem Scope anlegen/ändern.
