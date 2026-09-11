import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import type { Lang, SlideMeta } from "@/types/slide";
import { neighbours } from "@/lib/slides";
import { t, pick, formatAsOf } from "@/lib/i18n";
import { Tooltip } from "@/components/ui/Tooltip";

interface Props {
  lang: Lang;
  current: SlideMeta;
}

const ICON = { strokeWidth: 2.25 } as const;

export function Footer({ lang, current }: Props) {
  const { prev, next, index, total } = neighbours(current.id);

  return (
    <footer
      data-workshop-footer
      className="sticky bottom-0 z-30 border-t flex items-center px-3 sm:px-4 text-xs shrink-0 gap-2"
      style={{
        height: "var(--footer-height)",
        borderColor: "var(--border)",
        background: "var(--bg-elev)",
        color: "var(--fg-muted)",
      }}
    >
      {/* Equal-width spacer so the centre group sits at the true middle */}
      <div className="flex-1" />

      {/* Centre group: prev — counter — next */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {prev ? (
          <Tooltip content={`${t("prevSlide", lang)} · ${prev.id} ${pick(prev.title, lang)} (←)`}>
            <Link
              to={`/s/${prev.id}`}
              className="size-9 grid place-items-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
              aria-label={t("prevSlide", lang)}
            >
              <ChevronLeft size={18} {...ICON} />
            </Link>
          </Tooltip>
        ) : (
          <span className="size-9 grid place-items-center opacity-30">
            <ChevronLeft size={18} {...ICON} />
          </span>
        )}

        <div className="font-mono select-none tabular-nums">
          {index + 1} / {total}
          <span className="mx-2 opacity-50">·</span>
          <span className="hidden sm:inline">{t("module", lang)} </span>
          <span>{current.module === 99 ? "Anh" : current.module}</span>
        </div>

        {next ? (
          <Tooltip content={`${t("nextSlide", lang)} · ${next.id} ${pick(next.title, lang)} (→)`}>
            <Link
              to={`/s/${next.id}`}
              className="size-9 grid place-items-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
              aria-label={t("nextSlide", lang)}
            >
              <ChevronRight size={18} {...ICON} />
            </Link>
          </Tooltip>
        ) : (
          <span className="size-9 grid place-items-center opacity-30">
            <ChevronRight size={18} {...ICON} />
          </span>
        )}
      </div>

      {/* Right group: secondary actions, mirrors the left spacer */}
      <div className="flex-1 flex items-center justify-end gap-3">
        {current.researchedOn && (
          <span className="hidden md:inline" title={t("researchedOn", lang)}>
            {t("researchedOn", lang)}: {formatAsOf(current.researchedOn, lang)}
          </span>
        )}
        <Tooltip
          side="top"
          content={
            lang === "de"
              ? "Druckansicht: alle Folien untereinander, ohne Eingabefelder und Sprechernotizen. Über den Browser drucken oder als PDF speichern."
              : "Print view: all slides one after another, without input fields and speaker notes. Print from the browser or save as PDF."
          }
        >
          <Link
            to="/print"
            className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
            aria-label={t("print", lang)}
          >
            <Printer size={16} {...ICON} />
            <span className="hidden sm:inline">{t("print", lang)}</span>
          </Link>
        </Tooltip>
      </div>
    </footer>
  );
}
