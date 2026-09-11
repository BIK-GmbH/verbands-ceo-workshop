/** Shared styles and small helpers for the interview mode (/interviews). */
import { Fragment, type CSSProperties, type ReactNode } from "react";
import type { Lang } from "@/types/slide";

export const ERROR_COLOR = "#dc2626";
export const WARN_COLOR = "#d97706";

export const BTN =
  "inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
export const BTN_SM =
  "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";

export const primary: CSSProperties = { background: "var(--workshop-accent)", color: "white" };
export const outline: CSSProperties = { border: "1px solid var(--border)", color: "var(--fg)", background: "var(--bg)" };
export const accentOutline: CSSProperties = {
  border: "1px solid var(--workshop-accent)",
  color: "var(--workshop-accent)",
  background: "var(--bg)",
};
export const danger: CSSProperties = { border: "1px solid var(--border)", color: ERROR_COLOR, background: "var(--bg)" };
export const field: CSSProperties = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" };
export const card: CSSProperties = { background: "var(--bg-elev)", border: "1px solid var(--border)" };
export const muted: CSSProperties = { color: "var(--fg-muted)" };

export function formatDuration(sec?: number): string {
  if (sec === undefined || !Number.isFinite(sec)) return "–";
  const s = Math.max(0, Math.round(sec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function formatBytes(n: number, lang: Lang): string {
  const text = n < 1024 * 1024 ? `${Math.max(1, Math.round(n / 1024))} KB` : `${(n / 1024 / 1024).toFixed(1)} MB`;
  return lang === "de" ? text.replace(".", ",") : text;
}

export function formatDate(iso: string, lang: Lang): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", { dateStyle: "short", timeStyle: "short" });
}

export function safeFileName(s: string): string {
  const cleaned = s
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .replace(/[^\w.-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
  return cleaned || "interview";
}

export function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoke later: some browsers read the URL asynchronously after click().
  window.setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function Notice({ tone, children }: { tone: "ok" | "error" | "warn"; children: ReactNode }) {
  const color = tone === "error" ? ERROR_COLOR : tone === "warn" ? WARN_COLOR : "var(--fg)";
  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className="text-xs rounded-md px-2.5 py-2 leading-snug"
      style={{
        color,
        background:
          tone === "ok" ? "color-mix(in oklch, var(--workshop-accent) 7%, transparent)" : "color-mix(in oklch, currentColor 8%, transparent)",
      }}
    >
      {children}
    </p>
  );
}

function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*)/g)
    .filter(Boolean)
    .map((part, i) =>
      part.length > 4 && part.startsWith("**") && part.endsWith("**") ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : (
        <Fragment key={i}>{part}</Fragment>
      ),
    );
}

interface MdState {
  blocks: ReactNode[];
  para: string[];
  list: { ordered: boolean; items: string[] } | null;
}

/**
 * Minimal Markdown view for the AI opinion texts (headings, lists, bold,
 * quotes). Builds React elements, never HTML strings, so model output cannot inject markup.
 */
export function MiniMarkdown({ text }: { text: string }) {
  const st: MdState = { blocks: [], para: [], list: null };
  const flushPara = () => {
    if (!st.para.length) return;
    st.blocks.push(
      <p key={st.blocks.length} className="my-1.5">
        {inline(st.para.join(" "))}
      </p>,
    );
    st.para = [];
  };
  const flushList = () => {
    if (!st.list) return;
    const { ordered, items } = st.list;
    const children = items.map((it, i) => <li key={i}>{inline(it)}</li>);
    st.blocks.push(
      ordered ? (
        <ol key={st.blocks.length} className="my-1.5 pl-5 space-y-0.5 list-decimal">
          {children}
        </ol>
      ) : (
        <ul key={st.blocks.length} className="my-1.5 pl-5 space-y-0.5 list-disc">
          {children}
        </ul>
      ),
    );
    st.list = null;
  };

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    if (!line.trim()) {
      flushPara();
      flushList();
      continue;
    }
    const heading = /^\s{0,3}#{1,6}\s+(.*)$/.exec(line);
    if (heading) {
      flushPara();
      flushList();
      st.blocks.push(
        <h4 key={st.blocks.length} className="mt-3 mb-1 text-sm font-semibold" style={{ color: "var(--workshop-accent)" }}>
          {inline(heading[1])}
        </h4>,
      );
      continue;
    }
    const ul = /^\s*[-*+•]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+[.)]\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const ordered = !ul;
      if (st.list && st.list.ordered !== ordered) flushList();
      if (!st.list) st.list = { ordered, items: [] };
      st.list.items.push((ul ?? ol)?.[1] ?? "");
      continue;
    }
    const quote = /^\s*>\s?(.*)$/.exec(line);
    if (quote) {
      flushPara();
      flushList();
      st.blocks.push(
        <blockquote key={st.blocks.length} className="my-1.5 pl-3 italic" style={{ borderLeft: "3px solid var(--border)" }}>
          {inline(quote[1])}
        </blockquote>,
      );
      continue;
    }
    flushList();
    st.para.push(line.trim());
  }
  flushPara();
  flushList();
  return <div className="text-sm leading-relaxed">{st.blocks}</div>;
}
