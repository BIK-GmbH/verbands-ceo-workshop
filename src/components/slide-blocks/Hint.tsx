import type { ReactNode } from "react";
import { Info } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

interface HintProps {
  /** German explanation (shown in the bubble). */
  de: string;
  /** English explanation; falls back to German. */
  en?: string;
  /** Adds a small ⓘ after the term. */
  icon?: boolean;
  children: ReactNode;
}

/**
 * Slide term with a hover/focus/tap explanation.
 * MDX: <Hint de="Erläuterung" en="Explanation">sichtbarer Text</Hint>
 */
export function Hint({ de, en, icon, children }: HintProps) {
  const [lang] = useLang();
  const text = lang === "en" && en ? en : de;
  return (
    <Tooltip content={text} touch="tap">
      <span className="hint-term" tabIndex={0}>
        {children}
        {icon && (
          <span className="hint-icon" aria-hidden>
            <Info size={13} strokeWidth={2.25} />
          </span>
        )}
      </span>
    </Tooltip>
  );
}

/**
 * Stand-alone ⓘ with an explanation, e.g. after a heading or table header.
 * MDX: <HintIcon de="Erläuterung" en="Explanation" />
 */
export function HintIcon({ de, en }: { de: string; en?: string }) {
  const [lang] = useLang();
  const text = lang === "en" && en ? en : de;
  return (
    <Tooltip content={text} touch="tap">
      <span className="hint-icon" tabIndex={0} role="img" aria-label={lang === "en" ? "Explanation" : "Erläuterung"}>
        <Info size={15} strokeWidth={2.25} />
      </span>
    </Tooltip>
  );
}

/** Print variants: the visible text stays, the explanation is left out. */
export function PrintHint({ children }: { children?: ReactNode }) {
  return <>{children}</>;
}

export function PrintHintIcon() {
  return null;
}
