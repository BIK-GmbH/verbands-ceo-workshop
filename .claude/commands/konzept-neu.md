---
description: Aus der Workshop-Sicherung (oder dem Protokoll) Ergebnisdokument und PRD erzeugen, optional Folien und eine interne Capability-Map (der „Composer")
argument-hint: "[sicherung.json | protokoll.md | protokoll.json] [--ausgabe=<ordner>] [--folien] [--intern]"
---

# /konzept-neu – Ergebnisdokument und PRD aus dem Workshop

Aus dem, was im Workshop „KI-Geschäftsführer: Fiktion oder Realität?" (Fachverband Betonbohren und
-sägen Deutschland e. V., FBS, 16./17.09.2026) erfasst wurde, entstehen zwei Dokumente:

1. **Ergebnisdokument** `ergebnis-fbs-ki-geschaeftsfuehrer.md` – für Vorstand und Teilnehmende: was
   wir gemeinsam erarbeitet und entschieden haben.
2. **PRD** `prd-fbs-ki-geschaeftsfuehrer.md` – das Anforderungsdokument für die KI-Unterstützung der
   Geschäftsstelle, jede Anforderung rückverfolgbar auf das Erfasste.

Optional: aktualisierte Folien (`--folien`) und eine **interne** Capability-Map (`--intern`).
Veranstalter: Harald Ostermann · Innovationswerkstatt & Digital Management School und Dr. Stefan
Reinheimer · BIK GmbH.

## Grundregeln (gelten für jeden Satz beider Dokumente)

- **Nur was erfasst ist.** Jede Aussage, Zahl, Entscheidung, Frist und Verantwortlichkeit stammt aus
  einem Eintrag der Quelle. Was nicht erarbeitet wurde, steht als **offene Frage** da. Nichts
  ergänzen, nichts „sinnvoll vervollständigen", keine Beispielwerte aus `docs/` als Ergebnis ausgeben.
- **Widersprüche sichtbar lassen.** Zwei Einträge sagen Unterschiedliches (Termine, Einstufungen,
  Zahlen)? Beide nennen, als offen markieren, nicht glätten.
- **Zitate nur wörtlich** in „…" – aus einem Beitrag oder einem Interview-Transkript, ohne Zuordnung zu
  Personen. Kürzungen mit […]. Zitate werden am Ende maschinell geprüft (Schritt 6).
