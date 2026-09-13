import { HelpCircle } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useHelp } from "@/lib/help";
import { Tooltip } from "@/components/ui/Tooltip";
import { SOFT, SOFT_HOVER } from "@/components/ui/soft-control";

/**
 * Entry point to the help, styled like the other quiet header controls.
 * One line in the header is enough: <HelpButton lang={lang} />
 */
export function HelpButton({ lang }: { lang: Lang }) {
  const help = useHelp();
  const de = lang === "de";
  return (
    <Tooltip
      content={
        de
          ? "Hilfe: Was diese App kann, wie man etwas festhält, einspricht, Poster erzeugt und exportiert — mit Sprungzielen. Taste ?"
          : "Help: what this app can do, how to capture, dictate, create posters and export — with jump targets. Key ?"
      }
    >
      <button
        type="button"
        onClick={() => help.open()}
        data-testid="open-help"
        className={`size-9 grid place-items-center rounded-md transition-colors ${SOFT_HOVER}`}
        style={SOFT}
        aria-label={de ? "Hilfe" : "Help"}
      >
        <HelpCircle size={18} strokeWidth={2.25} />
      </button>
    </Tooltip>
  );
}
