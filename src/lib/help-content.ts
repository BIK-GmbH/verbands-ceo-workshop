import type { Bilingual } from "@/types/slide";
import { ALL_SLIDES } from "@/lib/slides";

/**
 * Content of the help — the only place where it is written down.
 * Rule of thumb for every line: say what it does for the workshop, not how it
 * is built, and claim nothing the app does not actually do.
 */

export interface HelpLink {
  label: Bilingual;
  /** Route inside the app, e.g. "/protokoll" or "/s/01.03". */
  to: string;
}

export interface HelpItem {
  id: string;
  title: Bilingual;
  body: Bilingual;
  /** Key caps, per language — „Leertaste" is not „Space". */
  keys?: { de: string[]; en: string[] };
  links?: HelpLink[];
  /** Extra search words that are never shown. */
  keywords?: Bilingual;
}

export type HelpKind = "lead" | "cards" | "tasks" | "keys" | "notes";

export interface HelpSection {
  id: string;
  /** Short label in the side navigation. */
  nav: Bilingual;
  title: Bilingual;
  lead?: Bilingual;
  kind: HelpKind;
  items: HelpItem[];
}

const DECK_START = ALL_SLIDES[0].id;
const SLIDE_COUNT = ALL_SLIDES.length;

const RECORD: HelpLink = { label: { de: "Protokoll öffnen", en: "Open the record" }, to: "/protokoll" };
const POSTERS: HelpLink = { label: { de: "Poster-Galerie", en: "Poster gallery" }, to: "/poster" };
const INTERVIEWS: HelpLink = { label: { de: "Interviews", en: "Interviews" }, to: "/interviews" };
const SETTINGS: HelpLink = { label: { de: "Einstellungen", en: "Settings" }, to: "/einstellungen" };
const CARDS_SLIDE: HelpLink = { label: { de: "Folie 01.03 · Karten", en: "Slide 01.03 · cards" }, to: "/s/01.03" };
const GLOSSARY: HelpLink = { label: { de: "Glossar (99.01)", en: "Glossary (99.01)" }, to: "/s/99.01" };

