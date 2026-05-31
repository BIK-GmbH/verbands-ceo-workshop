import type { ReactNode } from "react";
import clsx from "clsx";

export type SkillTag =
  | "auto-invoke"
  | "manual"
  | "cross-skill"
  | "mcp"
  | "subagent"
  | "team"
  | "personal"
  | "ci"
  | "official"
  | "community";

interface Source {
  type: "youtube" | "blog" | "repo" | "docs" | "talk";
  title: string;
  url: string;
  /** Optional ISO date when this source was published */
  date?: string;
  /** Optional creator/author */
  author?: string;
}

interface Props {
  /** Skill identifier, e.g. "release-notes" */
  name: string;
  /** One-line what it does (bilingual short string OK) */
  what: ReactNode;
  /** Where the skill comes from / who showcased it */
  sources: Source[];
  /** Install/setup snippet (bash) */
  install?: string;
  /** Trigger phrases or invocation (text) */
  trigger?: string;
  /** Tags for filtering / discovery */
  tags?: SkillTag[];
  /** Optional extra notes (will render below) */
  children?: ReactNode;
  /** Tier — pinned at top of catalog */
  tier?: "must-have" | "useful" | "experimental";
}

const TIER_BADGE: Record<NonNullable<Props["tier"]>, { label: string; bg: string }> = {
  "must-have":    { label: "★ Must-have",    bg: "#1F4E79" },
  "useful":       { label: "✓ Useful",        bg: "#0d9488" },
  "experimental": { label: "⚗ Experimental",  bg: "#b45309" },
};

const TAG_COLOR: Partial<Record<SkillTag, string>> = {
  "auto-invoke":  "#1F4E79",
  "manual":       "#475569",
  "cross-skill":  "#7c3aed",
  "mcp":          "#0369a1",
  "subagent":     "#0d9488",
  "team":         "#059669",
  "personal":     "#6b7280",
  "ci":           "#7c3aed",
  "official":     "#1F4E79",
  "community":    "#b45309",
};

export function SkillCard({
  name,
  what,
  sources,
  install,
  trigger,
  tags,
  tier,
  children,
}: Props) {
  return (
    <article
      className="my-4 rounded-md border overflow-hidden"
      style={{ borderColor: "var(--border)", background: "var(--bg-elev)" }}
    >
      <header
        className="flex items-baseline gap-3 px-4 py-2.5 border-b"
        style={{ borderColor: "var(--border)" }}
      >
        {tier && (
          <span
            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-semibold shrink-0"
            style={{ background: TIER_BADGE[tier].bg, color: "white" }}
          >
            {TIER_BADGE[tier].label}
          </span>
        )}
        <code
          className="text-base font-semibold"
          style={{ color: "var(--workshop-accent)", background: "transparent", border: 0, padding: 0 }}
        >
          {name}
        </code>
        <span className="flex-1 text-sm" style={{ color: "var(--fg-muted)" }}>
          — {what}
        </span>
      </header>

      <div className="px-4 py-3 text-sm space-y-3">
        {tags && tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => (
              <span
                key={t}
                className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded"
                style={{
                  color: TAG_COLOR[t] ?? "var(--fg-muted)",
                  border: `1px solid ${TAG_COLOR[t] ?? "var(--border)"}`,
                  background: "color-mix(in oklch, " + (TAG_COLOR[t] ?? "#475569") + " 8%, transparent)",
                }}
              >
                {t}
              </span>
            ))}
          </div>
        )}

        {trigger && (
          <div>
            <div
              className="text-[11px] uppercase tracking-wider mb-1"
              style={{ color: "var(--fg-muted)" }}
            >
              Trigger
            </div>
            <code
              className="text-xs px-2 py-1 rounded inline-block"
              style={{
                background: "var(--bg)",
                border: "1px solid var(--border)",
                color: "var(--fg)",
              }}
            >
              {trigger}
            </code>
          </div>
        )}

        {install && (
          <div>
            <div
              className="text-[11px] uppercase tracking-wider mb-1"
              style={{ color: "var(--fg-muted)" }}
            >
              Install / Setup
            </div>
            <pre
              className={clsx(
                "p-2.5 m-0 text-xs overflow-x-auto rounded whitespace-pre-wrap",
              )}
              style={{ background: "#0b1220", color: "#e2e8f0" }}
            >
              <code>{install.trim()}</code>
            </pre>
          </div>
        )}

        {sources.length > 0 && (
          <div>
            <div
              className="text-[11px] uppercase tracking-wider mb-1"
              style={{ color: "var(--fg-muted)" }}
            >
              Quellen
            </div>
            <ul className="space-y-1">
              {sources.map((s) => (
                <li key={s.url} className="text-xs">
                  <span
                    className="inline-block text-[10px] uppercase mr-2 px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--bg)",
                      border: "1px solid var(--border)",
                      color: "var(--fg-muted)",
                    }}
                  >
                    {s.type}
                  </span>
                  <a
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "var(--workshop-accent)" }}
                  >
                    {s.title}
                  </a>
                  {s.author && (
                    <span style={{ color: "var(--fg-muted)" }}> · {s.author}</span>
                  )}
                  {s.date && (
                    <span style={{ color: "var(--fg-muted)" }}> · {s.date}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {children && <div className="pt-1">{children}</div>}
      </div>
    </article>
  );
}
