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
- `<ZoomBox title="…" titleEn="…">…</ZoomBox>` – Vergrößerungsmodus: zeigt neben dem Inhalt einen Knopf „Groß", der ihn formatfüllend einblendet (Esc schließt). Um **komplexere Tabellen** legen (Faustregel ab ca. fünf Zeilen oder drei Spalten), insbesondere die Ablauf-Tabellen der Phasen-Überblicksfolien. Muss die **kompletten** `<De>`- und `<En>`-Blöcke umschließen, Leerzeilen um die Markdown-Blöcke beibehalten.
- `<WorkshopInput slideId="01.03" field="top-herausforderungen" prompt="…" kind="text|vote|decision|checklist" options={["…","…"]} rows={4} placeholder="…" />`
  - `slideId` = exakt die ID der Datei, `field` je Folie eindeutig (kebab-case). `prompt` ist ein deutscher String.
  - `text` = Freitext (Diktat eingebaut, KI-Glättung im Protokoll); `vote` = eine Option (Buttons nebeneinander); `decision` = eine Option (Liste); `checklist` = Mehrfachauswahl.
- `<CardCollector slideId="01.03" field="karten-herausforderungen" prompt="…" groups={["Gruppe 1","Gruppe 2"]} clusterTarget="01.04:problemfelder" clusterPrompt="…" />` – **Karten-Modus** für Stillarbeit und Kleingruppen.
  - Großer Button „Karten vorlesen“ (Web-Speech-Diktat): **jede Sprechpause wird eine eigene Karte**; Texteingabe mit Enter = neue Karte; Karten als Kacheln, per Klick editierbar, mit × löschbar.
  - Speicherung als ein Protokoll-Eintrag `<slideId>:<field>` (`checklist`, eine Zeile pro Karte) → erscheint automatisch im Live-Protokoll, auf `/protokoll`, in PDF/Word und im Ergebnisbericht.
  - `groups` (optional): Umschalter für neue Karten, Anzeige nach Gruppe, gespeichert als Präfix „[Gruppe 2] Text“. Beschriftung über `groupsLabel` / `groupsLabelEn` anpassbar (Standard „Karten gehören zu: …“), damit die Dimension auch eine Kategorie sein kann.
  - `tags` / `tagLabel` / `tagLabelEn` (optional): zweite Dimension je Karte, gespeichert als Präfix „{Heute} Text“, änderbar direkt am Kärtchen. Je Abschnitt wird die Verteilung angezeigt („Heute 3 · Morgen 2 · offen 1“). In Protokoll und Exporten erscheinen die Karten als „Kartentext (Kategorie · Tag)“.
  - KI (nur mit Claude-Schlüssel): „Karten glätten“ (Erkennungsfehler, Dubletten mit Anzahl, Vorschau mit Übernehmen/Verwerfen); mit `groups` oder `tags` zusätzlich „Karten einordnen“ (Kategorie und/oder Tag für alle Karten auf einmal, Wortlaut bleibt unverändert, Vorschau mit Übernehmen/Verwerfen); mit `clusterTarget` zusätzlich „Zu Themenfeldern clustern“ (3–5 Themenfelder als Text in das Zielfeld, vorher Rückfrage, falls es schon Text enthält). `clusterPrompt` = Prompt des Zielfelds, falls es noch nicht existiert.
  - `field` je Folie eindeutig (Präfix `karten-…`); mehrere CardCollector pro Folie möglich. Keine geraden `"` im Wert von `prompt`.
- `<SpeakerNotes><I18n de="…" en="…" /></SpeakerNotes>` – **jede Folie endet damit** (Moderationshinweise für Harald Ostermann bzw. bei Phase 2 für Stefan Reinheimer: Zeit, Ablauf, worauf achten, Überleitung).
- Layout-Kacheln mit `<div style={{ … }}>` wie in den alten Folien (CSS-Variablen `var(--border)`, `var(--bg-elev)`, `var(--fg-muted)`, `var(--workshop-accent)`).

## MDX-Regeln (Verstöße brechen den Build)
- **Keine geraden doppelten Anführungszeichen innerhalb von JSX-Attributwerten.** Deutsche „…" bzw. englische “…” verwenden.
- Kein rohes `<` in losem Text.
- JSX-Objekt-/Array-Attribute (`style={{…}}`, `options={[…]}`) sind ok; Strings darin in geraden Anführungszeichen sind ok (das ist JS, kein Attributwert).
- DE und EN immer inhaltsgleich.

