import type { ReactNode } from "react";
import clsx from "clsx";
import { useLang, t } from "@/lib/i18n";

type Variant = "tip" | "warning" | "hint";

const VARIANTS: Record<Variant, { icon: string; color: string; bg: string }> = {
  tip:     { icon: "💡", color: "var(--workshop-accent)", bg: "color-mix(in oklch, var(--workshop-accent) 7%, transparent)" },
  warning: { icon: "⚠️", color: "#b45309",                 bg: "rgba(245, 158, 11, 0.10)" },
  hint:    { icon: "ℹ️", color: "#0369a1",                 bg: "rgba(14, 165, 233, 0.08)" },
};

interface Props {
  variant?: Variant;
  title?: string;
  children: ReactNode;
}

export function NoteCard({ variant = "hint", title, children }: Props) {
  const [lang] = useLang();
  const v = VARIANTS[variant];
  const fallbackTitle = t(variant, lang);

  return (
    <aside
      className={clsx("my-4 p-4 rounded-md border-l-4 text-sm")}
      style={{ borderColor: v.color, background: v.bg }}
    >
      <header className="flex items-center gap-2 mb-1 font-semibold" style={{ color: v.color }}>
        <span aria-hidden>{v.icon}</span>
        <span>{title ?? fallbackTitle}</span>
      </header>
      <div>{children}</div>
    </aside>
  );
}
