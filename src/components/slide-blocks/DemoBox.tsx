import { useState, type ReactNode, isValidElement } from "react";
import clsx from "clsx";

interface Props {
  /** Headline above the snippet, e.g. "Skill installieren" */
  title: string;
  /** Optional bilingual title — overrides title */
  titleI18n?: { de: string; en: string };
  /** Optional one-line context, e.g. "in einer leeren Test-Repo ausführen" */
  context?: string;
  /** Code block language hint */
  lang?: string;
  /** Step number in a sequence, optional */
  step?: number;
  /** Snippet content */
  children: ReactNode;
}

function extractText(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(extractText).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) {
    return extractText(node.props.children);
  }
  return "";
}

/** A copy-paste-ready demo snippet for live trainer use.
 *  Distinct from CommandBox: header has "▶ DEMO" badge + numbered step. */
export function DemoBox({ title, titleI18n, context, lang = "bash", step, children }: Props) {
  const [copied, setCopied] = useState(false);
  const code = extractText(children).replace(/^\n/, "").replace(/\n$/, "");

  const headerLabel =
    titleI18n
      ? // We can't call useLang here cleanly without dragging it in,
        // but DemoBox children already use <I18n> so we keep title plain
        // and let consumers pass language-specific via two DemoBoxes if needed.
        titleI18n.de
      : title;

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  }

  return (
    <section
      className="my-5 rounded-md border overflow-hidden"
      style={{
        borderColor: "var(--workshop-accent)",
        background: "color-mix(in oklch, var(--workshop-accent) 4%, transparent)",
      }}
    >
      <header
        className="flex items-center gap-3 px-4 py-2 text-sm font-medium"
        style={{ background: "var(--workshop-accent)", color: "white" }}
      >
        <span
          className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded"
          style={{ background: "rgba(255,255,255,0.18)" }}
        >
          ▶ Demo{step ? ` · ${step}` : ""}
        </span>
        <span className="flex-1 truncate">{headerLabel}</span>
        <button
          onClick={copy}
          className={clsx(
            "px-2 py-0.5 rounded text-[11px] no-print",
            copied ? "bg-emerald-500/30" : "bg-white/15 hover:bg-white/25",
          )}
        >
          {copied ? "✓ kopiert" : "copy"}
        </button>
      </header>
      {context && (
        <p
          className="px-4 py-1.5 text-xs"
          style={{
            color: "var(--fg-muted)",
            borderBottom: "1px solid var(--border)",
            background: "var(--bg-elev)",
          }}
        >
          {context}
        </p>
      )}
      <pre
        className="p-4 m-0 text-sm overflow-x-auto whitespace-pre-wrap"
        style={{ background: "#0b1220", color: "#e2e8f0" }}
      >
        <code data-lang={lang}>{code}</code>
      </pre>
    </section>
  );
}
