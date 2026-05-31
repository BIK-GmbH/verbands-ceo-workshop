import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Bilingual, Lang } from "@/types/slide";

const KEY = "workshop.lang";

export function getInitialLang(): Lang {
  if (typeof window === "undefined") return "de";
  const stored = window.localStorage.getItem(KEY);
  if (stored === "de" || stored === "en") return stored;
  const nav = navigator.language?.toLowerCase() ?? "de";
  return nav.startsWith("en") ? "en" : "de";
}

interface LangCtx {
  lang: Lang;
  setLang: (l: Lang) => void;
}
const Ctx = createContext<LangCtx | null>(null);

export function LangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  function setLang(l: Lang) {
    window.localStorage.setItem(KEY, l);
    setLangState(l);
  }
  return <Ctx.Provider value={{ lang, setLang }}>{children}</Ctx.Provider>;
}

export function useLang(): [Lang, (l: Lang) => void] {
  const v = useContext(Ctx);
  if (!v) throw new Error("useLang must be used inside <LangProvider>");
  return [v.lang, v.setLang];
}

export function pick(b: Bilingual, lang: Lang): string {
  return b[lang] ?? b.de;
}

export const UI = {
  prevSlide:    { de: "Vorherige Folie",   en: "Previous slide" },
  nextSlide:    { de: "Nächste Folie",     en: "Next slide" },
  toggleTheme:  { de: "Design wechseln",   en: "Toggle theme" },
  toggleLang:   { de: "Sprache wechseln",  en: "Toggle language" },
  search:       { de: "Suchen…",           en: "Search…" },
  presenter:    { de: "Presenter-Modus",   en: "Presenter mode" },
  speakerNotes: { de: "Speaker-Notizen",   en: "Speaker notes" },
  print:        { de: "Druckansicht",      en: "Print view" },
  exit:         { de: "Beenden",           en: "Exit" },
  module:       { de: "Modul",             en: "Module" },
  slide:        { de: "Folie",             en: "Slide" },
  of:           { de: "von",               en: "of" },
  researchedOn: { de: "Stand",             en: "As of" },
  sources:      { de: "Quellen",           en: "Sources" },
  exercise:     { de: "Übung",             en: "Exercise" },
  duration:     { de: "Dauer",             en: "Duration" },
  goal:         { de: "Ziel",              en: "Goal" },
  hint:         { de: "Hinweis",           en: "Hint" },
  warning:      { de: "Achtung",           en: "Warning" },
  tip:          { de: "Tipp",              en: "Tip" },
} satisfies Record<string, Bilingual>;

export type UIKey = keyof typeof UI;
export const t = (key: UIKey, lang: Lang) => pick(UI[key], lang);
