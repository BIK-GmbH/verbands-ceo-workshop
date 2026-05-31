import type { ReactNode } from "react";
import { useLang } from "@/lib/i18n";

/** Inline bilingual text. Use for short strings inside paragraphs / headings.
 *  For longer blocks of content prefer the block-level <Lang> component. */
export function I18n({ de, en }: { de: ReactNode; en: ReactNode }) {
  const [lang] = useLang();
  return <>{lang === "en" ? en : de}</>;
}

/** Block-level language switch — renders one of two children depending on lang.
 *  Usage: <Lang><de>…</de><en>…</en></Lang> via the helpers below. */
export function Lang({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
export function De({ children }: { children: ReactNode }) {
  const [lang] = useLang();
  if (lang !== "de") return null;
  return <>{children}</>;
}
export function En({ children }: { children: ReactNode }) {
  const [lang] = useLang();
  if (lang !== "en") return null;
  return <>{children}</>;
}
