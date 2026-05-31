export type Lang = "de" | "en";
export type Theme = "light" | "dark";

export interface Bilingual {
  de: string;
  en: string;
}

export interface SlideMeta {
  /** Stable id, e.g. "01.02" */
  id: string;
  /** Module index (0..6, 99 for appendix) */
  module: number;
  /** Slide index within module (1-based) */
  slide: number;
  /** Title in both languages */
  title: Bilingual;
  /** When was the source for this slide last researched */
  researchedOn?: string;
  /** External sources backing this slide */
  sources?: string[];
  /** Speaker-only flag (rare; usually we use <SpeakerNotes/> in body) */
  presenterOnly?: boolean;
}

export interface ModuleMeta {
  /** Module index */
  index: number;
  /** Module title in both languages */
  title: Bilingual;
  /** Short module description */
  description?: Bilingual;
  /** All slides in this module, in order */
  slides: SlideMeta[];
}
