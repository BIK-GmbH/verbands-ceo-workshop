import type { ModuleMeta } from "@/types/slide";

/**
 * Single source of truth for module/slide order & IDs.
 * Workshop „KI-Geschäftsführer: Fiktion oder Realität?" — Zweitages-Workshop
 * für den Fachverband Betonbohren und -sägen Deutschland e. V. (FBS), 16./17.09.2026.
 * Aufbau nach den Phasen der Ablaufblätter (siehe docs/workshop-konzept.md);
 * jede Phase endet mit einer Poster-Folie.
 */
export const MANIFEST: ModuleMeta[] = [
  {
    index: 0,
    title: { de: "Auftakt: Die Leitfrage", en: "Kickoff: The key question" },
    description: { de: "Tag 1 · 12:45–13:00", en: "Day 1 · 12:45–13:00" },
    slides: [
      { id: "00.01", module: 0, slide: 1, title: { de: "KI-Geschäftsführer: Fiktion oder Realität?", en: "AI managing director: fiction or reality?" } },
      { id: "00.02", module: 0, slide: 2, title: { de: "Willkommen", en: "Welcome" } },
      { id: "00.03", module: 0, slide: 3, title: { de: "Warum wir hier sind", en: "Why we are here" } },
      { id: "00.04", module: 0, slide: 4, title: { de: "Rollen & Interessen offengelegt", en: "Roles & interests disclosed" } },
      { id: "00.05", module: 0, slide: 5, title: { de: "Die Leitfrage & unser Weg", en: "The key question & our path" } },
      { id: "00.06", module: 0, slide: 6, title: { de: "Agenda der zwei Tage", en: "Agenda of the two days" } },
      { id: "00.07", module: 0, slide: 7, title: { de: "So arbeiten wir: Poster, Protokoll, KI-Werkzeuge", en: "How we work: posters, record, AI tools" } },
      { id: "00.08", module: 0, slide: 8, title: { de: "Barometer: Fiktion oder Realität? (vorher)", en: "Barometer: fiction or reality? (before)" } },
    ],
  },
  {
    index: 1,
    title: { de: "Analyse: Need to Move", en: "Analysis: Need to move" },
    description: { de: "Tag 1 · 13:00–14:30", en: "Day 1 · 13:00–14:30" },
    slides: [
      { id: "01.01", module: 1, slide: 1, title: { de: "Phase 1: Welches Problem wollen wir wirklich lösen?", en: "Phase 1: Which problem do we really want to solve?" } },
      { id: "01.02", module: 1, slide: 2, title: { de: "KI-Interview: Wie stehen wir zu KI?", en: "AI interview: where do we stand on AI?" } },
      { id: "01.03", module: 1, slide: 3, title: { de: "Top-Herausforderungen der nächsten 3–5 Jahre", en: "Top challenges of the next 3–5 years" } },
      { id: "01.04", module: 1, slide: 4, title: { de: "Clustern & Priorisieren", en: "Cluster & prioritise" } },
      { id: "01.05", module: 1, slide: 5, title: { de: "5× Warum: die Problem-Treppe", en: "5 whys: the problem staircase" } },
      { id: "01.06", module: 1, slide: 6, title: { de: "Poster: Need to Move", en: "Poster: Need to move" } },
    ],
  },
  {
    index: 2,
    title: { de: "Vision: Möglichkeitsraum", en: "Vision: Space of possibilities" },
    description: { de: "Tag 1 · 15:00–16:30", en: "Day 1 · 15:00–16:30" },
    slides: [
      { id: "02.01", module: 2, slide: 1, title: { de: "Phase 2: Was wäre möglich?", en: "Phase 2: What would be possible?" } },
      { id: "02.02", module: 2, slide: 2, title: { de: "Heute · Morgen · Übermorgen", en: "Today · tomorrow · the day after" } },
      { id: "02.03", module: 2, slide: 3, title: { de: "Lösungskategorien & Auswahlkriterien", en: "Solution categories & selection criteria" } },
      { id: "02.04", module: 2, slide: 4, title: { de: "Was KI in der Verbandsarbeit leisten kann", en: "What AI can do in association work" } },
      { id: "02.05", module: 2, slide: 5, title: { de: "Grenzen & Voraussetzungen", en: "Limits & prerequisites" } },
      { id: "02.06", module: 2, slide: 6, title: { de: "Optional: Live-Demo – so kann das aussehen", en: "Optional: live demo – what it can look like" } },
      { id: "02.07", module: 2, slide: 7, title: { de: "Fragen & Möglichkeiten sammeln", en: "Collect questions & possibilities" } },
      { id: "02.08", module: 2, slide: 8, title: { de: "Poster: Möglichkeitsraum & Stoßrichtungen", en: "Poster: possibilities & directions" } },
    ],
  },
  {
    index: 3,
    title: { de: "Zielbild: Unser KI-Geschäftsführer", en: "Target picture: Our AI managing director" },
    description: { de: "Tag 1 · 16:45–18:15", en: "Day 1 · 16:45–18:15" },
    slides: [
      { id: "03.01", module: 3, slide: 1, title: { de: "Phase 3: Wie sieht unser KI-Geschäftsführer aus?", en: "Phase 3: What does our AI managing director look like?" } },
      { id: "03.02", module: 3, slide: 2, title: { de: "Die Aufgaben des Geschäftsführers heute", en: "The managing director's tasks today" } },
      { id: "03.03", module: 3, slide: 3, title: { de: "Übernehmen · Unterstützen · Bewusst nicht", en: "Take over · support · deliberately not" } },
      { id: "03.04", module: 3, slide: 4, title: { de: "Profil des KI-Geschäftsführers", en: "Profile of the AI managing director" } },
      { id: "03.05", module: 3, slide: 5, title: { de: "Poster: Zielbild 2029", en: "Poster: target picture 2029" } },
      { id: "03.06", module: 3, slide: 6, title: { de: "Tagesbilanz Tag 1", en: "Wrap-up day 1" } },
    ],
  },
  {
    index: 4,
    title: { de: "Realitätscheck „Wilma“", en: "Reality check “Wilma”" },
    description: { de: "Tag 2 · 08:30–10:00", en: "Day 2 · 08:30–10:00" },
    slides: [
      { id: "04.01", module: 4, slide: 1, title: { de: "Phase 4: Warum sollte es diesmal funktionieren?", en: "Phase 4: Why should it work this time?" } },
      { id: "04.02", module: 4, slide: 2, title: { de: "Wilma: Was lernen wir?", en: "Wilma: what do we learn?" } },
      { id: "04.03", module: 4, slide: 3, title: { de: "Prüfrahmen: technisch · organisatorisch · Mitglieder", en: "Test frame: technical · organisational · members" } },
      { id: "04.04", module: 4, slide: 4, title: { de: "Datenschutz & Verantwortung", en: "Data protection & responsibility" } },
      { id: "04.05", module: 4, slide: 5, title: { de: "Risiken & Absicherung", en: "Risks & safeguards" } },
      { id: "04.06", module: 4, slide: 6, title: { de: "Poster: GO · ADAPT · STOP", en: "Poster: GO · ADAPT · STOP" } },
    ],
  },
  {
    index: 5,
    title: { de: "Wirtschaftlichkeit & Argumentation", en: "Economics & Argumentation" },
    description: { de: "Tag 2 · 10:15–11:00", en: "Day 2 · 10:15–11:00" },
    slides: [
      { id: "05.01", module: 5, slide: 1, title: { de: "Phase 5: Wie überzeugen wir Entscheider?", en: "Phase 5: How do we convince decision-makers?" } },
      { id: "05.02", module: 5, slide: 2, title: { de: "Zwei Argumentationslinien", en: "Two lines of argument" } },
      { id: "05.03", module: 5, slide: 3, title: { de: "Vergleichsszenarien & 3-Jahres-Hypothese", en: "Comparison scenarios & 3-year hypothesis" } },
      { id: "05.04", module: 5, slide: 4, title: { de: "Strategischer Mehrwert", en: "Strategic added value" } },
      { id: "05.05", module: 5, slide: 5, title: { de: "Poster: Business Case", en: "Poster: business case" } },
    ],
  },
  {
    index: 6,
    title: { de: "Roadmap", en: "Roadmap" },
    description: { de: "Tag 2 · 11:00–11:45", en: "Day 2 · 11:00–11:45" },
    slides: [
      { id: "06.01", module: 6, slide: 1, title: { de: "Phase 6: Vom Zielbild in die Realität", en: "Phase 6: From target picture to reality" } },
      { id: "06.02", module: 6, slide: 2, title: { de: "Prioritäten: Wirkung · Machbarkeit · Aufwand", en: "Priorities: impact · feasibility · effort" } },
      { id: "06.03", module: 6, slide: 3, title: { de: "Meilensteine: 100 Tage · 12 · 24 · 36 Monate", en: "Milestones: 100 days · 12 · 24 · 36 months" } },
      { id: "06.04", module: 6, slide: 4, title: { de: "Wer macht was & Ressourcen", en: "Who does what & resources" } },
      { id: "06.05", module: 6, slide: 5, title: { de: "Poster: Roadmap", en: "Poster: roadmap" } },
    ],
  },
  {
    index: 7,
    title: { de: "Commitment: Fiktion oder Realität?", en: "Commitment: Fiction or reality?" },
    description: { de: "Tag 2 · 11:45–12:30", en: "Day 2 · 11:45–12:30" },
    slides: [
      { id: "07.01", module: 7, slide: 1, title: { de: "Phase 7: Wozu sagen wir gemeinsam Ja?", en: "Phase 7: What do we say yes to together?" } },
      { id: "07.02", module: 7, slide: 2, title: { de: "Barometer: Fiktion oder Realität? (nachher)", en: "Barometer: fiction or reality? (after)" } },
      { id: "07.03", module: 7, slide: 3, title: { de: "Offene Fragen", en: "Open questions" } },
      { id: "07.04", module: 7, slide: 4, title: { de: "Beschluss: unser nächster Schritt", en: "Decision: our next step" } },
      { id: "07.05", module: 7, slide: 5, title: { de: "Poster-Galerie & Protokoll", en: "Poster gallery & record" } },
      { id: "07.06", module: 7, slide: 6, title: { de: "Nächste Schritte direkt nach der Sitzung", en: "Next steps right after the session" } },
    ],
  },
  {
    index: 99,
    title: { de: "Anhang", en: "Appendix" },
    slides: [
      { id: "99.01", module: 99, slide: 1, title: { de: "Glossar", en: "Glossary" } },
      { id: "99.02", module: 99, slide: 2, title: { de: "Was der FBS heute leistet", en: "What the FBS does today" } },
      { id: "99.03", module: 99, slide: 3, title: { de: "Quellen", en: "Sources" } },
      { id: "99.04", module: 99, slide: 4, title: { de: "Changelog", en: "Changelog" } },
    ],
  },
];

/** Flat list of all slides in canonical order. */
export const ALL_SLIDES = MANIFEST.flatMap((m) => m.slides);

export function findSlide(id: string) {
  return ALL_SLIDES.find((s) => s.id === id);
}

export function findModule(index: number) {
  return MANIFEST.find((m) => m.index === index);
}

export function neighbours(id: string) {
  const i = ALL_SLIDES.findIndex((s) => s.id === id);
  return {
    prev: i > 0 ? ALL_SLIDES[i - 1] : null,
    next: i >= 0 && i < ALL_SLIDES.length - 1 ? ALL_SLIDES[i + 1] : null,
    index: i,
    total: ALL_SLIDES.length,
  };
}
