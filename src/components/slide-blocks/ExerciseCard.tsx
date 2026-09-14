import type { ReactNode } from "react";
import { ClipboardList } from "lucide-react";
import { useLang, t } from "@/lib/i18n";

interface Props {
  duration?: string;
  goal?: string;
  /** Optional bilingual title override */
  title?: { de: string; en: string };
  children: ReactNode;
}

export function ExerciseCard({ duration, goal, title, children }: Props) {
  const [lang] = useLang();
  const heading = title ? title[lang] : t("exercise", lang);

  return (
    <section className="ws-info-block my-6 rounded-lg p-5">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-1 mb-3">
        <span className="ws-info-chip inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded">
          <ClipboardList size={13} aria-hidden />
          {heading}
        </span>
        {duration && (
          <span className="text-xs" style={{ color: "var(--fg-muted)" }}>
            ⏱ {t("duration", lang)}: {duration}
          </span>
        )}
      </header>
      {goal && (
        <p className="mb-3 text-sm">
          <strong>{t("goal", lang)}:</strong> {goal}
        </p>
      )}
      <div className="text-sm leading-relaxed">{children}</div>
    </section>
  );
}