export const HELP_SECTIONS: HelpSection[] = [
  {
    id: "ueberblick",
    nav: { de: "Überblick", en: "Overview" },
    title: { de: "Was diese App ist", en: "What this app is" },
    lead: {
      de: `Dies ist die Arbeitsumgebung für den Zweitages-Workshop „KI-Geschäftsführer: Fiktion oder Realität?“ des FBS. Sie führt durch ${SLIDE_COUNT} Folien in acht Phasen und nimmt dabei jeden Beitrag auf: was in die Felder getippt oder diktiert wird, steht im selben Moment im Live-Protokoll. Am Ende der zwei Tage liegt daraus ein fertiges Ergebnisdokument vor – als Word, PDF oder Markdown – dazu die Poster der sieben Phasen zum Aushängen. Alles bleibt im Browser dieses Geräts; einen Server hat die App nicht.`,
      en: `This is the working environment for the FBS two-day workshop “AI managing director: fiction or reality?”. It leads through ${SLIDE_COUNT} slides in eight phases and captures every contribution on the way: whatever is typed or dictated into the fields appears in the live record at the same moment. At the end of the two days it yields a finished results document – as Word, PDF or Markdown – plus the posters of the seven phases to put on the wall. Everything stays in this browser; the app has no server.`,
    },
    kind: "lead",
    items: [
      {
        id: "fact-slides",
        title: { de: `${SLIDE_COUNT} Folien, acht Phasen`, en: `${SLIDE_COUNT} slides, eight phases` },
        body: {
          de: "Von der Leitfrage bis zum Commitment, mit Erarbeiten-Folien statt reiner Vortragsfolien.",
          en: "From the key question to the commitment, with working slides instead of pure lecture slides.",
        },
        keywords: { de: "module agenda ablauf phasen tag 1 tag 2", en: "modules agenda phases day 1 day 2" },
      },
      {
        id: "fact-record",
        title: { de: "Ein Protokoll, das mitläuft", en: "A record that runs along" },
        body: {
          de: "Jeder Beitrag landet sofort und nach Phase sortiert im Protokoll – ohne Nacharbeit am Abend.",
          en: "Every contribution lands in the record at once, sorted by phase – no evening rework.",
        },
        links: [RECORD],
      },
      {
        id: "fact-result",
        title: { de: "Ergebnisse zum Mitnehmen", en: "Results to take away" },
        body: {
          de: "Ergebnisdokument, Poster von A4 bis A0 und eine Sicherungsdatei des gesamten Stands.",
          en: "Results document, posters from A4 to A0 and a backup file of the whole state.",
        },
        links: [POSTERS],
      },
    ],
  },

  {
    id: "koennen",
    nav: { de: "Das kann sie gut", en: "What it does well" },
    title: { de: "Das kann sie richtig gut", en: "What this app does really well" },
    lead: {
      de: "Die Funktionen, die im Raum den Unterschied machen – je ein Satz, was sie einem abnehmen.",
      en: "The features that make the difference in the room – one sentence each on what they save you.",
    },
    kind: "cards",
    items: [
      {
        id: "protokoll",
        title: { de: "Live-Protokoll neben der Folie", en: "Live record next to the slide" },
        body: {
          de: "Rechts neben der Folie stehen Notiz, eigene Fragen und alle bisher erfassten Beiträge – nichts muss hinterher aus Fotos abgetippt werden.",
          en: "Note, own questions and every contribution captured so far sit right next to the slide – nothing has to be typed up from photos afterwards.",
        },
        links: [RECORD],
        keywords: { de: "mitschreiben notizen panel dokumentation", en: "minutes notes panel documentation" },
      },
      {
        id: "diktat",
        title: { de: "Einsprechen statt tippen", en: "Speak instead of typing" },
        body: {
          de: "An jedem Freitextfeld sitzt ein Mikrofon: die Moderation spricht mit, statt sich über die Tastatur zu beugen (Chrome oder Edge).",
          en: "Every free-text field has a microphone: the facilitator speaks along instead of bending over the keyboard (Chrome or Edge).",
        },
        keywords: { de: "spracheingabe diktieren mikrofon web speech", en: "voice input dictate microphone web speech" },
      },
      {
        id: "glaetten",
        title: { de: "Glätten direkt am Feld", en: "Polish right at the field" },
        body: {
          de: "Aus hingeworfenen Stichworten wird auf Knopfdruck ein vorzeigbarer Satz – kürzer, länger oder sachlicher, jederzeit rückgängig.",
          en: "Rough keywords turn into a presentable sentence at the push of a button – shorter, longer or more formal, undoable at any time.",
        },
        keywords: { de: "ki claude umformulieren korrigieren stichpunkte", en: "ai claude rephrase rewrite bullets" },
      },
      {
        id: "karten",
        title: { de: "Karten-Modus fürs Vorlesen", en: "Card mode for reading out" },
        body: {
          de: "Die Runde liest ihre Karten reihum vor, jede Sprechpause wird eine Karte; die KI ordnet sie nach Kategorie und Zeithorizont und clustert sie zu drei bis fünf Themenfeldern.",
          en: "The group reads its cards out in turn, every pause becomes a card; the AI sorts them by category and time horizon and clusters them into three to five topic fields.",
        },
        links: [CARDS_SLIDE],
        keywords: { de: "stillarbeit metaplan clustern sortieren heute morgen übermorgen", en: "silent work clustering sorting today tomorrow" },
      },
      {
        id: "interviews",
        title: { de: "Einzelinterviews mit Auswertung", en: "One-to-one interviews with analysis" },
        body: {
          de: "Fünfminütige Gespräche aufnehmen oder hochladen, transkribieren, je Person ein Meinungsbild – das Gruppenbild rechnet die App aus den Skalenwerten selbst.",
          en: "Record or upload five-minute conversations, transcribe them, one opinion picture per person – the group picture is calculated from the scale values by the app itself.",
        },
        links: [INTERVIEWS],
        keywords: { de: "stimmungsbild transkription whisper meinungsbild kennzahlen", en: "mood transcription opinion picture metrics" },
      },
      {
        id: "zwei-rechner",
        title: { de: "Zwei Rechner, ein Ergebnis", en: "Two computers, one result" },
        body: {
          de: "Interviews lassen sich als Datei ausgeben und auf dem anderen Rechner einlesen – so kann parallel befragt und trotzdem gemeinsam ausgewertet werden.",
          en: "Interviews can be written to a file and read in on the other computer – so two people can interview in parallel and still evaluate together.",
        },
        links: [INTERVIEWS],
        keywords: { de: "übertragen export import json laptop", en: "transfer export import json laptop" },
      },
      {
        id: "poster",
        title: { de: "Poster-Generator für sieben Phasen", en: "Poster generator for seven phases" },
        body: {
          de: "Jede Phase bekommt ihr Poster, dazu das Filmplakat zum Workshop – mit Inhalten oder als leere Vorlage, von A4 bis A0, auf Wunsch als Vorentwurf aus dem Protokoll.",
          en: "Every phase gets its poster, plus the workshop movie poster – with content or as a blank template, from A4 to A0, on request as a draft from the record.",
        },
        links: [POSTERS],
        keywords: { de: "drucken wandposter a0 a3 vorlage filmplakat", en: "print wall poster a0 a3 template movie poster" },
      },
      {
        id: "glossar",
        title: { de: "Glossar, das wirklich findet", en: "A glossary that actually finds things" },
        body: {
          de: "Die Suche geht über Begriff und Bedeutung, verzeiht Umlaute und Wortreihenfolge – ein Begriff ist geklärt, ohne die Diskussion zu verlassen.",
          en: "The search runs over term and meaning, forgives umlauts and word order – a term is settled without leaving the discussion.",
        },
        links: [GLOSSARY],
        keywords: { de: "begriffe erklären nachschlagen fachbegriffe", en: "terms explain look up jargon" },
      },
      {
        id: "export",
        title: { de: "Word und PDF mit Inhaltsverzeichnis", en: "Word and PDF with a table of contents" },
        body: {
          de: "Protokoll und Ergebnisbericht gehen als fertiges Dokument mit Deckblatt und Verzeichnis heraus, dazu Markdown und JSON zum Weiterverarbeiten.",
          en: "Record and results report come out as a finished document with cover page and contents, plus Markdown and JSON for further processing.",
        },
        links: [RECORD],
        keywords: { de: "docx pdf markdown json versenden bericht", en: "docx pdf markdown json send report" },
      },
      {
        id: "sicherung",
        title: { de: "Sicherung des gesamten Stands", en: "Backup of the whole state" },
        body: {
          de: "Beiträge, Interviews, Poster, Glossar und Bericht gehen in eine Datei und lassen sich auf jedem Gerät wieder einlesen.",
          en: "Contributions, interviews, posters, glossary and report go into one file and can be read back in on any device.",
        },
        links: [SETTINGS],
        keywords: { de: "backup wiederherstellen datei umziehen", en: "backup restore file move" },
      },
      {
        id: "aufnahme",
        title: { de: "Sitzungsaufnahme, die durchhält", en: "A session recording that holds up" },
        body: {
          de: "Der Mitschnitt läuft über Folienwechsel hinweg weiter und übersteht selbst einen Absturz: Die App findet die unterbrochene Aufnahme und stellt sie wieder her.",
          en: "The recording keeps running across slide changes and survives even a crash: the app finds the interrupted recording and restores it.",
        },
        links: [RECORD],
        keywords: { de: "audio mitschnitt rekorder wiederherstellen absturz", en: "audio recorder restore crash" },
      },
      {
        id: "komfort",
        title: { de: "Für den Raum gebaut", en: "Built for the room" },
        body: {
          de: "Präsentationsmodus für den Beamer, Volltextsuche über alle Folien, drei Schriftgrößen, helles und dunkles Design, Deutsch und Englisch.",
          en: "Presentation mode for the projector, full-text search across all slides, three font sizes, light and dark theme, German and English.",
        },
        links: [{ label: { de: "Präsentieren", en: "Present" }, to: `/p/${DECK_START}` }],
        keywords: { de: "beamer vollbild schriftgröße dunkelmodus sprache", en: "projector fullscreen font size dark mode language" },
      },
    ],
  },

  {
    id: "wie",
    nav: { de: "Wie mache ich …?", en: "How do I …?" },
    title: { de: "Wie mache ich …?", en: "How do I …?" },
    lead: {
      de: "Nach Aufgabe sortiert, jeweils mit dem Sprungziel – ein Klick, und die richtige Stelle ist offen.",
      en: "Sorted by task, each with its jump target – one click and the right place is open.",
    },
    kind: "tasks",
    items: [
      {
        id: "task-festhalten",
        title: { de: "Etwas festhalten", en: "Capture something" },
        body: {
          de: "Auf den Erarbeiten-Folien in das Feld tippen – gespeichert wird beim Verlassen des Feldes, sichtbar sofort im Protokoll rechts (Knopf „Protokoll“ in der Kopfzeile).",
          en: "Type into the field on the working slides – it is saved when the field loses focus and shows up in the record on the right straight away (button “Record” in the header).",
        },
        links: [CARDS_SLIDE, RECORD],
        keywords: { de: "eingeben erfassen notieren beitrag speichern", en: "enter capture note contribution save" },
      },
      {
        id: "task-diktieren",
        title: { de: "Einsprechen statt tippen", en: "Dictate instead of typing" },
        body: {
          de: "Mikrofon am Feld antippen, sprechen, erneut antippen. Der Text wird an die Stelle geschrieben, an der die Schreibmarke steht; in Chrome oder Edge; ein laufender Mitschnitt pausiert automatisch.",
          en: "Tap the microphone at the field, speak, tap again. The text is written where the cursor is; in Chrome or Edge; a running session recording pauses automatically.",
        },
        links: [RECORD],
        keywords: { de: "diktat spracherkennung mikrofon", en: "dictation speech recognition microphone" },
      },
      {
        id: "task-karten",
        title: { de: "Karten aufnehmen", en: "Collect cards" },
        body: {
          de: "Auf der Kartenfolie „Karten vorlesen“ starten und reihum vorlesen lassen: Jede Sprechpause wird eine Karte. Danach „Karten glätten“ und – wo Kategorien hinterlegt sind – „Karten einordnen“ oder „Zu Themenfeldern clustern“.",
          en: "On a card slide start “Read out cards” and let the group read in turn: every pause becomes a card. Then “Polish cards” and – where categories exist – “Sort cards” or “Cluster into topic fields”.",
        },
        links: [
          CARDS_SLIDE,
          { label: { de: "Folie 02.07 · Möglichkeiten", en: "Slide 02.07 · possibilities" }, to: "/s/02.07" },
          { label: { de: "Folie 06.02 · Prioritäten", en: "Slide 06.02 · priorities" }, to: "/s/06.02" },
        ],
        keywords: { de: "kartenmodus vorlesen stillarbeit sortieren", en: "card mode read out silent work sorting" },
      },
      {
        id: "task-poster",
        title: { de: "Ein Poster erzeugen", en: "Create a poster" },
        body: {
          de: "In der Galerie das Poster der Phase wählen, bei Bedarf „Aus dem Protokoll vorschlagen“ oder „Mit KI verdichten“, Format von A4 bis A0 setzen und drucken oder als PDF speichern. Die leere Vorlage ist zum Ausfüllen an der Wand.",
          en: "Pick the poster of the phase in the gallery, optionally “Draft from the record” or “Condense with AI”, set the size from A4 to A0 and print or save as PDF. The blank template is for filling in on the wall.",
        },
        links: [POSTERS],
        keywords: { de: "drucken pdf wand vorlage a0", en: "print pdf wall template a0" },
      },
      {
        id: "task-interviews",
        title: { de: "Interviews führen und auswerten", en: "Run and evaluate interviews" },
        body: {
          de: "Unter „Interview führen“ Einwilligung einholen und die sechs Leitfragen abarbeiten (etwa fünf Minuten), danach unter „Meinungsbilder“ transkribieren und auswerten. Die Ergebnisse stehen auf Folie 01.02.",
          en: "Under “Conduct interview” get consent and work through the six guide questions (about five minutes), then transcribe and evaluate under “Opinion pictures”. The results appear on slide 01.02.",
        },
        links: [INTERVIEWS, { label: { de: "Folie 01.02", en: "Slide 01.02" }, to: "/s/01.02" }],
        keywords: { de: "aufnehmen hochladen transkribieren gruppenbild einwilligung", en: "record upload transcribe group picture consent" },
      },
      {
        id: "task-export",
        title: { de: "Ergebnisse exportieren", en: "Export the results" },
        body: {
          de: "Im Protokoll unten „Als Word“ oder „Als PDF“ – beides mit Deckblatt und Inhaltsverzeichnis; Markdown und JSON stehen daneben. Der Ergebnisbericht wird dort ebenfalls erzeugt und exportiert.",
          en: "At the bottom of the record use “As Word” or “As PDF” – both with cover page and table of contents; Markdown and JSON sit next to them. The results report is generated and exported there as well.",
        },
        links: [RECORD],
        keywords: { de: "docx pdf markdown json bericht versenden", en: "docx pdf markdown json report send" },
      },
      {
        id: "task-sicherung",
        title: { de: "Den Stand sichern", en: "Back up the state" },
        body: {
          de: "In den Einstellungen „Sicherung herunterladen“ – am besten am Ende jedes Tages. Dieselbe Datei lässt sich dort wieder einlesen; sie ersetzt den Stand des Geräts vollständig.",
          en: "In the settings use “Download backup” – best at the end of each day. The same file can be read back in there; it replaces the state of the device completely.",
        },
        links: [SETTINGS],
        keywords: { de: "backup wiederherstellen zurücksetzen datei", en: "backup restore reset file" },
      },
      {
        id: "task-ki",
        title: { de: "Die KI-Funktionen einschalten", en: "Switch the AI features on" },
        body: {
          de: "Einmal pro Gerät den Claude-Schlüssel in den Einstellungen hinterlegen; für die Transkription der Interviews zusätzlich den OpenAI-Schlüssel. Ohne Schlüssel funktioniert alles andere unverändert.",
          en: "Store the Claude key in the settings once per device; for transcribing interviews add the OpenAI key. Without keys everything else works unchanged.",
        },
        links: [SETTINGS],
        keywords: { de: "api schlüssel anthropic openai einrichten", en: "api key anthropic openai setup" },
      },
      {
        id: "task-aufnahme",
        title: { de: "Die Sitzung mitschneiden", en: "Record the session" },
        body: {
          de: "Über das Rekorder-Menü in der Kopfzeile oder im Protokoll starten – nach Ansage im Raum und Zustimmung. Der Mitschnitt läuft über Folienwechsel weiter und wird am Ende als Audiodatei heruntergeladen.",
          en: "Start it from the recorder menu in the header or in the record – after announcing it in the room and getting consent. The recording continues across slide changes and is downloaded as an audio file at the end.",
        },
        links: [RECORD],
        keywords: { de: "audio mitschnitt rekorder einwilligung", en: "audio recording recorder consent" },
      },
      {
        id: "task-praesentieren",
        title: { de: "Am Beamer präsentieren", en: "Present on the projector" },
        body: {
          de: "„Präsentieren“ in der Kopfzeile startet die Vollbildansicht ab der aktuellen Folie: ohne Menüs, Pfeiltasten blättern, N zeigt die Sprechernotizen, Esc beendet.",
          en: "“Present” in the header starts the fullscreen view from the current slide: no menus, arrow keys to navigate, N shows the speaker notes, Esc exits.",
        },
        links: [{ label: { de: "Ab der ersten Folie", en: "From the first slide" }, to: `/p/${DECK_START}` }],
        keywords: { de: "beamer vollbild sprechernotizen", en: "projector fullscreen speaker notes" },
      },
      {
        id: "task-begriff",
        title: { de: "Einen Begriff nachschlagen", en: "Look up a term" },
        body: {
          de: "Das Glossar im Anhang durchsuchen – die Suche greift auch in die Erklärungen. Im Workshop ergänzte Begriffe stehen darunter in einem eigenen Block.",
          en: "Search the glossary in the appendix – the search also looks inside the explanations. Terms added during the workshop sit below in their own block.",
        },
        links: [GLOSSARY],
        keywords: { de: "glossar fachbegriff erklärung", en: "glossary term explanation" },
      },
      {
        id: "task-finden",
        title: { de: "Eine bestimmte Folie finden", en: "Find a particular slide" },
        body: {
          de: "Die Volltextsuche in der Kopfzeile (oder Strg K) durchsucht alle Folientitel und springt direkt hin; die Seitenleiste zeigt daneben die Phasen.",
          en: "The search in the header (or Ctrl K) goes through all slide titles and jumps straight there; the sidebar shows the phases next to it.",
        },
        links: [{ label: { de: "Zum Deck", en: "To the deck" }, to: `/s/${DECK_START}` }],
        keywords: { de: "suche navigation seitenleiste springen", en: "search navigation sidebar jump" },
      },
    ],
  },

  {
    id: "tasten",
    nav: { de: "Tastenkürzel", en: "Shortcuts" },
    title: { de: "Tastenkürzel", en: "Keyboard shortcuts" },
    lead: {
      de: "Gelten in der Folienansicht; in Eingabefeldern bleiben die Tasten dem Text vorbehalten.",
      en: "They apply in the slide view; inside input fields the keys belong to the text.",
    },
    kind: "keys",
    items: [
      {
        id: "key-help",
        keys: { de: ["?"], en: ["?"] },
        title: { de: "Diese Hilfe öffnen", en: "Open this help" },
        body: { de: "von jeder Ansicht aus", en: "from any view" },
      },
      {
        id: "key-esc",
        keys: { de: ["Esc"], en: ["Esc"] },
        title: { de: "Schließen", en: "Close" },
        body: {
          de: "Hilfe, Suche und Präsentationsmodus",
          en: "help, search and presentation mode",
        },
      },
      {
        id: "key-next",
        keys: { de: ["→", "Leertaste", "j"], en: ["→", "Space", "j"] },
        title: { de: "Nächste Folie", en: "Next slide" },
        body: { de: "auch Bild ab", en: "also Page Down" },
      },
      {
        id: "key-prev",
        keys: { de: ["←", "k"], en: ["←", "k"] },
        title: { de: "Vorherige Folie", en: "Previous slide" },
        body: { de: "auch Bild auf", en: "also Page Up" },
      },
      {
        id: "key-first",
        keys: { de: ["Pos 1"], en: ["Home"] },
        title: { de: "Erste Folie", en: "First slide" },
        body: { de: "", en: "" },
      },
      {
        id: "key-last",
        keys: { de: ["Ende"], en: ["End"] },
        title: { de: "Letzte Folie", en: "Last slide" },
        body: { de: "", en: "" },
      },
      {
        id: "key-search",
        keys: { de: ["Strg", "K"], en: ["Ctrl", "K"] },
        title: { de: "Folien durchsuchen", en: "Search the slides" },
        body: { de: "auf dem Mac ⌘ K", en: "⌘ K on a Mac" },
      },
      {
        id: "key-notes",
        keys: { de: ["P"], en: ["P"] },
        title: { de: "Sprechernotizen ein- oder ausblenden", en: "Show or hide the speaker notes" },
        body: { de: "in der Arbeitsansicht", en: "in the working view" },
      },
      {
        id: "key-fullscreen",
        keys: { de: ["F"], en: ["F"] },
        title: { de: "Vollbild", en: "Fullscreen" },
        body: { de: "", en: "" },
      },
      {
        id: "key-present-notes",
        keys: { de: ["N"], en: ["N"] },
        title: { de: "Sprechernotizen im Präsentationsmodus", en: "Speaker notes in presentation mode" },
        body: { de: "", en: "" },
      },
      {
        id: "key-present-theme",
        keys: { de: ["T"], en: ["T"] },
        title: { de: "Hell oder dunkel im Präsentationsmodus", en: "Light or dark in presentation mode" },
        body: { de: "", en: "" },
      },
    ],
  },

  {
    id: "hinweise",
    nav: { de: "Gut zu wissen", en: "Good to know" },
    title: { de: "Gut zu wissen", en: "Good to know" },
    lead: {
      de: "Drei Dinge, die man vor dem Workshop einmal gelesen haben sollte.",
      en: "Three things worth reading once before the workshop.",
    },
    kind: "notes",
    items: [
      {
        id: "note-storage",
        title: { de: "Alles liegt in diesem Browser", en: "Everything lives in this browser" },
        body: {
          de: "Beiträge, Interviews, Poster und Glossar bleiben auf diesem Gerät – auch wenn Tab und Browser geschlossen werden und über Updates der App hinweg. Verloren gehen sie beim Löschen der Browserdaten, im privaten Fenster und beim Wechsel des Geräts. Deshalb am Ende jedes Tages eine Sicherung herunterladen.",
          en: "Contributions, interviews, posters and glossary stay on this device – also when tab and browser are closed and across app updates. They are lost when the browser data is cleared, in a private window and when the device changes. So download a backup at the end of each day.",
        },
        links: [SETTINGS],
        keywords: { de: "speicher localstorage datenverlust sicherung", en: "storage localstorage data loss backup" },
      },
      {
        id: "note-ai",
        title: { de: "Die KI-Funktionen sind freiwillig", en: "The AI features are optional" },
        body: {
          de: "Glätten, Karten einordnen, Poster-Vorentwurf, Meinungsbilder und Ergebnisbericht brauchen einen Claude-Schlüssel, die Transkription zusätzlich einen OpenAI-Schlüssel. Ohne Schlüssel läuft der ganze Rest unverändert weiter.",
          en: "Polishing, sorting cards, poster drafts, opinion pictures and the results report need a Claude key, transcription additionally an OpenAI key. Without keys all the rest runs unchanged.",
        },
        links: [SETTINGS],
        keywords: { de: "api schlüssel anthropic openai kosten", en: "api key anthropic openai cost" },
      },
      {
        id: "note-transfer",
        title: { de: "Was das Gerät verlässt", en: "What leaves the device" },
        body: {
          de: "Das Diktat nutzt die Spracherkennung des Browsers, die Transkription schickt die Tonaufnahme an OpenAI, die übrigen KI-Funktionen schicken den jeweiligen Text an Anthropic. Schlüssel, Teilnehmerliste und Pseudonyme werden nie mitgesendet. Aufnahmen starten erst nach ausdrücklicher Zustimmung – im Raum ansagen.",
          en: "Dictation uses the browser's speech recognition, transcription sends the audio to OpenAI, the other AI features send the respective text to Anthropic. Keys, participant list and pseudonyms are never sent along. Recordings only start after explicit consent – announce it in the room.",
        },
        keywords: { de: "datenschutz dsgvo einwilligung übertragung", en: "privacy gdpr consent transfer" },
      },
    ],
  },
];