- **Keine Personennamen** außer den Veranstaltern. Teilnehmende nur als Rolle („ein Vorstandsmitglied",
  „die Geschäftsstelle"); keine Namen aus der Teilnehmerliste, den Barometer-Einzelstimmen oder
  Interview-Pseudonymen.
- **Neutral.** Keine Produkt-, Marken- oder Anbieternamen (auch keine BIK-Produkte), keine
  Werkzeugauswahl, keine Empfehlung, die nicht von der Gruppe kommt. Nennt ein Beitrag ein Produkt,
  neutral umschreiben („ein öffentlich verfügbarer KI-Chatdienst"). Neutrale Begriffe: Wissensbasis,
  KI-Assistent, Dokumenten-Generator, KI-Agent, Plattform.
- **Keine demonstrativen Disclaimer** („keine Empfehlung", „herstellerneutral", „eine von mehreren
  Möglichkeiten"). Neutralität zeigt sich im Inhalt, nicht in Beteuerungen.
- **Gemeinsames Wir.** Die Dokumente sprechen als Gruppe („wir haben … bestätigt"), keine Trennung
  Moderation ↔ Teilnehmende.
- **Wilma** nie in Überschriften; im Text nur, wo ein Beitrag es selbst nennt. Phase 4 heißt
  „Realitätscheck FBS". Das **Förderthema** kommt nicht vor.
- **KI bereitet vor, der Mensch entscheidet.** Beide Dokumente tragen den Status „Entwurf zur Freigabe"
  im Kopf. Das ist ein Status, kein Disclaimer.

## Schritt 1 – Eingabe finden und Format erkennen

`$ARGUMENTS`: optional ein Pfad, dazu die Schalter `--ausgabe=<ordner>` (Standard `exports/`),
`--folien`, `--intern`.

**Ohne Pfad** in dieser Reihenfolge suchen und den Fund nennen:

1. Downloads-Ordner des Nutzers (Windows `%USERPROFILE%\Downloads`, sonst `~/Downloads`):
   manuelle Sicherungen `workshop-sicherung-*.json`.
2. Der **Sicherungsordner der automatischen Sicherung** (in der App unter Einstellungen → Automatische
   Sicherung gewählt; der Pfad ist nur im Browser gespeichert und von hier aus nicht lesbar). Dateien
   `fbs-workshop-<JJJJ-MM-TT>_<HH-MM>[-ss].json` (Zwischenstände) und
   `fbs-workshop-<JJJJ-MM-TT>_mit-audio.json` (Tagesdatei mit Aufnahmen). Den Ordner nimmt, wer ihn
   nennt; sonst den in `docs/generalprobe.md` vorgeschlagenen Ort prüfen (z. B.
   `%USERPROFILE%\Documents\FBS-Workshop`) und im Zweifel fragen. Auch ein USB-Stick kommt infrage.
3. Im Repo `exports/` und das Wurzelverzeichnis. **Nie** `tests/fixtures/` (Probedaten), außer der
   Nutzer nennt die Datei ausdrücklich.
4. Erst wenn keine Sicherung existiert: `workshop-protokoll-*.json`, dann `workshop-protokoll-*.md`
   an denselben Orten.
5. Nichts gefunden: nachfragen, nicht raten.

**Mehrere Sicherungen:** Alle drei Namensschemata sind dasselbe Sicherungsformat. Zeitpunkt aus dem
Dateinamen (Ortszeit), bei der Tagesdatei ohne Uhrzeit aus dem Änderungsdatum der Datei. Die
neueste nehmen – eine Sicherung enthält alles bis zu ihrem Zeitpunkt, die vom Ende von Tag 2 also auch
Tag 1. Nennen, welche genommen wurde und welche liegen bleiben. Mehrere am selben Tag: ebenfalls die
neueste. Nach dem Auszug (Schritt 2) prüfen: Hat die neueste **weniger** Beiträge als die
nächstältere, ist sie verdächtig (Zurücksetzen, anderes Gerät) – dann anhalten und den Nutzer
entscheiden lassen.

**Format am Inhalt erkennen, nicht an der Endung:**

| Inhalt | Format | Was fehlt |
|---|---|---|
| JSON mit `"format": "verbands-ceo-backup"` | **Sicherung** (bevorzugt) | nichts; Audio meist nicht enthalten |
| JSON mit `meta` und `entries` | Protokoll-JSON | Posterfassung, Interviews, Gruppenmeinung, Glossar-Status |
| Markdown, beginnt mit `# Workshop-Protokoll —` | Protokoll-Markdown | zusätzlich die Feldnamen: Herkunft nur als Folie + Frage |
| JSON mit `"format": "verbands-ceo-interviews"` | nur Interviews | nicht allein verwendbar, nachfragen |
| `workshop-ergebnisbericht-*.md` | KI-Ergebnisbericht | nicht als Quelle verwendbar, nachfragen |

Bei Protokoll-JSON oder -Markdown: im Kopf beider Dokumente angeben, dass Interviews und Posterfassung
nicht vorlagen.

**Probedaten:** Steht in `meta.title` „PROBEDATEN", ist es die Generalprobe. Dann nur in den Ordner
schreiben, den der Nutzer nennt (sonst `exports/probe/`), und beide Dokumente oben mit
„PROBEDATEN – Generalprobe" kennzeichnen.

## Schritt 2 – Quellenauszug erzeugen

Die Sicherung ist zum direkten Lesen ungeeignet (groß, bei Audio mehrere MB Base64, Einträge nach
Kennung statt nach Folien sortiert). Deshalb zuerst den Auszug: das Skript unten **unverändert** in einen
Arbeitsordner außerhalb des Repos schreiben (z. B. das Scratchpad oder das System-Temp als
`konzept-neu-arbeitsstand/konzept-quellen.mjs`) und im Repo-Wurzelverzeichnis ausführen:

```bash
node <arbeitsordner>/konzept-quellen.mjs "<eingabe>" --out=<arbeitsordner>
```

Es liest nur, braucht keine Pakete und legt im Arbeitsordner ab:

- `quellen.md` – alle Beiträge in Folienreihenfolge (Module und Folientitel aus `src/lib/manifest.ts`,
  Felder in der Reihenfolge der MDX-Datei), je Beitrag die Kennung `[<folie>:<feld>]`, Art, Markierungen
  (Poster-Feld, eigene Frage offen/beantwortet, KI-geglättet, KI-Auswertung) und abweichende
  Posterfassungen; dazu Barometer-Auswertung ohne Namen, Abdeckungsliste aller deklarierten Felder,
  Poster-Übersicht, Interview-Skalen, Glossar und **Hinweise** (veralteter Bericht, von Hand gesetzte
  Werte, unbekannte Folien, nicht freigegebene Begriffe, Probedaten).
- `transkripte.md` – Interview-Transkripte, nur für die Zitatprüfung.
- `hilfsquelle-ki-bericht.md` – der gespeicherte KI-Ergebnisbericht, falls vorhanden.
- `abdeckung.md` – Arbeitsblatt: jeder Beitrag mit Inhalt als Zeile, hinter dem Pfeil wird in Schritt 6
  eingetragen, wo er verarbeitet ist.
- `quellen.json` – Korpus für die automatische Prüfung in Schritt 6.

`quellen.md` vollständig lesen (bei mehr als 2000 Zeilen abschnittsweise). Alle **Hinweise** gehören
später in die Dokumente oder in die Abschlussmeldung.

## Schritt 3 – Die Quelle richtig lesen

**Aufbau der Sicherung** (`src/lib/backup.ts`): `{ format, version, createdAt, withAudio, stores, interviews, sessionTranscripts? }`.

- `stores.workshop` = das Protokoll: `meta` (`title`, `date`, `participantsList` mit Name, Vorname,
  Organisation, Rolle) und `entries`, ein Objekt Kennung → Eintrag
  `{ id, module, slideId, kind, prompt, value, raw?, updatedAt }`.
  - **Kennung** `<slideId>:<feld>`, z. B. `01.06:poster-kernproblem`. Das Feld entspricht dem
    `field`-Attribut in `src/content/<NN-MM>-*.mdx`; `prompt` ist die Frage auf der Folie.
  - **Reihenfolge** = Folienreihenfolge im Manifest, innerhalb der Folie die Reihenfolge der Felder in
    der MDX-Datei (`src/lib/field-order.ts`). Nie nach Kennung sortieren.
  - `kind`: `text` (Freitext) · `decision` und `vote` (genau eine gewählte Option als Text) ·
    `checklist` (Liste: bei `WorkshopInput` die angekreuzten Optionen, bei Karten die Karten).
  - `raw` = die ursprünglich diktierte Fassung, bevor die KI geglättet hat. Maßgeblich ist `value`
    (so hat die Runde den Text übernommen); `raw` nur zur Kontrolle bei Sinnverschiebungen.
- **Karten** (`CardCollector`, Felder `karten-…`): jede Zeile eine Karte, Präfixe `[Kategorie]` und
  `{Zeithorizont}` (in 02.07 Wissen · Assistenz · Automatisierung · Analyse und Heute · Morgen ·
  Übermorgen), „(2×)" = mehrfach genannt. Karten sind Rohmaterial, keine Beschlüsse.
- **Poster-Felder** `poster-…` auf den Poster-Folien 01.06, 02.08, 03.05, 04.06, 05.05, 06.05, 07.06
  tragen das verdichtete Phasenergebnis. Einige Poster zeigen zusätzlich Felder anderer Folien
  (z. B. 01.05 Warum-Treppe, 04.03 Ampeln, 05.03 Hypothese, 07.04 nächster Schritt) – die
  Poster-Übersicht im Auszug listet sie.
- **Posterfassung** `stores.poster.drafts[<poster>].fields[<kennung>]`: der kürzere Wortlaut, der auf
  dem gedruckten Poster steht und dort den Protokolltext ersetzt. Inhaltlich gilt das Protokoll; die
  Posterfassung darf als Poster-Wortlaut zitiert werden. Weicht sie inhaltlich ab (nicht nur kürzer),
  beide nennen. `image` = Posterbild, nicht auswerten.
- **Eigene Fragen** `<folie>:q-…`: `prompt` ist die Frage, `value` die Antwort; leerer `value` = **offen**.
  Offene eigene Fragen gehören immer in „Offene Fragen".
- **Notizen** `<folie>:notiz`: Freitext aus dem Live-Protokoll zu dieser Folie.
- **Mitschnitt** `<folie>:mitschnitt` (Frage „Aus der mitgeschnittenen Diskussion“): KI-Zusammenfassung der
  mitgeschnittenen Diskussion, im Nachgang von der Moderation geprüft und dieser Folie inhaltlich zugeordnet.
  Jede Zeile trägt den Zeitraum `[hh:mm:ss–hh:mm:ss]` (bei mehreren Aufnahmen `[Aufnahme n, …]`). Das ist eine
  **Nebenquelle**: Sie ergänzt Kontext, Begründungen, Einwände und offene Fragen, wiegt aber weniger als
  ausdrücklich erfasste Beiträge, Entscheidungen, Abstimmungen und Poster-Felder. Widerspricht sie einem
  erfassten Beitrag, gilt der Beitrag; den Unterschied als offen nennen. Aussagen, die nur hier stehen, im
  Text als „aus der Diskussion“ kennzeichnen (z. B. „In der Diskussion wurde genannt, dass …“), nie als
  Beschluss. Keine wörtlichen Zitate daraus – es ist bereits eine Zusammenfassung.
- **Volltranskript der Sitzung** `sessionTranscripts` (optional, in neueren Sicherungen): die Transkripte
  der Sitzungsaufnahme je Aufnahme in Abschnitten mit Zeitmarken, bereits von Privatem und Unangemessenem
  bereinigt (Marken wie `[Passage entfernt: …]` ignorieren, nichts daraus erschließen). Nur zum Nachschlagen,
  wenn eine `:mitschnitt`-Zusammenfassung unklar ist; nicht selbst neu zuordnen und nicht zitieren.
- **Barometer** 00.08 (vorher) und 07.02 (nachher): `…:barometer-vorher` (Art `vote`) enthält die
  Verteilung „Option: n · … (N Stimmen)"; `…-stimmen` die Einzelstimmen „Option — Name" (**Namen nie
  übernehmen**); `…-analyse` eine KI-Auswertung. Verteilung, mittlere Position und Bewegungen
  derselben Personen berechnet der Auszug; nur diese Zahlen verwenden.
- **Interviews** (Folie 01.02): `01.02:i1-haltung`, `i3-kompetenz`, `i4-relevanz-heute`,
  `i5-relevanz-morgen` sind **gemessene** Werte (Ø, σ, Spanne, n) – unverändert übernehmen, n immer
  mitnennen. Endet ein Wert auf „· von Hand gesetzt", ist er eine Einschätzung der Runde, kein Messwert.
  `i2-begriffe`, `i6-einsatzgebiete`, `i8-gruppenbild-kennzahlen` sind lokal ausgezählt;
  `01.02:interview-<id>` ist das KI-Meinungsbild je Interview; `i7-meinungsbild-gesamt` das gemeinsame
  Meinungsbild (vom Plenum ggf. geschärft); `i9-ergaenzungen` die Beobachtungen der Runde.
  `interviews[]` in der Sicherung hat Transkript, Meinungsbild und Skalen je Interview; Transkripte
  nur für wörtliche Zitate, nie zuordnen. `stores.interviewsGroup` ist der Rohtext des gemeinsamen
  Meinungsbilds (`count` = Anzahl Interviews, auf denen er beruht).
  Interviews gab es nur an Tag 1: Sie zeigen die **Ausgangshaltung**, keine Veränderung.
- **KI-Auswertungen** (`…-analyse`, Meinungsbilder, `04.00:rueckblick-fuenf-saetze`, der
  KI-Ergebnisbericht `stores.report`) sind **Hilfsquellen, nie Wahrheit**. Jede Aussage daraus nur
  übernehmen, wenn ein erfasster Beitrag sie trägt; Zahlen immer aus den Beiträgen. Der Bericht ist
  veraltet, wenn der Auszug es meldet (erstellt vor dem letzten Beitrag oder andere Beitragszahl).
- **Glossar** `stores.glossary.terms`: `approved: false` = nicht freigegeben, nur mit diesem Vermerk
  aufnehmen; `suggestions` sind nicht übernommene Vorschläge und bleiben weg. `99.01:glossar-workshop`
  spiegelt die Begriffe ins Protokoll.
- **Teilnehmende**: nur Anzahl und Rollen verwenden.

**Module und Folien** – Titel immer aus `src/lib/manifest.ts` (der Auszug schreibt sie in die
Überschriften), nicht aus dieser Liste; sie dient nur der Zuordnung:

| Modul | Inhalt (Folien mit Eingaben) |
|---|---|
| 0 | Erwartungen (00.04), Barometer vorher mit Begründungen (00.08) |
| 1 | Interviews und Gruppenbild (01.02), Karten Top-Herausforderungen (01.03), Problemfelder und Priorisierung (01.04), 5× Warum (01.05), Poster Kernproblem (01.06) |
| 2 | Wissen und Wissensbasis (02.09–02.11), Cloud oder lokal (02.12), Demo-Notizen (02.06), Fragen und Möglichkeiten mit Karten (02.07), Poster Möglichkeitsraum und Stoßrichtungen (02.08) |
| 3 | Stoßrichtungen gespiegelt (03.01), Aufgaben heute (03.02), Einstufung je Aufgabencluster (03.03), Profil (03.04), Poster Zielbild (03.05), Tagesbilanz (03.06) |
| 4 | Rückblick Tag 1 (04.00, KI-Rückblick + „was trägt noch"), Kernziele (04.01), eigene Erfahrungen (04.02), Prüfrahmen mit Ampeln (04.03), Datenschutz und Regeln (04.04), Risiken (04.05), Poster GO · ADAPT · STOP (04.06) |
| 5 | Argumentationslinien (05.02), Annahmen und 3-Jahres-Hypothese (05.03), strategischer Mehrwert (05.04), Poster Business Case (05.05) |
| 6 | Rückblick (06.01), Prioritäten und Quick Wins (06.02), Meilensteine (06.03), Verantwortung und Ressourcen (06.04), Poster Roadmap (06.05) |
| 7 | Barometer nachher (07.02), offene Fragen (07.03), Beschluss (07.04), Poster Commitment (07.06), Feedback (07.07) |
| 99 | Glossar (99.01) |

Taucht im Manifest eine Folie auf, die hier fehlt, gilt das Manifest; ihre Einträge nicht übergehen.

## Schritt 4 – Ergebnisdokument schreiben

Datei: `<ausgabe>/ergebnis-fbs-ki-geschaeftsfuehrer.md`. Leser: der Vorstand, der nicht dabei war.
Ziel: in zehn Minuten verstehen, was wir erarbeitet haben, was entschieden ist und was offen bleibt.

**Markierungen** (fett, am Satzanfang oder als Listenpräfix):

- **Entschieden:** von der Runde ausdrücklich festgelegt oder bestätigt (Entscheidungsfelder,
  Poster-Commitments, GO/STOP, Beschlussvorschlag 07.04). Die Runde beschließt für den Verband nur
  Empfehlungen; was der Vorstand noch beschließen muss, so benennen.
- **Bedingung:** Voraussetzung oder Auflage, an die eine Entscheidung geknüpft ist (07.04 Bedingungen,
  „Ja, mit Vorbehalt", ADAPT, Gelb-Ampeln mit Begründung).
- **Offen:** nicht geklärt, widersprüchlich, als Frage erfasst oder ohne Eintrag.

Abstimmungs- und Ampelergebnisse ohne Festlegung (z. B. „Hält eher", „Grün: machbar") sind
**Einschätzungen** der Runde: so formulieren und mit „Einschätzung:" statt „Entschieden:" markieren.

**Quellenangabe:** Folie in Klammern am Absatz- oder Listenende, z. B. „(01.06)", mehrere „(04.05, 04.06)".
Keine Feldnamen im Fließtext – die stehen im PRD.

**Anführungszeichen „…"** nur für wörtliche Zitate aus dem Erfassten. Keine Anführungszeichen um
Umschreibungen, Poster-Beschriftungen aus dem Code oder eigene Zusammenfassungen. Englische oder
fachsprachliche Folienbegriffe (etwa „Talk & Work", „RAG") in Alltagssprache übertragen; Leser ist ein
Vorstand ohne KI-Vorwissen.

**Gliederung:**

```
# Ergebnisdokument: KI-Geschäftsführer: Fiktion oder Realität?
Kopf: Fachverband Betonbohren und -sägen Deutschland e. V. · Workshop 16./17. September 2026 ·
      Moderation Harald Ostermann und Dr. Stefan Reinheimer · Stand <Datum> ·
      Quelle <Dateiname>, gesichert <createdAt> · <n> Beiträge, <n> Teilnehmende ·
      Status: Entwurf zur Freigabe
## Auf einen Blick
   – unsere Antwort auf die Leitfrage (07.06 poster-antwort, wörtlich)
   – Barometer vorher → nachher in einem Satz
   – unser nächster Schritt (07.04) mit den Bedingungen
   – 4–6 Kernaussagen, je mit Markierung
## Ausgangslage und Haltung zu Beginn
   – Anlass in zwei Sätzen (darf aus docs/workshop-konzept.md „Rahmen" stammen, ohne Förderthema)
   – Erwartungen (00.04), Barometer vorher mit Begründungen (00.08)
   – Interviews: gemessene Werte mit n, gemeinsames Meinungsbild, Ergänzungen der Runde (01.02)
## Phase 1 · <Titel Modul 1 aus dem Manifest>
## Phase 2 · …   (bis Phase 7, je gleiche Unterstruktur)
   ### Ergebnis
       Die Poster-Felder der Phase, als kurze Liste oder Tabelle, inhaltlich vollständig.
   ### Wie wir dahin gekommen sind
       Der Weg in 3–8 Sätzen aus den übrigen Feldern der Phase: Material (Karten, Fragen),
       Bündelung, Abwägung, abweichende Meinungen, Einstufungen.
   ### Stand
       Entschieden / Einschätzung / Bedingung / Offen als Liste.
## Wie sich unsere Haltung verändert hat
   – Tabelle Barometer vorher/nachher je Option, mittlere Position, Bewegung derselben Personen (Auszug)
   – Begründungen (07.02), was über Nacht anders gesehen wurde (04.00 traegt-noch)
   – Hinweis, dass die Interviews nur die Ausgangslage messen
## Offene Fragen
   – 07.03, alle offenen eigenen Fragen (q-…), aus Tag 1 Offengebliebenes (03.06), das an Tag 2
     nicht beantwortet wurde, und alle gefundenen Widersprüche; je Frage wer klärt bis wann (07.03,
     07.04), sonst „noch niemand benannt"
## Nächste Schritte und Verantwortliche
   – Tabelle Schritt · verantwortlich (Rolle) · bis wann · Quelle (07.04, 07.06, 06.02, 06.04)
## Anhang
   ### Feedback zum Workshop (07.07)
   ### Im Workshop ergänzte Begriffe (freigegebene; nicht freigegebene mit Vermerk)
   ### Quellen: Beiträge, die bewusst nicht verwendet wurden, mit Grund (aus abdeckung.md);
       Hinweise aus dem Auszug (z. B. veralteter KI-Bericht). Keine Aussage wie „alle Felder
       verwendet", bevor die Prüfung in Schritt 6 das bestätigt hat.
```

Phase 4 beginnt mit dem Rückblick 04.00: nur „was trägt noch" als Ergebnis verwenden, den KI-Rückblick
höchstens als Hilfsquelle. Phase 7 enthält das Commitment-Poster; Barometer und offene Fragen stehen in
den eigenen Kapiteln und werden in Phase 7 nur verwiesen.

Stil: klare, vollständige Sätze im Ton eines Verbandsprotokolls; Tabellen für Einstufungen, Ampeln,
Meilensteine und Verantwortliche; keine Floskeln, keine Wertungen der Moderation.

## Schritt 5 – PRD schreiben

Datei: `<ausgabe>/prd-fbs-ki-geschaeftsfuehrer.md`. Leser: Vorstand, Arbeitsgruppe und später ein
Umsetzungspartner. Das PRD beschreibt **was** gebraucht wird und **warum**, nicht womit.

**Herkunft:** jede Anforderung, jedes Ziel, jede Rolle, jedes Kriterium mit Kennung(en) in Backticks,
z. B. `03.04:faehigkeiten`. Immer die **vollständige** Kennung, eine je Backtick-Paar: keine Platzhalter
(`05.02:*`, `cluster-*`), keine Bereiche (`warum-1` … `warum-5`), keine Kurzformen (`-morgen`) – die
Prüfung in Schritt 6 erkennt sonst nicht, dass der Beitrag verwendet wurde. Bei Protokoll-Markdown ohne
Feldnamen: Folie und Frage, z. B. Folie 03.04, Frage „Fähigkeiten: Was kann er?".

**Funktionale Anforderung** = etwas, das die KI-Unterstützung selbst leisten muss. Organisatorische
Maßnahmen (Schulung, Kommunikation, Pflegezeit, Messung der Zeitersparnis) gehören zu den
nicht-funktionalen Anforderungen „Einführung" bzw. „Betrieb", zu den Erfolgskriterien oder zu Kapitel 9.

**Status je Anforderung:**

- `erarbeitet` – steht so (sinngemäß) in einem Beitrag.
- `abgeleitet` – folgt zwingend aus einem Beitrag (z. B. „Antworten nur mit Quelle" ⇒ Quellenangabe
  in jeder Antwort). Die Ableitung in einem Halbsatz begründen. Keine Ableitung aus Allgemeinwissen.

**Priorität und Horizont** nur, wenn erfasst: Horizont aus Meilensteinen und Postern der Roadmap
(06.03, 06.05), Priorität aus Handlungsfeldern, Quick Wins und Karten (06.02). Sonst „nicht
festgelegt". Keine MoSCoW-Einstufung erfinden.

**Gliederung:**

```
# PRD: KI-Unterstützung der Geschäftsstelle des FBS
Kopf wie beim Ergebnisdokument, dazu Version 0.1 und Legende (Herkunft, Status, Horizont)
## 1. Ausgangslage und Problem            (Modul 1: Kernproblem, Ursachen-Treppe, Problemfelder,
                                           Priorisierung, Zeitfresser 03.02, Wissensrisiko 02.09)
## 2. Ziele und Nicht-Ziele                (Ziele: 04.01, 03.04 Leitprinzipien/Nutzen, 02.08 Stoßrichtungen;
                                           Nicht-Ziele: 03.04 „ist nicht", 04.06 STOP, 03.03 „Bewusst beim
                                           Menschen", 04.04 „darf nicht")
## 3. Nutzer und Rollen                    Tabelle Rolle · Bedarf · Nutzung · Rechte/Freigaben · Herkunft
                                           für Geschäftsführung, Assistenz der Geschäftsstelle, Vorstand,
                                           Mitgliedsbetriebe, dazu Ausschüsse, wenn erfasst.
                                           Leere Zellen: „nicht erarbeitet".
## 4. Aufgaben und Use Cases
   ### 4.1 Einstufung der Aufgaben         Tabelle aller 03.03-Cluster: Cluster · übernehmen (mit Freigabe) /
                                           unterstützen / bewusst nicht · Begründung (03.03:begruendung) ·
                                           Herkunft; ergänzte Aufgaben und Zeitfresser (03.02)
   ### 4.2 Erste Use Cases                 aus 03.04:erste-use-cases, je mit Nutzen, beteiligten Rollen und
                                           Horizont, soweit erfasst
   ### 4.3 Möglichkeitsraum                Karten 02.07 und Poster 02.08 als Tabelle Kategorie × Zeithorizont –
                                           ausdrücklich keine Anforderungen, sondern Material
## 5. Funktionale Anforderungen            Tabelle FA-01 … : Anforderung · Status · Herkunft · Horizont
## 6. Nicht-funktionale Anforderungen      NFA-01 … gruppiert: Datenschutz und Datenhaltung (02.12, 04.04) ·
                                           Verantwortung und Freigabe (03.04, 04.04) · Qualität und Quellen
                                           (02.07) · Akzeptanz und Einführung (04.02, 04.03, 04.05, 04.06) ·
                                           Betrieb und Pflege (04.03, 06.04) · Unabhängigkeit/Portabilität,
                                           wenn erfasst
## 7. Erfolgskriterien und Wirtschaftlichkeit
                                           Kriterien (04.05 Erfolgsfaktoren, 05.04 Begründung, 06.03, 07.07
                                           sechs Monate) · Annahmen und Bandbreiten wörtlich als Annahmen der
                                           Runde (05.03, 05.05) · Hypothese mit Abstimmungsergebnis (05.03) ·
                                           Argumentationslinien (05.02) · Einwände und Antworten (05.05)
## 8. Phasen und Meilensteine              Tabelle 100 Tage · 12 · 24 · 36 Monate (06.03 und 06.05 abgleichen;
                                           Abweichungen nennen), Handlungsfelder und Quick Wins (06.02)
## 9. Entscheidungen und Verantwortliche   Beschluss und Bedingungen (07.04), Beschlüsse (07.06), Rollen und
                                           Ressourcen (06.04) – Verantwortliche nur als Rolle
## 10. Offene Fragen, Annahmen, Abhängigkeiten
                                           OF-01 … (07.03, offene q-…, Widersprüche, nicht erarbeitete
                                           PRD-Bestandteile) · AN-01 … (als Annahme erfasst) ·
                                           Abhängigkeiten (06.04)
## Anhang: Rückverfolgbarkeit              Tabelle Kennung → verwendet in (FA/NFA/OF/Kapitel), eine Zeile
                                           je Kennung; darunter jede Kennung mit Inhalt, die im PRD bewusst
                                           nicht verwendet wurde, mit Grund (z. B. Haltung statt Anforderung,
                                           Feedback, KI-Auswertung). Einzelstimmen (`…-stimmen`) nie aufführen.
```

Typische Bestandteile eines PRD, die im Workshop **nicht** erarbeitet wurden (Mengengerüst,
Verfügbarkeit, Schnittstellen im Detail, Budgetzahl, Betriebsform), stehen unter 10 als offene Frage
– nicht als Anforderung und nicht als Empfehlung.

## Schritt 6 – Prüfen

1. Automatisch, je Dokument:

   ```bash
   node <arbeitsordner>/konzept-quellen.mjs --pruefen "<ausgabe>/ergebnis-fbs-ki-geschaeftsfuehrer.md" --out=<arbeitsordner>
   node <arbeitsordner>/konzept-quellen.mjs --pruefen "<ausgabe>/prd-fbs-ki-geschaeftsfuehrer.md" --out=<arbeitsordner>
   ```

   Gemeldet werden (Ausgang ≠ 0, solange etwas gefunden wird):
   - `zitateNichtWoertlich` – Text in „…" ab 12 Zeichen, der weder in einem Beitrag, einer Posterfassung
     noch einem Transkript wörtlich steht (Überschriften des Dokuments selbst sind ausgenommen). Entweder
     wörtlich machen oder die Anführungszeichen entfernen.
   - `personennamen`, `produktnamen`, `wilmaInUeberschrift`, `foerderung`.
   - `folienOhneVerweis` – Folien mit Beiträgen, auf die das Dokument nirgends verweist.
   - `kennungenOhneVerweis` (nur bei Dokumenten mit Kennungen, also dem PRD) – Beiträge mit Inhalt, deren
     vollständige Kennung nirgends steht, auch nicht unter „bewusst nicht verwendet".
   Jeden Befund beheben und erneut prüfen, bis beide Dokumente ohne Befund sind. Kurze Begriffe in
   Anführungszeichen (unter 12 Zeichen) selbst gegenlesen.
2. **Abdeckung des Ergebnisdokuments, Feld für Feld:** `abdeckung.md` im Arbeitsordner ausfüllen –
   hinter jedem → das Kapitel, in dem der Beitrag steht, oder „nicht verwendet, weil …". Dabei jeden
   Beitrag wirklich im Dokument suchen; Fehlendes einarbeiten oder den Grund nennen. Dann
   `node <arbeitsordner>/konzept-quellen.mjs --pruefen <arbeitsordner>/abdeckung.md --out=<arbeitsordner>`
   – `abdeckungOffen` muss leer sein. Die „nicht verwendet"-Zeilen gehen in den Anhang „Quellen".
   Jedes Poster-Feld (Poster-Übersicht in `quellen.md`) muss im „Ergebnis" seiner Phase stehen.
3. **Gegenlesen** mit den Augen eines Vorstandsmitglieds:
   - Ist „Auf einen Blick" ohne den Rest verständlich?
   - Steht irgendwo eine Zahl, eine Frist, ein Name oder eine Begründung, die nicht im Auszug steht?
   - Klingt ein Satz nach Empfehlung, obwohl die Runde nichts festgelegt hat?
   - Passen Termine und Reihenfolgen zusammen (z. B. ein Kick-off vor der Entscheidung, die ihn
     ermöglicht; eine Frist vor ihrer Voraussetzung)? Unstimmigkeiten als offen benennen.
   - Sind Einschätzungen als Einschätzung und nicht als Entscheidung formuliert?

## Schritt 7 – Word und PDF

Das Repo hat **keinen** Kommandozeilen-Export für freie Markdown-Dokumente: `npm run export:pdf` druckt
nur das Folien-Deck, und die Word-/PDF-Erzeugung (`src/lib/export-docx.ts`, `export-html.ts`) läuft
nur im Browser. Pandoc ist nicht vorausgesetzt. Verlässliche Wege:

**A – über die App (empfohlen, gestaltet wie das Protokoll):** Der KI-Ergebnisbericht der App ist ein
freier Markdown-Text, den die Seite `/protokoll` als PDF und Word ausgibt (Titelseite, Inhaltsverzeichnis,
Kapitel je `##`, Glossar). So wird ein Dokument dort hineingebracht:

1. In der App unter Einstellungen zuerst eine aktuelle Sicherung herunterladen.
2. Eine Kopie der Quell-Sicherung erzeugen, in der nur `stores.report` durch das Dokument ersetzt ist
   (ohne die `#`-Titelzeile, damit die `##`-Überschriften zu Kapiteln werden):
   `node <arbeitsordner>/konzept-quellen.mjs --bericht "<ausgabe>/<dokument>.md" "<quell-sicherung>.json" --out=<arbeitsordner>`
   → `<arbeitsordner>/sicherung-mit-<dokument>.json`. Geht nur mit einer Sicherung als Quelle. In der
   Kopie ist die Teilnehmerliste durch die Anzahl ersetzt, weil die Titelseite der App sonst alle Namen
   druckt.
3. Einstellungen → „Sicherung auswählen" → Kopie wählen → „Einlesen und ersetzen". Bis auf Bericht und
   Teilnehmerliste entspricht die Kopie der Quelle.
4. `/protokoll` → Abschnitt Ergebnisbericht → „Als Word" (lädt `workshop-ergebnisbericht-<datum>.docx`)
   oder „Als PDF" (Druckdialog, „Als PDF speichern"). Datei passend umbenennen.
5. Für das zweite Dokument Schritte 2–4 wiederholen. **Zum Schluss die Sicherung aus Schritt 1 wieder
   einlesen** – sonst fehlen auf dem Gerät die Teilnehmerliste und der ursprüngliche Bericht.

Grenzen: Die Titelseite heißt „Ergebnisbericht" und trägt den Satz „KI-gestützt aus den im Workshop
erfassten Beiträgen verdichtet …"; der Kopf vor dem ersten `##` erscheint als Kapitel „Vorbemerkung",
das Glossar der Folie 99.01 wird angehängt. Links, Bilder und HTML werden nicht dargestellt; Tabellen,
Listen, Fett und Zitate schon. Diesen Weg beschreibt der Command dem Nutzer; er bedient nicht selbst
den Browser des Nutzers.

**B – Pandoc, nur wenn vorhanden:** `pandoc --version` prüfen; wenn ja:
`pandoc "<datei>.md" -o "<datei>.docx"`. Ohne gestaltete Titelseite. Nicht installieren, ohne zu fragen.

## Schritt 8 – Folien aktualisieren (nur mit `--folien` oder auf ausdrücklichen Wunsch)

Nur Poster- und Commitment-Folien (`01.06`, `02.08`, `03.05`, `04.06`, `05.05`, `06.05`, `07.06`) um die
Ergebnisse ergänzen, `researchedOn` auf heute setzen. MDX-Regeln aus `CLAUDE.md`: keine geraden `"` in
JSX-Attributwerten, kein rohes `<` im Text, Farben nur über Variablen, `SpeakerNotes` erhalten,
`WorkshopInput`-Felder nicht umbenennen (sonst verlieren erfasste Beiträge ihre Folie). Danach
`npm run build` und `npm run export:pdf -- --lang=de` (→ `exports/workshop-de.pdf`). Laufen parallel
andere Arbeiten an `src/**`, vorher fragen.

## Schritt 9 – Interne Capability-Map (nur mit `--intern`)

Nur auf ausdrücklichen Wunsch von Dr. Stefan Reinheimer. Die Map ist ein **BIK-internes**
Arbeitspapier und kein Workshop-Ergebnis; die Neutralitätsregel des Workshops gilt für alles, was
an den FBS geht, und wird durch diese Datei nicht berührt, solange sie getrennt bleibt.

- Erst wenn Ergebnisdokument und PRD fertig und geprüft sind. Das PRD danach **nicht** mehr ändern, um
  es an Produkte anzupassen.
- Eigene Datei `<ausgabe>/intern-capability-map.md`, erste Zeile:
  `> INTERN – BIK GmbH. Nicht Teil der Workshop-Ergebnisse, nicht an den FBS weitergeben.`
- Weder Ergebnisdokument noch PRD verweisen auf die Map oder nennen BIK-Produkte; nach dem Schreiben
  beide erneut mit `--pruefen` testen.
- Inhalt: Tabelle je FA-/NFA-Kennung aus dem PRD → Komponente (CDB, PDB, TQS, Composer, Mira) ·
  Status `vorhanden` / `teilweise` / `zu bauen` / `unbekannt` · Begründung · Quelle der Einschätzung.
- Quellen für Fähigkeiten: `docs/content-brief.md`, `docs/old-content/` (CDBrain, PDB, Composer) und
  Angaben des Nutzers. Zu **TQS** und **Mira** gibt es im Repo keine Beschreibung: Status `unbekannt`
  und den Nutzer um einen Steckbrief bitten (was es ist, was es heute kann, Reifegrad, Grenzen,
  Schnittstellen). Keine Fähigkeiten erfinden.

## Schritt 10 – Abschlussmeldung

Kurz melden: verwendete Quelle (Datei, Format, Stand, Probedaten ja/nein, liegen gebliebene Dateien),
erzeugte Dateien, Hinweise aus dem Auszug, Ergebnis der Prüfung, offene Punkte, die vor der Freigabe
geklärt werden müssen (Widersprüche, nicht freigegebene Begriffe, veraltete KI-Auswertungen), und den
Weg zu Word/PDF.

## Abschluss-Checkliste

- [ ] Quelle genannt; bei mehreren Sicherungen die neueste genommen und das gesagt; Beitragszahl plausibel.
- [ ] Probedaten erkannt und gekennzeichnet (falls zutreffend).
- [ ] `quellen.md` vollständig gelesen, alle Hinweise berücksichtigt.
- [ ] Jedes Poster-Feld (Poster-Übersicht) steht im „Ergebnis" seiner Phase.
- [ ] `abdeckung.md` vollständig ausgefüllt und geprüft (`abdeckungOffen` leer); Nicht-Verwendetes mit Grund im Anhang.
- [ ] Entschieden · Einschätzung · Bedingung · Offen sind konsequent markiert; Widersprüche und unstimmige Termine als offen genannt.
- [ ] Leitfrage-Antwort, Barometer vorher/nachher und nächster Schritt stehen in „Auf einen Blick".
- [ ] Interview-Werte mit n; von Hand gesetzte Werte als Einschätzung gekennzeichnet.
- [ ] KI-Auswertungen und KI-Bericht nur als Hilfsquelle genutzt; nichts daraus ohne Beleg übernommen.
- [ ] PRD: jede FA/NFA mit vollständiger Kennung und Status; FA nur Systemleistungen; nichts Nicht-Erarbeitetes als Anforderung; offene Fragen nummeriert.
- [ ] `--pruefen` für beide Dokumente ohne Befund (Zitate wörtlich, keine Namen, keine Produkte, keine Wilma-Überschrift, kein Förderthema, keine Folie und – im PRD – keine Kennung ohne Verweis).
- [ ] Keine Empfehlung, keine Werkzeugauswahl, keine Disclaimer-Floskeln; durchgehend „wir".
- [ ] Status „Entwurf zur Freigabe" im Kopf beider Dokumente.
- [ ] Capability-Map nur mit `--intern`, separat, als intern gekennzeichnet, nirgends verlinkt.

## Anhang: `konzept-quellen.mjs`

Unverändert in den Arbeitsordner schreiben (Schritt 2).

```js
// konzept-quellen.mjs — Quellenauszug für /konzept-neu (nur lesen, keine Abhängigkeiten).
// Aufruf im Repo-Wurzelverzeichnis:
//   node konzept-quellen.mjs <eingabe.json|.md> --out=<ordner>
//   node konzept-quellen.mjs --pruefen <dokument.md> --out=<ordner>   (Zitate, Namen, Produktnamen)
//   node konzept-quellen.mjs --bericht <dokument.md> <sicherung.json> --out=<ordner>   (Kopie für Word/PDF in der App)
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const opt = (k) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3);
const OUT = path.resolve(opt("out") ?? "konzept-arbeitsstand");
const REPO = path.resolve(opt("repo") ?? ".");
fs.mkdirSync(OUT, { recursive: true });

/* ---------------------------------------------------------------- Prüfmodus */
if (args[0] === "--pruefen") {
  const doc = fs.readFileSync(args[1], "utf8");
  const src = JSON.parse(fs.readFileSync(path.join(OUT, "quellen.json"), "utf8"));
  const lines = doc.split(/\r?\n/);
  const norm = (s) => s.replace(/[„“”"‚‘’']/g, "").replace(/\s+/g, " ").trim().toLowerCase();
  const corpus = norm(src.corpus.join(" "));
  // Überschriften des Dokuments selbst dürfen in „…" stehen (Kapitelverweise).
  const headings = new Set(lines.filter((l) => /^#+ /.test(l)).map((l) => norm(l.replace(/^#+\s*/, ""))));
  const quotes = [...doc.matchAll(/„([^“]{12,})“/g)].map((m) => m[1]).filter((q) => !headings.has(norm(q)));
  const missing = quotes.filter((q) => norm(q).split(/\s*(?:\[…\]|…)\s*/).some((part) => part && !corpus.includes(part)));
  const escape = (n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const hits = (list) => list.filter((n) => n && new RegExp(`(^|[^\\p{L}])${escape(n)}($|[^\\p{L}])`, "iu").test(doc));
  const filled = src.entries.filter((e) => (Array.isArray(e.value) ? e.value.length : String(e.value ?? "").trim()) && !/-stimmen$/.test(e.id));
  // Folien mit Inhalt, auf die das Dokument nirgends verweist.
  const folienOhneVerweis = [...new Set(filled.map((e) => e.slideId))].filter((id) => !doc.includes(id));
  // Dokumente mit Kennungen (PRD): jede Kennung mit Inhalt muss vollständig vorkommen, verwendet oder als bewusst nicht verwendet.
  const cited = doc.match(/`\d\d\.\d\d:[^`\s]+`/g) ?? [];
  const kennungenOhneVerweis = cited.length >= 5 ? filled.map((e) => e.id).filter((id) => !doc.includes("`" + id + "`")) : [];
  const report = {
    zitateGeprueft: quotes.length,
    zitateNichtWoertlich: missing,
    personennamen: hits(src.names),
    produktnamen: hits(src.products),
    wilmaInUeberschrift: lines.filter((l) => /^#/.test(l) && /wilma/i.test(l)),
    foerderung: lines.filter((l) => /förder/i.test(l)),
    folienOhneVerweis,
    kennungenOhneVerweis,
    // Nur für abdeckung.md: Zeilen, hinter deren Pfeil noch nichts steht.
    abdeckungOffen: lines.filter((l) => /^- `.+→\s*$/.test(l)),
  };
  console.log(JSON.stringify(report, null, 2));
  // Das Arbeitsblatt enthält die Fragen im Wortlaut (auch Produktnamen) – dort zählt nur die Abdeckung.
  const worksheet = /^# Abdeckung Ergebnisdokument/m.test(doc);
  const fail = worksheet
    ? [report.abdeckungOffen, kennungenOhneVerweis]
    : [missing, report.personennamen, report.produktnamen, report.wilmaInUeberschrift, report.foerderung, folienOhneVerweis, kennungenOhneVerweis];
  process.exit(fail.some((l) => l.length) ? 1 : 0);
}

/* ------------------------------------------- Berichtsmodus (Word/PDF über die App) */
if (args[0] === "--bericht") {
  const doc = fs.readFileSync(args[1], "utf8").replace(/^﻿/, "");
  const backup = JSON.parse(fs.readFileSync(args[2], "utf8"));
  if (backup.format !== "verbands-ceo-backup") throw new Error("--bericht braucht eine Sicherung als zweite Datei.");
  const all = Object.values(backup.stores?.workshop?.entries ?? {});
  const counted = all.filter((e) => (Array.isArray(e.value) ? e.value.length : String(e.value ?? "").trim()) || e.id.split(":")[1]?.startsWith("q-"));
  // Ohne die #-Titelzeile werden die ##-Überschriften zu Kapiteln des gestalteten Berichts.
  const markdown = doc.replace(/^\s*# .*\r?\n/, "").trim();
  // Nicht älter als der jüngste Beitrag, sonst meldet die App den Bericht als veraltet.
  const latest = all.map((e) => String(e.updatedAt ?? "")).sort().pop() ?? "";
  const now = new Date().toISOString();
  backup.stores.report = { markdown, createdAt: latest > now ? latest : now, entryCount: counted.length, lang: "de", hints: "" };
  // Die Titelseite der App druckt die Teilnehmerliste mit Namen; in der Kopie steht nur die Anzahl.
  const meta = backup.stores.workshop?.meta;
  if (meta && Array.isArray(meta.participantsList) && meta.participantsList.length) {
    meta.participants = `${meta.participantsList.length} Personen`;
    meta.participantsList = [];
  }
  const target = path.join(OUT, `sicherung-mit-${path.basename(args[1], ".md")}.json`);
  fs.writeFileSync(target, JSON.stringify(backup));
  console.log(`Sicherungskopie mit Bericht: ${target}`);
  process.exit(0);
}

/* ----------------------------------------------------------- Repo-Wissen */
const read = (p) => fs.readFileSync(path.join(REPO, p), "utf8");
const manifestSrc = read("src/lib/manifest.ts");
const modules = [];
for (const block of manifestSrc.split(/\n  \{\n/).slice(1)) {
  const index = Number(/index:\s*(\d+)/.exec(block)?.[1]);
  const title = /title:\s*\{\s*de:\s*"([^"]*)"/.exec(block)?.[1];
  const slides = [...block.matchAll(/\{\s*id:\s*"(\d\d\.\d\d)"[^}]*?title:\s*\{\s*de:\s*"([^"]*)"/g)].map((m) => ({ id: m[1], title: m[2] }));
  if (Number.isFinite(index) && title) modules.push({ index, title, slides });
}
const slideList = modules.flatMap((m) => m.slides.map((s) => ({ ...s, module: m.index })));
const slideRank = new Map(slideList.map((s, i) => [s.id, i]));
const slideTitle = new Map(slideList.map((s) => [s.id, s.title]));

// Deklarierte Felder je Folie in Reihenfolge der MDX-Datei (wie src/lib/field-order.ts).
const FIELD_RE = /(?<![\w-])field\s*=\s*(?:"([^"]*)"|'([^']*)'|\{\s*["']([^"']*)["']\s*\})/g;
const declared = new Map();
for (const f of fs.readdirSync(path.join(REPO, "src/content")).filter((x) => /^\d\d-\d\d.*\.mdx$/.test(x))) {
  const id = `${f.slice(0, 2)}.${f.slice(3, 5)}`;
  const src = read(`src/content/${f}`);
  const ranks = new Map();
  for (const m of src.matchAll(FIELD_RE)) {
    const field = m[1] ?? m[2] ?? m[3];
    if (field && !ranks.has(field)) {
      const tag = src.slice(src.lastIndexOf("<", m.index), src.indexOf(">", m.index) + 1);
      ranks.set(field, { rank: ranks.size, prompt: /prompt="([^"]*)"/.exec(tag)?.[1] ?? "" });
    }
  }
  declared.set(id, ranks);
}
const fieldRank = (id) => {
  const [slide, field] = [id.slice(0, id.indexOf(":")), id.slice(id.indexOf(":") + 1)];
  const ranks = declared.get(slide);
  if (!ranks) return Infinity;
  if (ranks.has(field)) return ranks.get(field).rank;
  let best = Infinity;
  let len = -1;
  for (const [name, r] of ranks) {
    if (name.length > len && field.startsWith(`${name}-`)) {
      best = r.rank + 0.5;
      len = name.length;
    }
  }
  return best;
};
const compare = (a, b) =>
  (slideRank.get(a.slideId) ?? 1e9) - (slideRank.get(b.slideId) ?? 1e9) || fieldRank(a.id) - fieldRank(b.id) || a.id.localeCompare(b.id);

// Poster: welche Einträge ein Poster zeigt (src/lib/posters.ts).
const postersSrc = read("src/lib/posters.ts");
const posters = [...postersSrc.matchAll(/\n  \{\n    key: "([a-z-]+)",[\s\S]*?slideId: "(\d\d\.\d\d)",[\s\S]*?title: \{ de: "([^"]*)"([\s\S]*?)\n  \},/g)].map((m) => ({
  key: m[1],
  slideId: m[2],
  title: m[3],
  entryIds: [...new Set([...m[4].matchAll(/entryId: "([^"]+)"/g)].map((x) => x[1]))],
}));

// Laut scheitern, statt einen leeren Auszug zu liefern, falls sich das Format der Quelldateien ändert.
if (modules.length < 8 || slideList.length < 40) throw new Error(`Manifest nicht lesbar (${modules.length} Module, ${slideList.length} Folien) – Skript an src/lib/manifest.ts anpassen.`);
if (posters.length < 7) throw new Error(`Poster nicht lesbar (${posters.length}) – Skript an src/lib/posters.ts anpassen.`);
if ([...declared.values()].reduce((n, r) => n + r.size, 0) < 100) throw new Error("Zu wenige Eingabefelder in src/content gefunden – Skript prüfen.");

/* ---------------------------------------------------------------- Eingabe */
const input = args[0];
if (!input) throw new Error("Pfad zur Sicherung oder zum Protokoll fehlt.");
const raw = fs.readFileSync(input, "utf8").replace(/^﻿/, "");
let format;
let workshop;
let stores = {};
let interviews = [];
let createdAt = "";
const warnings = [];

if (/^\s*[{[]/.test(raw)) {
  const data = JSON.parse(raw);
  if (data.format === "verbands-ceo-backup") {
    if (data.version > 1) throw new Error(`Sicherung Version ${data.version} ist neuer als dieser Auszug (1).`);
    format = "Sicherung";
    stores = data.stores ?? {};
    workshop = stores.workshop ?? { meta: {}, entries: {} };
    interviews = Array.isArray(data.interviews) ? data.interviews : [];
    createdAt = data.createdAt ?? "";
  } else if (data.format === "verbands-ceo-interviews") {
    throw new Error("Das ist nur ein Interview-Export, kein Protokoll. Bitte Sicherung oder Protokoll angeben.");
  } else if (data.entries && typeof data.entries === "object") {
    format = "Protokoll-JSON";
    workshop = data;
    warnings.push("Nur Protokoll-JSON: Posterfassung, Glossar-Status, Interviews (Transkripte, Skalen) und Gruppenmeinung fehlen.");
  } else {
    throw new Error("Unbekanntes JSON-Format.");
  }
} else if (/^# Workshop-Protokoll/m.test(raw)) {
  format = "Protokoll-Markdown";
  const entries = {};
  let current = null;
  for (const line of raw.split(/\r?\n/)) {
    const h = /^### (.*)$/.exec(line);
    const ref = /^\*\(Folie (\d\d\.\d\d) · (\w+)\)\*$/.exec(line);
    if (h) current = { prompt: h[1], lines: [] };
    else if (ref && current) {
      current.slideId = ref[1];
      current.kind = ref[2];
      current.id = `${ref[1]}:${current.prompt}`;
      entries[current.id] = current;
    } else if (/^_Mitschnitt: zusammengefasst aus der mitgeschnittenen Diskussion_$/.test(line)) {
      // Kennzeichnung aus dem Markdown-Export, kein Inhalt.
    } else if (current?.id && !/^## /.test(line)) current.lines.push(line);
    if (/^## /.test(line)) current = null;
  }
  for (const e of Object.values(entries)) {
    e.value = e.lines.join("\n").trim().replace(/^_\(keine Eingabe\)_$/, "");
    e.module = Number.parseInt(e.slideId, 10);
    delete e.lines;
  }
  workshop = { meta: { title: /^# Workshop-Protokoll — (.*)$/m.exec(raw)?.[1] ?? "" }, entries };
  warnings.push("Nur Protokoll-Markdown: keine Feldnamen (Herkunft = Folie + Frage), keine Posterfassung, keine Interviews, Karten-Einordnung nur als Text.");
} else {
  throw new Error("Weder Sicherung noch Protokoll erkannt.");
}

/* ------------------------------------------------------------ Aufbereitung */
const meta = workshop.meta ?? {};
const people = (meta.participantsList ?? []).filter((p) => p && [p.lastName, p.firstName, p.organisation, p.role].some((v) => String(v ?? "").trim()));
const entries = Object.values(workshop.entries ?? {}).filter((e) => e && e.id && e.slideId).sort(compare);
const isAdhoc = (e) => e.id.split(":")[1]?.startsWith("q-");
const hasValue = (e) => (Array.isArray(e.value) ? e.value.length > 0 : String(e.value ?? "").trim() !== "");
const card = (l) => {
  let rest = l;
  const labels = [];
  const g = /^\[([^\]]+)\]\s*/.exec(rest);
  if (g) {
    labels.push(g[1]);
    rest = rest.slice(g[0].length);
  }
  const t = /^\{([^}]+)\}\s*/.exec(rest);
  if (t) {
    labels.push(t[1]);
    rest = rest.slice(t[0].length);
  }
  return labels.length ? `${rest} (${labels.join(" · ")})` : rest;
};
const posterOf = new Map();
for (const p of posters) for (const id of p.entryIds) posterOf.set(id, [...(posterOf.get(id) ?? []), p.key]);
const drafts = stores.poster?.drafts ?? {};

const title = String(meta.title ?? "");
const probe = /PROBEDATEN/i.test(title);
const lastUpdate = entries.map((e) => e.updatedAt ?? "").sort().pop() ?? "";

// Barometer: Verteilung und anonyme Bewegung (Namen verlassen den Auszug nicht).
const OPTIONS = ["Fiktion", "Eher Fiktion", "Unentschieden", "Eher Realität", "Realität"];
const votesOf = (id) => (workshop.entries?.[id]?.value ?? []).map((l) => (l.includes(" — ") ? { o: l.split(" — ")[0], n: l.split(" — ").slice(1).join(" — ") } : { o: l, n: "" }));
const before = votesOf("00.08:barometer-vorher-stimmen");
const after = votesOf("07.02:barometer-nachher-stimmen");
const dist = (vs) => OPTIONS.map((o) => `${o} ${vs.filter((v) => v.o === o).length}`).join(" · ");
const mean = (vs) => (vs.length ? (vs.reduce((s, v) => s + OPTIONS.indexOf(v.o), 0) / vs.length).toFixed(1).replace(".", ",") : "–");
const moves = after.filter((v) => v.n).map((v) => ({ a: v, b: before.find((x) => x.n && x.n === v.n) })).filter((x) => x.b).map((x) => OPTIONS.indexOf(x.a.o) - OPTIONS.indexOf(x.b.o));
const moveLine = moves.length
  ? [...new Set(moves)].sort((a, b) => b - a).map((d) => `${moves.filter((x) => x === d).length}× ${d > 0 ? "+" : d < 0 ? "−" : "±"}${Math.abs(d)}`).join(" · ")
  : "keine Zuordnung vorher/nachher möglich";

// Prüfungen, die in den Dokumenten sichtbar werden müssen.
if (probe) warnings.push("PROBEDATEN: meta.title markiert die Datei als Generalprobe. Ausgaben als Probe kennzeichnen.");
const report = stores.report;
const reportRelevant = entries.filter((e) => hasValue(e) || isAdhoc(e)).length;
if (report?.markdown) {
  const stale = report.entryCount !== reportRelevant || entries.some((e) => (e.updatedAt ?? "") > (report.createdAt ?? ""));
  warnings.push(`KI-Ergebnisbericht vorhanden (erstellt ${report.createdAt}, ${report.entryCount} Beiträge; heute ${reportRelevant})${stale ? " – VERALTET gegenüber dem Protokoll" : ""}. Nur Hilfsquelle.`);
}
const group = stores.interviewsGroup;
const withOpinion = interviews.filter((i) => i.opinion?.trim());
if (group?.text && group.count !== withOpinion.length) warnings.push(`Gruppenmeinungsbild beruht auf ${group.count} Interviews, vorhanden sind ${withOpinion.length} mit Meinungsbild – veraltet.`);
const manual = entries.filter((e) => typeof e.value === "string" && /·\s*von Hand gesetzt\s*$/.test(e.value));
if (manual.length) warnings.push(`Von Hand gesetzte Interview-Werte (Einschätzung der Runde, kein Messwert): ${manual.map((e) => e.id).join(", ")}`);
const unknownSlides = [...new Set(entries.filter((e) => !slideRank.has(e.slideId)).map((e) => e.slideId))];
if (unknownSlides.length) warnings.push(`Einträge auf Folien, die das Manifest nicht kennt: ${unknownSlides.join(", ")}`);
const unapproved = (stores.glossary?.terms ?? []).filter((t) => !t.approved);
if (unapproved.length) warnings.push(`Nicht freigegebene Glossarbegriffe: ${unapproved.map((t) => t.term).join(", ")}`);

/* ------------------------------------------------------------------ Ausgabe */
const L = [];
const flags = (e) => {
  const f = [e.kind];
  if (e.id.split(":")[1]?.startsWith("poster-")) f.push("Poster-Feld");
  else if (posterOf.has(e.id)) f.push(`auf Poster ${posterOf.get(e.id).join(", ")}`);
  if (isAdhoc(e)) f.push(hasValue(e) ? "eigene Frage, beantwortet" : "eigene Frage, OFFEN");
  if (e.id.endsWith(":notiz")) f.push("Notiz");
  if (e.id.endsWith(":mitschnitt") || e.prompt === "Aus der mitgeschnittenen Diskussion") f.push("Mitschnitt (KI-Zusammenfassung der Diskussion, Nebenquelle)");
  if (e.raw) f.push("KI-geglättet (Original in raw)");
  if (/-analyse$/.test(e.id) || /:i7-meinungsbild-gesamt$|:interview-/.test(e.id)) f.push("KI-Auswertung");
  if (e.updatedAt) f.push(e.updatedAt.slice(0, 16).replace("T", " ") + " UTC");
  return f.join(" · ");
};
const valueText = (e) => {
  if (/-stimmen$/.test(e.id)) return `(${e.value.length} Einzelstimmen; Namen ausgeblendet)`;
  if (Array.isArray(e.value)) return e.value.map((v) => `- ${card(v)}`).join("\n");
  return String(e.value ?? "").trim() || "_(offen, keine Antwort)_";
};

L.push(`# Quellenauszug für /konzept-neu`, "");
L.push(`- **Datei:** ${path.basename(input)} (${format})`);
L.push(`- **Gesichert:** ${createdAt || "—"} · **letzte Änderung eines Beitrags:** ${lastUpdate || "—"}`);
L.push(`- **Titel:** ${title || "—"} · **Datum:** ${meta.date || "—"}`);
L.push(`- **Beiträge:** ${entries.length} (mit Inhalt ${entries.filter(hasValue).length}) · **Interviews:** ${interviews.length} · **Teilnehmende:** ${people.length || "—"}`);
if (people.length) L.push(`- **Rollen der Teilnehmenden (ohne Namen):** ${[...new Set(people.map((p) => p.role?.trim()).filter(Boolean))].join(" · ") || "—"}`);
L.push("", "## Hinweise", "", ...(warnings.length ? warnings.map((w) => `- ${w}`) : ["- keine"]), "");

L.push("## Barometer (berechnet aus den Einzelstimmen, ohne Namen)", "");
L.push(`- Vorher (00.08): ${before.length} Stimmen · ${dist(before)} · mittlere Position ${mean(before)} (0 = Fiktion … 4 = Realität)`);
L.push(`- Nachher (07.02): ${after.length} Stimmen · ${dist(after)} · mittlere Position ${mean(after)}`);
L.push(`- Bewegung derselben Personen (${moves.length} zugeordnet): ${moveLine}`, "");

for (const m of modules) {
  const items = entries.filter((e) => e.module === m.index || (!slideRank.has(e.slideId) && Number.parseInt(e.slideId, 10) === m.index));
  L.push(`## Modul ${m.index === 99 ? "Anhang" : m.index} · ${m.title}`, "");
  if (!items.length) L.push("_(keine Beiträge)_", "");
  for (const slideId of [...new Set(items.map((e) => e.slideId))]) {
    L.push(`### Folie ${slideId} · ${slideTitle.get(slideId) ?? "(unbekannte Folie)"}`, "");
    for (const e of items.filter((x) => x.slideId === slideId)) {
      L.push(`#### [${e.id}] ${e.prompt}`, `_${flags(e)}_`, "", valueText(e), "");
      for (const key of posterOf.get(e.id) ?? []) {
        const d = drafts[key]?.fields?.[e.id];
        if (d !== undefined && d.trim() !== String(e.value ?? "").trim()) L.push(`> **Posterfassung (${key}):** ${d.replace(/\n/g, "\n> ")}`, "");
      }
    }
  }
}

L.push("## Abdeckung: deklarierte Felder", "");
for (const s of slideList) {
  const ranks = declared.get(s.id);
  if (!ranks?.size) continue;
  const row = [...ranks.keys()].map((f) => {
    const e = workshop.entries?.[`${s.id}:${f}`];
    return `${e && hasValue(e) ? "✓" : "—"} ${f}`;
  });
  L.push(`- **${s.id}** ${row.join(" · ")}`);
}
L.push("", "## Poster", "");
for (const p of posters) {
  L.push(`- **${p.title}** (${p.key}, Folie ${p.slideId}): ${p.entryIds.map((id) => `${workshop.entries?.[id] && hasValue(workshop.entries[id]) ? "✓" : "—"} ${id}${drafts[p.key]?.fields?.[id] !== undefined ? " (Posterfassung)" : ""}`).join(" · ")}${drafts[p.key]?.image ? " · Posterbild vorhanden" : ""}`);
}

if (interviews.length) {
  L.push("", "## Interviews (anonymisiert, Reihenfolge nach Aufnahmezeit)", "");
  [...interviews].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).forEach((iv, i) => {
    const s = iv.scales ?? {};
    L.push(`### Interview ${i + 1}`, "");
    L.push(`- Skalen (1–4): Haltung ${s.haltung ?? "–"} · Kompetenz ${s.kompetenz ?? "–"} · Relevanz heute ${s.relevanzHeute ?? "–"} · morgen ${s.relevanzMorgen ?? "–"}`);
    L.push(`- Begriffe: ${(s.begriffe ?? []).join(", ") || "–"} · Einsatzgebiete: ${(s.einsatzgebiete ?? []).join(", ") || "–"}`);
    L.push(`- Transkript: ${iv.transcript ? "vorhanden (transkripte.md)" : "fehlt"} · Meinungsbild: ${iv.opinion ? "vorhanden" : "fehlt"}`, "");
    const inRecord = workshop.entries?.[`01.02:interview-${iv.id}`];
    if (iv.opinion && !inRecord) L.push(iv.opinion.replace(/^## /gm, "##### "), "");
    else if (inRecord) L.push(`- Meinungsbild steht im Protokoll: [01.02:interview-${iv.id}]`, "");
  });
  fs.writeFileSync(
    path.join(OUT, "transkripte.md"),
    [...interviews].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt))).map((iv, i) => `## Interview ${i + 1}\n\n${iv.transcript ?? "(kein Transkript)"}\n`).join("\n"),
  );
}
if (group?.text) {
  L.push("", "## Gemeinsames Meinungsbild (KI-Auswertung der Interviews)", "", `_Stand ${group.updatedAt}, Grundlage ${group.count} Interviews_`, "");
  if (workshop.entries?.["01.02:i7-meinungsbild-gesamt"]) L.push("Text steht im Protokoll: [01.02:i7-meinungsbild-gesamt] (dort ggf. von der Runde geschärft; maßgeblich ist der Protokolltext).");
  else L.push(group.text.replace(/^## /gm, "#### "));
}
if (stores.glossary?.terms?.length) {
  L.push("", "## Glossar (im Workshop ergänzt)", "");
  for (const t of stores.glossary.terms) L.push(`- **${t.term}**: ${t.definition}${t.approved ? "" : " _(nicht freigegeben)_"}`);
}
if (report?.markdown) {
  fs.writeFileSync(path.join(OUT, "hilfsquelle-ki-bericht.md"), `> HILFSQUELLE, NICHT MASSGEBLICH. KI-Ergebnisbericht vom ${report.createdAt} aus ${report.entryCount} Beiträgen. Jede Aussage gegen quellen.md prüfen.\n\n${report.markdown}\n`);
}
fs.writeFileSync(path.join(OUT, "quellen.md"), `${L.join("\n")}\n`);

// Arbeitsblatt für die Abdeckung: hinter jedem Pfeil das Kapitel eintragen oder „nicht verwendet: <Grund>".
fs.writeFileSync(
  path.join(OUT, "abdeckung.md"),
  [
    "# Abdeckung Ergebnisdokument",
    "",
    "Hinter jedem → das Kapitel eintragen, in dem der Beitrag verarbeitet ist, oder: nicht verwendet, weil …",
    "",
    ...entries
      .filter((e) => (hasValue(e) || isAdhoc(e)) && !/-stimmen$/.test(e.id))
      .map((e) => `- \`${e.id}\` ${String(e.prompt ?? "").replace(/\s+/g, " ").slice(0, 90)} →`),
    "",
  ].join("\n"),
);

// Korpus für die Zitatprüfung und Listen für die Namens-/Produktprüfung.
const corpus = [
  ...entries.flatMap((e) => [e.prompt, ...(Array.isArray(e.value) ? e.value.map(card) : [String(e.value ?? "")])]),
  ...interviews.flatMap((iv) => [iv.transcript ?? ""]),
  ...Object.values(drafts).flatMap((d) => Object.values(d?.fields ?? {})),
];
const names = [
  ...new Set([
    ...people.flatMap((p) => [`${p.firstName ?? ""} ${p.lastName ?? ""}`.trim(), `${p.lastName ?? ""}, ${p.firstName ?? ""}`.trim()]),
    ...people.map((p) => (p.lastName ?? "").trim()).filter((n) => n.length > 2),
    ...interviews.map((iv) => iv.pseudonym).filter((n) => n && !/^Interview( \d+)?$/i.test(n)),
  ]),
].filter((n) => n && n !== ",");
const products = ["ChatGPT", "OpenAI", "GPT", "Claude", "Anthropic", "Copilot", "Microsoft", "Gemini", "Google", "Mistral", "Llama", "CDBrain", "Corporate Digital Brain", "Personal Digital Brain", "PDB", "CDB", "CDBOS", "Composer", "TQS", "Mira", "BIK-Suite"];
fs.writeFileSync(path.join(OUT, "quellen.json"), JSON.stringify({ format, file: path.basename(input), probe, corpus, names, products, entries }, null, 1));
console.log(`Quellenauszug: ${path.join(OUT, "quellen.md")} (${entries.length} Beiträge, ${warnings.length} Hinweise)`);
for (const w of warnings) console.log(`  ! ${w}`);
```
