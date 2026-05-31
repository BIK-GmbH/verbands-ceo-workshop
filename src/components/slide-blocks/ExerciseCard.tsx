import type { ReactNode } from "react";
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
    <section
      className="my-6 border rounded-lg p-5"
      style={{
        borderColor: "var(--workshop-accent)",
        background:
          "color-mix(in oklch, var(--workshop-accent) 6%, transparent)",
      }}
    >
      <header className="flex items-center gap-3 mb-3">
        <span
          className="text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: "var(--workshop-accent)", color: "white" }}
        >
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