## Inhaltliche Regeln
1. **Sachlich und strategisch, keine Vertriebsshow.** Keine Tool-, Plattform- oder Anbieterauswahl, keine Produktvorstellung, keine BIK-Suite, keine Produktnamen (CDBrain, Personal Digital Brain, PDB, Composer, CDBOS) außer im ausdrücklich optionalen Demo-Slot (02.06 und in 07.05). Dort zeigt die Demo sachlich, was heute geht. **Keine demonstrativen Disclaimer** („keine Empfehlung", „eine von mehreren Möglichkeiten", „herstellerneutral", „kein Vorschlag für ein bestimmtes Werkzeug"). Neutrale Begriffe: Wissensbasis, persönlicher KI-Assistent, Dokumenten-Generator, KI-Agent, Automatisierungsplattform, Chat-Assistent.
2. **Ergebnisoffen.** Keine vorweggenommene Empfehlung (kein „½ FTE mit KI", kein „BIK-Pilot", keine „beste Balance"). Die Gruppe erarbeitet die Antwort. Beispiele sind Anregungen, keine Vorgaben.
3. **Keine unbelegten Zahlen.** Keine Prozent-Effekte oder Preise ohne Quelle. Wo Zahlen nötig sind: als Eingabe der Gruppe oder als klar gekennzeichnete Bandbreite/Hypothese.
4. **Poster-Prinzip.** Jede Phase endet mit einer Poster-Folie (`NN-…-poster-….mdx`). Deren `WorkshopInput`-Felder heißen `poster-…` und bilden den Posterinhalt (z. B. `poster-kernproblem`, `poster-ursachen`). Kurzer Hinweis: „Das Poster halten wir gemeinsam fest, hier auch digital im Protokoll." (keine Festlegung auf analog/Wand)
5. **Ton: gemeinsames „wir".** Deutsch, durchgehend „wir/uns/unsere" statt „ihr/euch/eure". **Keine Rollentrennung Moderation ↔ Teilnehmende im sichtbaren Folientext** („Die Moderation fragt, ihr antwortet" → „Wir fragen uns", „Wir sammeln", „Wir einigen uns auf"). Grundprinzip: Wir entwickeln die relevanten Fragen gemeinsam und suchen dann gemeinsam die Antworten. Wo eine Folie fertige Fragen vorgibt (Leitfragen, Prüffragen, Interviewfragen, Ablauf-Tabellen), einmal pro Folie klarstellen, dass es Vorschläge sind, die wir schärfen und um eigene Fragen ergänzen; dafür gibt es im Live-Protokoll den Baustein „Eigene Frage / Aufgabe" (auf den Phasen-Überblicksfolien und 00.07 kurz erwähnen, Formulierung variieren statt denselben Satz zu wiederholen). In den `SpeakerNotes` bleibt die Ansprache an die Moderation erlaubt, aber auch dort „gemeinsam entwickeln" statt „abfragen". Klar, konkret, verbandsnah (Betonbohren und -sägen). Wenige Gedankenstriche, keine Floskeln. FBS ist ein **bundesweiter Fachverband**.
6. **Zeiten** exakt aus `docs/workshop-konzept.md` übernehmen (Phasen-Überblicksfolie: Kernfrage, Ziel/Output, Ablauf-Tabelle mit Zeit · Was wir tun · Methode · Output). **Arbeitsformen:** diskussionsorientiert, Plenum als Grundform, dazu Stillarbeit (Karten), Kleingruppen bzw. Zweiergruppen und die Einzelinterviews zu Beginn von Phase 1 – jeweils so, wie in `docs/workshop-konzept.md` den Folien zugeordnet. Keine Festlegung auf Punkte-Kleben (Priorisierungsmethode offen, z. B. Handzeichen oder Punkte). **Jede Nicht-Plenums-Arbeit braucht einen Weg in die Plattform:** Karten → `CardCollector` (reihum vorlesen, Diktat), Kleingruppen → Vorstellung im Plenum „in drei Sätzen“, die Moderation diktiert oder tippt in die `WorkshopInput`-Felder. SpeakerNotes erklären die Bedienung („Karten vorlesen“ drücken, pro Karte kurz absetzen).
7. **Personen:** Harald Ostermann (Innovationswerkstatt & Digital Management School) und Dr. Stefan Reinheimer (BIK GmbH) moderieren gemeinsam; Stefan gibt zusätzlich in Phase 2 den Experteninput.
8. Umfang: pro Folie so viel, wie auf eine Beamer-Seite passt; lieber knapp und handlungsleitend.

## Verifikation
- Baue mit eigenem Ausgabeordner, damit parallele Agenten sich nicht stören:
  `npx vite build --outDir C:/Users/StefanReinheimer/AppData/Local/Temp/claude/C--Users-StefanReinheimer-Apps-verbands-ceo-workshop/9f6637af-5455-4280-8f89-eeac8dfa2e47/scratchpad/build-<dein-kürzel> --emptyOutDir`
  Fehler in Dateien außerhalb deines Scopes ignorieren (andere schreiben parallel), eigene Fehler beheben.
- Danach per Grep in deinen Dateien prüfen: keine Produktnamen (außer Demo-Slot), keine geraden `"` in Attributwerten von I18n/NoteCard/ExerciseCard/WorkshopInput.
- Nicht committen. Nur Dateien in deinem Scope anlegen/ändern.
