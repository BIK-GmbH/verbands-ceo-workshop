import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Printer } from "lucide-react";
import type { Lang, SlideMeta } from "@/types/slide";
import { neighbours } from "@/lib/slides";
import { t } from "@/lib/i18n";

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
          <Link
            to={`/s/${prev.id}`}
            className="size-9 grid place-items-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
            title={`${t("prevSlide", lang)} (${prev.id})`}
            aria-label={t("prevSlide", lang)}
          >
            <ChevronLeft size={18} {...ICON} />
          </Link>
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
          <Link
            to={`/s/${next.id}`}
            className="size-9 grid place-items-center rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
            title={`${t("nextSlide", lang)} (${next.id})`}
            aria-label={t("nextSlide", lang)}
          >
            <ChevronRight size={18} {...ICON} />
          </Link>
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
            {t("researchedOn", lang)}: {current.researchedOn}
          </span>
        )}
        <Link
          to="/print"
          className="inline-flex items-center gap-1.5 px-2.5 h-9 rounded-md hover:bg-black/5 active:bg-black/10 transition-colors"
          title={t("print", lang)}
          aria-label={t("print", lang)}
        >
          <Printer size={16} {...ICON} />
          <span className="hidden sm:inline">{t("print", lang)}</span>
        </Link>
      </div>
    </footer>
  );
}
