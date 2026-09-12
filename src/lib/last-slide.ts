import { ALL_SLIDES } from "./slides";

const KEY = "verbands-ceo.last-slide";

/**
 * Full-page views (record, posters, interviews, settings) are reached from a slide.
 * Their back button uses the browser history, but that fails after a reload or when
 * the page was opened directly — then we return to the slide last shown instead of
 * jumping to the very first one.
 */
export function rememberSlide(slideId: string) {
  try {
    window.sessionStorage.setItem(KEY, slideId);
  } catch {
    // Storage blocked: the back button just falls back to the first slide.
  }
}

export function lastSlidePath(): string {
  let id: string | null = null;
  try {
    id = window.sessionStorage.getItem(KEY);
  } catch {
    id = null;
  }
  const known = id && ALL_SLIDES.some((s) => s.id === id);
  return `/s/${known ? id : ALL_SLIDES[0].id}`;
}
