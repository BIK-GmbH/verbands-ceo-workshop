/**
 * One printable poster sheet. Laid out at A3 size in CSS px and zoomed to the
 * target (screen fit or paper format). Colours are fixed and light on purpose:
 * posters are printed and hung on a wall, whatever the app theme is.
 * Empty fields render handwriting lines, so the same sheet is also the blank template.
 */
import { createContext, useContext, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Lang } from "@/types/slide";
import { posterField, SHEET_PX, WORKSHOP_TITLE, type Orientation, type PosterDef, type PosterLayout } from "@/lib/posters";

const INK = "#181A27";
const RED = "#CD184B";
const GREY = "#5a5e6b";
const TINT = "#f3f3f1";
const RULE = "#d6d7dc";
const GO = "#16a34a";
const ADAPT = "#d97706";
const STOP = "#dc2626";
const BASE = import.meta.env.BASE_URL;

interface SheetCtx {
  def: PosterDef;
  lang: Lang;
  values: Record<string, string>;
  image?: string;
  editing: boolean;
  onEdit?: (entryId: string, value: string) => void;
  portrait: boolean;
}

const Ctx = createContext<SheetCtx | null>(null);

function useSheet(): SheetCtx {
  const c = useContext(Ctx);
  if (!c) throw new Error("Poster field rendered outside <PosterSheet>");
  return c;
}

function useField(k: string) {
  const ctx = useSheet();
  const field = posterField(ctx.def, k);
  return { ctx, field, value: ctx.values[field.entryId] ?? "" };
}

const BULLET = /^([-•*–]|\d+[.)])\s+/;

/** Multi-line input or "- " lines become a list; a single line stays a sentence. */
function toItems(text: string): { list: boolean; items: string[] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  if (lines.length > 1 || BULLET.test(lines[0] ?? "")) {
    return { list: true, items: lines.map((l) => l.replace(BULLET, "")) };
  }
  return { list: false, items: lines };
}

/** Shrinks its text until it fits the box — long workshop input must never spill off the sheet. */
function FitText({ size, fitKey, children }: { size: number; fitKey: string; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState({ key: fitKey, scale: 1 });
  const scale = fit.key === fitKey ? fit.scale : 1;
  useLayoutEffect(() => {
    const el = ref.current;
    if (el && el.scrollHeight > el.clientHeight + 1 && scale > 0.3) setFit({ key: fitKey, scale: scale * 0.88 });
  });
  return (
    <div ref={ref} style={{ position: "absolute", inset: 0, overflow: "hidden", fontSize: size * scale, lineHeight: 1.25 }}>
      {children}
    </div>
  );
}

interface TextOpts {
  size?: number;
  numbered?: boolean;
  bold?: boolean;
  align?: "left" | "center";
  marker?: string;
}

function TextContent({ text, numbered, bold, align = "left", marker = RED }: TextOpts & { text: string }) {
  const { list, items } = toItems(text);
  if (!list) {
    return <p style={{ margin: 0, fontWeight: bold ? 800 : 500, textAlign: align }}>{items.join(" ")}</p>;
  }
  return (
    <ul style={{ listStyle: "none", margin: 0, padding: 0, display: "flex", flexDirection: "column", gap: "0.35em" }}>
      {items.map((it, i) => (
        <li key={i} style={{ display: "flex", gap: "0.55em", alignItems: "flex-start", fontWeight: bold ? 700 : 500 }}>
          {numbered ? (
            <span
              style={{
                width: "1.45em",
                height: "1.45em",
                borderRadius: "50%",
                background: marker,
                color: "#fff",
                fontWeight: 800,
                fontSize: "0.8em",
                display: "inline-grid",
                placeItems: "center",
                flexShrink: 0,
                marginTop: "0.08em",
              }}
            >
              {i + 1}
            </span>
          ) : (
            <span style={{ width: "0.42em", height: "0.42em", background: marker, flexShrink: 0, marginTop: "0.42em" }} />
          )}
          <span style={{ minWidth: 0 }}>{it}</span>
        </li>
      ))}
    </ul>
  );
}

/** The value area of a text field: text (fitted), writing lines when empty, or a textarea when editing. */
function FieldBody({ k, size = 24, lineColor, ...opts }: TextOpts & { k: string; lineColor?: string }) {
  const { ctx, field, value } = useField(k);
  let content: ReactNode;
  if (ctx.editing && ctx.onEdit) {
    const onEdit = ctx.onEdit;
    content = (
      <textarea
        className="poster-edit-area"
        value={value}
        onChange={(e) => onEdit(field.entryId, e.target.value)}
        aria-label={field.label[ctx.lang]}
        placeholder={ctx.lang === "de" ? "Posterfassung …" : "Poster wording …"}
        style={{ position: "absolute", inset: 0, fontSize: Math.max(16, size * 0.8) }}
      />
    );
  } else if (!value.trim()) {
    content = (
      <div
        className="poster-lines"
        style={{ position: "absolute", inset: 0, "--line-gap": `${Math.round(size * 2)}px`, "--line-color": lineColor } as CSSProperties}
      />
    );
  } else {
    content = (
      <FitText size={size} fitKey={`${value}|${ctx.portrait}|${size}`}>
        <TextContent text={value} {...opts} />
      </FitText>
    );
  }
  return <div style={{ position: "relative", flex: 1, minHeight: 0, minWidth: 0 }}>{content}</div>;
}

type Tone = "plain" | "tint" | "hero" | "red";

const TONES: Record<Tone, CSSProperties> = {
  plain: { background: "#fff", border: `2px solid ${RULE}` },
  tint: { background: TINT, border: `2px solid ${TINT}` },
  hero: { background: "#fff", border: `5px solid ${RED}` },
  red: { background: RED, border: `2px solid ${RED}`, color: "#fff" },
};

function Label({ children, light }: { children: ReactNode; light?: boolean }) {
  return (
    <div
      style={{
        fontSize: 17,
        fontWeight: 800,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: light ? "rgba(255,255,255,0.88)" : RED,
        marginBottom: 10,
        lineHeight: 1.2,
      }}
    >
      {children}
    </div>
  );
}

function Panel({
  label,
  heading,
  tone = "plain",
  accent,
  style,
  children,
}: {
  label?: ReactNode;
  heading?: ReactNode;
  tone?: Tone;
  accent?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        borderRadius: 14,
        padding: "16px 20px 18px",
        minHeight: 0,
        minWidth: 0,
        flex: 1,
        ...TONES[tone],
        ...(accent ? { borderTop: `12px solid ${accent}` } : {}),
        ...style,
      }}
    >
      {heading ?? (label ? <Label light={tone === "red"}>{label}</Label> : null)}
      {children}
    </section>
  );
}

function TextField({
  k,
  tone,
  accent,
  heading,
  hideLabel,
  footer,
  style,
  ...opts
}: TextOpts & {
  k: string;
  tone?: Tone;
  accent?: string;
  heading?: ReactNode;
  hideLabel?: boolean;
  footer?: ReactNode;
  style?: CSSProperties;
}) {
  const { ctx, field } = useField(k);
  const onRed = tone === "red";
  return (
    <Panel tone={tone} accent={accent} heading={heading} label={hideLabel ? undefined : field.label[ctx.lang]} style={style}>
      <FieldBody k={k} marker={onRed ? "#fff" : opts.marker} lineColor={onRed ? "rgba(255,255,255,0.55)" : undefined} {...opts} />
      {footer ? <div style={{ marginTop: 12 }}>{footer}</div> : null}
    </Panel>
  );
}

function Checkbox({ on, color }: { on: boolean; color: string }) {
  return (
    <span
      style={{
        width: "1.15em",
        height: "1.15em",
        border: `3px solid ${on ? color : INK}`,
        borderRadius: 4,
        background: on ? color : "#fff",
        color: "#fff",
        display: "inline-grid",
        placeItems: "center",
        fontSize: "0.85em",
        fontWeight: 900,
        flexShrink: 0,
        lineHeight: 1,
      }}
    >
      {on ? "✓" : ""}
    </span>
  );
}

/** Vote/decision field: all options as tick boxes — ticked when decided, empty for the wall. */
function ChoiceOptions({ k, size = 20, direction = "column" }: { k: string; size?: number; direction?: "row" | "column" }) {
  const { ctx, field, value } = useField(k);
  const options = field.options ?? [];
  const all = value && !options.includes(value) ? [...options, value] : options;
  const onEdit = ctx.editing ? ctx.onEdit : undefined;
  return (
    <div style={{ display: "flex", flexDirection: direction, flexWrap: "wrap", gap: direction === "row" ? "10px 30px" : 10, fontSize: size }}>
      {all.map((o) => {
        const on = value === o;
        const inner = (
          <>
            <Checkbox on={on} color={RED} />
            <span style={{ fontWeight: on ? 800 : 500, color: !value || on ? INK : GREY, lineHeight: 1.2 }}>{o}</span>
          </>
        );
        const rowStyle: CSSProperties = { display: "flex", alignItems: "center", gap: "0.5em", textAlign: "left" };
        return onEdit ? (
          <button
            key={o}
            type="button"
            onClick={() => onEdit(field.entryId, on ? "" : o)}
            style={{ ...rowStyle, cursor: "pointer", background: "none", border: "none", padding: 0, font: "inherit", color: "inherit" }}
          >
            {inner}
          </button>
        ) : (
          <div key={o} style={rowStyle}>
            {inner}
          </div>
        );
      })}
    </div>
  );
}

function ChoicePanel({ k, direction, size, style }: { k: string; direction?: "row" | "column"; size?: number; style?: CSSProperties }) {
  const { ctx, field } = useField(k);
  return (
    <Panel label={field.label[ctx.lang]} style={{ flex: "0 0 auto", ...style }}>
      <ChoiceOptions k={k} direction={direction} size={size} />
    </Panel>
  );
}

function Row({ children, flex = 1, gap = 22 }: { children: ReactNode; flex?: number; gap?: number }) {
  return <div style={{ display: "flex", gap, flex, minHeight: 0 }}>{children}</div>;
}

function Col({ children, flex = 1, gap = 22 }: { children: ReactNode; flex?: number; gap?: number }) {
  return <div style={{ display: "flex", flexDirection: "column", gap, flex, minHeight: 0, minWidth: 0 }}>{children}</div>;
}

function Motto({ size = 26 }: { size?: number }) {
  const { def, lang } = useSheet();
  if (!def.motto) return null;
  return (
    <div style={{ fontSize: size, fontWeight: 800, color: RED, textAlign: "center", lineHeight: 1.25, flex: "0 0 auto" }}>
      {lang === "de" ? `„${def.motto.de}“` : `“${def.motto.en}”`}
    </div>
  );
}

/* ───────────────────────── Layouts ───────────────────────── */

function Step({ k, indent, top, bottom }: { k: string; indent: number; top: boolean; bottom: boolean }) {
  const { ctx, field } = useField(k);
  return (
    <div
      style={{
        // The cause is the point of the staircase: give it room so its text is not shrunk.
        flex: top ? 1.4 : 1,
        minHeight: 0,
        marginLeft: `${indent}%`,
        display: "flex",
        borderRadius: 10,
        background: top ? RED : bottom ? TINT : "#fff",
        color: top ? "#fff" : INK,
        border: `2px solid ${top ? RED : RULE}`,
      }}
    >
      <div
        style={{
          width: 150,
          flexShrink: 0,
          padding: "0 14px",
          display: "flex",
          alignItems: "center",
          fontSize: 15,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          lineHeight: 1.15,
          color: top ? "#fff" : RED,
          borderRight: `2px solid ${top ? "rgba(255,255,255,0.45)" : RULE}`,
        }}
      >
        {field.label[ctx.lang]}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: "flex", padding: "8px 14px" }}>
        <FieldBody k={k} size={21} bold={top} marker={top ? "#fff" : RED} lineColor={top ? "rgba(255,255,255,0.55)" : undefined} />
      </div>
    </div>
  );
}

function StaircaseLayout() {
  const { lang, portrait } = useSheet();
  const steps = ["symptom", "warum-1", "warum-2", "warum-3", "warum-4", "warum-5", "ursache"];
  const indent = portrait ? 5.5 : 6.5;
  return (
    <>
      <TextField
        k="kernproblem"
        tone="hero"
        size={40}
        bold
        style={{ flex: 0.62 }}
        footer={<ChoiceOptions k="bestaetigt" direction="row" size={20} />}
      />
      <Row flex={1.9}>
        <Panel
          label={lang === "de" ? "Die Ursachen-Treppe · 5× Warum · vom Symptom zur Ursache" : "The cause staircase · 5 whys · from symptom to cause"}
          style={{ flex: portrait ? 1.75 : 2.1 }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 8, minHeight: 0 }}>
            {[...steps].reverse().map((k) => {
              const level = steps.indexOf(k);
              return <Step key={k} k={k} indent={level * indent} top={k === "ursache"} bottom={k === "symptom"} />;
            })}
          </div>
        </Panel>
        <Col>
          <TextField k="problemfelder" size={22} />
          <TextField k="ursachen" size={22} tone="tint" />
        </Col>
      </Row>
    </>
  );
}

function HorizonHead({ k, color }: { k: string; color: string }) {
  const { ctx, field } = useField(k);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 29, fontWeight: 900, color, letterSpacing: "0.01em", textTransform: "uppercase", lineHeight: 1.05, whiteSpace: "nowrap" }}>
        {field.label[ctx.lang]} →
      </div>
      <div style={{ fontSize: 16, color: GREY, fontWeight: 600, marginTop: 4 }}>
        {ctx.lang === "de" ? "relevante Möglichkeiten" : "relevant possibilities"}
      </div>
    </div>
  );
}

function HorizonsLayout() {
  const horizons: [string, string][] = [
    ["heute", "#8b8e99"],
    ["morgen", "#e0678a"],
    ["uebermorgen", RED],
  ];
  return (
    <>
      <TextField k="kernproblem" tone="tint" size={22} style={{ flex: 0.3 }} />
      <Row flex={1.25}>
        {horizons.map(([k, c]) => (
          <TextField key={k} k={k} accent={c} marker={c} heading={<HorizonHead k={k} color={c} />} size={21} />
        ))}
      </Row>
      <TextField k="stossrichtungen" tone="hero" numbered size={28} style={{ flex: 1.05 }} />
      <TextField k="weiter" size={21} style={{ flex: 0.42 }} />
    </>
  );
}

function ImagePanel({ style }: { style?: CSSProperties }) {
  const { ctx, field } = useField("bild");
  const { image, lang } = ctx;
  return (
    <Panel label={field.label[lang]} style={style}>
      <div
        style={{
          position: "relative",
          flex: 3,
          minHeight: 0,
          borderRadius: 10,
          border: image ? "none" : `3px dashed ${RULE}`,
          background: image ? TINT : "#fff",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {image ? (
          <img src={image} alt={lang === "de" ? "Zielbild" : "Target picture"} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 26, color: "#b3b5bd", fontWeight: 800, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            {lang === "de" ? "Bild / Skizze" : "Image / sketch"}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minHeight: 70, maxHeight: 150, marginTop: 12, display: "flex" }}>
        <FieldBody k="bild" size={21} />
      </div>
    </Panel>
  );
}

function TargetLayout() {
  const { portrait } = useSheet();
  return (
    <>
      <TextField k="leitsatz" tone="red" size={42} bold align="center" style={{ flex: 0.5 }} />
      {portrait ? (
        <>
          <ImagePanel style={{ flex: 1.35 }} />
          <Row flex={1}>
            <TextField k="profil" size={22} />
            <TextField k="use-cases" size={22} tone="tint" />
          </Row>
        </>
      ) : (
        <Row flex={1.9}>
          <ImagePanel style={{ flex: 1.25 }} />
          <Col>
            <TextField k="profil" size={22} />
            <TextField k="use-cases" size={22} tone="tint" />
          </Col>
        </Row>
      )}
      <ChoicePanel k="commitment" direction="row" size={21} />
    </>
  );
}

function ColumnHead({ title, sub, color }: { title: string; sub: string; color: string }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ fontSize: 46, fontWeight: 900, color, lineHeight: 1, letterSpacing: "0.02em" }}>{title}</div>
      <div style={{ fontSize: 18, color: GREY, fontWeight: 700, marginTop: 6 }}>{sub}</div>
    </div>
  );
}

const AMPEL_COLORS = [GO, "#eab308", STOP];

function Ampel({ k }: { k: string }) {
  const { ctx, field, value } = useField(k);
  const options = field.options ?? [];
  const onEdit = ctx.editing ? ctx.onEdit : undefined;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ flex: 1, fontSize: 21, fontWeight: 700, minWidth: 0 }}>{field.label[ctx.lang]}</div>
      {options.map((o, i) => {
        const on = value === o;
        const dot: CSSProperties = {
          width: 40,
          height: 40,
          borderRadius: "50%",
          border: `4px solid ${AMPEL_COLORS[i]}`,
          background: on ? AMPEL_COLORS[i] : "#fff",
          boxShadow: on ? `0 0 0 4px ${AMPEL_COLORS[i]}33` : undefined,
          flexShrink: 0,
          padding: 0,
        };
        return onEdit ? (
          <button key={o} type="button" title={o} onClick={() => onEdit(field.entryId, on ? "" : o)} style={{ ...dot, cursor: "pointer" }} />
        ) : (
          <span key={o} title={o} style={dot} />
        );
      })}
    </div>
  );
}

function TrafficLayout() {
  const { lang } = useSheet();
  const cols: [string, string, string][] = [
    ["go", "GO", GO],
    ["adapt", "ADAPT", ADAPT],
    ["stop", "STOP", STOP],
  ];
  return (
    <>
      <TextField k="diesmal" tone="hero" size={36} bold style={{ flex: 0.55 }} />
      <Row flex={1.7}>
        {cols.map(([k, title, color]) => (
          <ColumnField key={k} k={k} title={title} color={color} />
        ))}
      </Row>
      <Row flex={0.62}>
        <Panel label={lang === "de" ? "Prüfrahmen · Ampeln" : "Test frame · traffic lights"}>
          <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-around", gap: 8 }}>
            <Ampel k="ampel-technisch" />
            <Ampel k="ampel-organisatorisch" />
            <Ampel k="ampel-mitglieder" />
          </div>
        </Panel>
        <TextField k="erfahrungen" tone="tint" size={21} style={{ flex: 1.15 }} />
      </Row>
      <Motto />
    </>
  );
}

function ColumnField({ k, title, color }: { k: string; title: string; color: string }) {
  const { ctx, field } = useField(k);
  return <TextField k={k} accent={color} marker={color} size={22} heading={<ColumnHead title={title} sub={field.label[ctx.lang]} color={color} />} />;
}

function HypothesisCheck() {
  const { ctx, field } = useField("hypothese-check");
  return (
    <div>
      <div style={{ fontSize: 15, fontWeight: 700, color: GREY, marginBottom: 8 }}>{field.label[ctx.lang]}</div>
      <ChoiceOptions k="hypothese-check" direction="row" size={17} />
    </div>
  );
}

function CanvasLayout() {
  const { portrait } = useSheet();
  return (
    <div
      style={{
        flex: 1,
        minHeight: 0,
        display: "grid",
        gap: 22,
        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
        gridTemplateRows: portrait
          ? "minmax(0, 1.2fr) minmax(0, 1fr) minmax(0, 0.95fr) minmax(0, 0.8fr)"
          : "minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 0.95fr) minmax(0, 0.78fr)",
        gridTemplateAreas: `"nutzen hyp kosten" "nutzen strat kosten" "einw einw einw" "pitch pitch pitch"`,
      }}
    >
      <TextField k="nutzen" accent={GO} marker={GO} size={22} style={{ gridArea: "nutzen" }} />
      <TextField k="hypothese" tone="tint" size={21} style={{ gridArea: "hyp" }} footer={<HypothesisCheck />} />
      <TextField k="strategie" tone="tint" size={21} style={{ gridArea: "strat" }} />
      <TextField k="kosten" accent={INK} marker={INK} size={22} style={{ gridArea: "kosten" }} />
      <TextField k="einwaende" size={21} style={{ gridArea: "einw" }} />
      <TextField k="pitch" tone="red" size={28} bold style={{ gridArea: "pitch" }} />
    </div>
  );
}

const MILESTONES = ["100-tage", "12-monate", "24-monate", "36-monate"];

function MilestoneDot({ last }: { last: boolean }) {
  return (
    <span
      style={{
        width: 52,
        height: 52,
        borderRadius: "50%",
        background: last ? RED : "#fff",
        border: `8px solid ${RED}`,
        flexShrink: 0,
        boxSizing: "border-box",
      }}
    />
  );
}

function MilestoneLabel({ k }: { k: string }) {
  const { ctx, field } = useField(k);
  return <span style={{ fontSize: 32, fontWeight: 900, background: "#fff", padding: "0 8px", whiteSpace: "nowrap" }}>{field.label[ctx.lang]}</span>;
}

function TimelineLayout() {
  const { def, lang, portrait } = useSheet();
  const rail = portrait ? `linear-gradient(180deg, ${GREY}, ${RED})` : `linear-gradient(90deg, ${GREY}, ${RED})`;
  return (
    <>
      <div style={{ fontSize: 36, fontWeight: 900, color: RED, lineHeight: 1.1, flex: "0 0 auto" }}>{def.motto?.[lang]}</div>
      {portrait ? (
        <div style={{ flex: 1.9, minHeight: 0, position: "relative", display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ position: "absolute", top: 20, bottom: 20, left: 22, width: 8, background: rail, borderRadius: 4 }} />
          {MILESTONES.map((k, i) => (
            <div key={k} style={{ flex: 1, minHeight: 0, display: "flex", gap: 18, position: "relative" }}>
              <div style={{ width: 240, flexShrink: 0, display: "flex", alignItems: "center", gap: 10 }}>
                <MilestoneDot last={i === MILESTONES.length - 1} />
                <MilestoneLabel k={k} />
              </div>
              <TextField k={k} hideLabel size={22} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ flex: 1.5, minHeight: 0, position: "relative", display: "flex", gap: 22 }}>
          <div style={{ position: "absolute", left: 0, right: 0, top: 22, height: 8, background: rail, borderRadius: 4 }} />
          {MILESTONES.map((k, i) => (
            <div key={k} style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", gap: 16, position: "relative" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, height: 52 }}>
                <MilestoneDot last={i === MILESTONES.length - 1} />
                <MilestoneLabel k={k} />
              </div>
              <TextField k={k} hideLabel size={22} />
            </div>
          ))}
        </div>
      )}
      <Row flex={0.7}>
        <TextField k="handlungsfelder" size={20} />
        <TextField k="quick-wins" size={20} tone="tint" />
        <TextField k="verantwortliche" size={20} accent={RED} />
      </Row>
    </>
  );
}

/**
 * The barometer result is either one option (poster draft / older data) or the distribution
 * written by the BarometerVotes block, e.g. "Realität: 3 · Eher Realität: 2 (5 Stimmen)".
 */
function barometerCounts(value: string, options: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  const body = value.replace(/\s*\(\d+\s+Stimmen?\)\s*$/, "");
  for (const part of body.split(" · ")) {
    const m = part.match(/^(.*):\s*(\d+)$/);
    if (m && options.includes(m[1].trim())) counts[m[1].trim()] = Number(m[2]);
  }
  if (Object.keys(counts).length === 0 && options.includes(value.trim())) counts[value.trim()] = 1;
  return counts;
}

function BarometerRow({ k, color }: { k: string; color: string }) {
  const { ctx, field, value } = useField(k);
  const onEdit = ctx.editing ? ctx.onEdit : undefined;
  const counts = barometerCounts(value, field.options ?? []);
  return (
    <>
      <div style={{ fontSize: 20, fontWeight: 800, display: "flex", alignItems: "center" }}>{field.label[ctx.lang]}</div>
      {(field.options ?? []).map((o) => {
        const n = counts[o] ?? 0;
        const on = n > 0;
        const cell: CSSProperties = {
          height: 58,
          borderRadius: 8,
          border: `3px solid ${on ? color : RULE}`,
          background: on ? color : "#fff",
          display: "grid",
          placeItems: "center",
          padding: 0,
        };
        const dot = on ? (
          <span data-barometer-dot style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1 }}>
            {n}
          </span>
        ) : null;
        return onEdit ? (
          <button key={o} type="button" title={o} onClick={() => onEdit(field.entryId, on ? "" : o)} style={{ ...cell, cursor: "pointer" }}>
            {dot}
          </button>
        ) : (
          <div key={o} style={cell}>
            {dot}
          </div>
        );
      })}
    </>
  );
}

function Barometer() {
  const { def } = useSheet();
  const scale = posterField(def, "vorher").options ?? [];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "190px repeat(5, minmax(0, 1fr))", gap: "10px 10px", alignItems: "center" }}>
      <span />
      {scale.map((s, i) => (
        <div
          key={s}
          style={{ textAlign: "center", fontSize: 17, fontWeight: 800, color: i < 2 ? GREY : i > 2 ? RED : INK, lineHeight: 1.15 }}
        >
          {s}
        </div>
      ))}
      <BarometerRow k="vorher" color={GREY} />
      <BarometerRow k="nachher" color={RED} />
    </div>
  );
}

function CommitmentLayout() {
  const { lang } = useSheet();
  return (
    <>
      <TextField k="antwort" tone="hero" size={40} bold style={{ flex: 0.7 }} />
      <Panel label={lang === "de" ? "Barometer: Fiktion oder Realität?" : "Barometer: fiction or reality?"} style={{ flex: "0 0 auto" }}>
        <Barometer />
      </Panel>
      <Row flex={1}>
        <ChoicePanel k="naechster-schritt" size={19} style={{ flex: 1.1 }} />
        <TextField k="beschluesse" size={22} />
      </Row>
      <Row flex={0.42}>
        <TextField k="owner" size={21} tone="tint" />
        <TextField k="termin" size={21} tone="tint" />
      </Row>
      <Motto size={22} />
    </>
  );
}

const LAYOUTS: Record<PosterLayout, () => ReactNode> = {
  staircase: StaircaseLayout,
  horizons: HorizonsLayout,
  target: TargetLayout,
  traffic: TrafficLayout,
  canvas: CanvasLayout,
  timeline: TimelineLayout,
  commitment: CommitmentLayout,
};

/* ───────────────────────── Sheet ───────────────────────── */

function SheetHeader() {
  const { def, lang } = useSheet();
  // Keep a trailing ellipsis on the last word's line instead of wrapping it alone.
  const title = def.title[lang].replace(/ …$/, " …");
  const long = `Phase ${def.phase} · ${title}`.length > 30;
  return (
    <header style={{ marginBottom: 26, flex: "0 0 auto" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 20,
          fontSize: 19,
          fontWeight: 800,
          letterSpacing: "0.1em",
          textTransform: "uppercase",
          color: GREY,
        }}
      >
        <span>{WORKSHOP_TITLE[lang]}</span>
        <span style={{ color: RED, whiteSpace: "nowrap" }}>Phase {def.phase} / 7</span>
      </div>
      <h1 style={{ margin: "14px 0 0", fontSize: long ? 54 : 66, lineHeight: 1.05, fontWeight: 900, color: INK, letterSpacing: "-0.01em" }}>
        <span style={{ color: RED }}>Phase {def.phase}</span> · {title}
      </h1>
      <p style={{ margin: "12px 0 0", fontSize: 30, fontWeight: 700, color: INK, lineHeight: 1.2 }}>{def.question[lang]}</p>
      <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 14 }}>
        <div style={{ height: 8, width: 150, background: RED, borderRadius: 4, flexShrink: 0 }} />
        <span style={{ fontSize: 19, color: GREY, fontWeight: 600 }}>
          {lang === "de" ? "Ergebnis: " : "Result: "}
          {def.output[lang]}
        </span>
      </div>
    </header>
  );
}

function SheetFooter({ date }: { date: string }) {
  return (
    <footer
      style={{
        marginTop: 24,
        paddingTop: 16,
        borderTop: `3px solid ${INK}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 24,
        flex: "0 0 auto",
      }}
    >
      <div style={{ fontSize: 17, color: GREY, lineHeight: 1.35 }}>
        <div style={{ fontWeight: 800, color: INK }}>{date}</div>
        <div>Fachverband Betonbohren und -sägen Deutschland e. V.</div>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 28, flexShrink: 0 }}>
        <img src={`${BASE}brand/fbs-logo.png`} alt="FBS" style={{ height: 60, width: "auto" }} />
        <img src={`${BASE}brand/innovationswerkstatt-dark.png`} alt="Innovationswerkstatt" style={{ height: 28, width: "auto" }} />
        <img src={`${BASE}brand/dms-logo-dark.png`} alt="Digital Management School" style={{ height: 58, width: "auto" }} />
        <img src={`${BASE}brand/bik-logo-dark.svg`} alt="BIK GmbH" style={{ height: 52, width: "auto" }} />
      </div>
    </footer>
  );
}

export interface PosterSheetProps {
  def: PosterDef;
  lang: Lang;
  orientation: Orientation;
  /** entry id → text shown on the poster ("" = empty → writing lines). */
  values: Record<string, string>;
  image?: string;
  editing: boolean;
  onEdit?: (entryId: string, value: string) => void;
  date: string;
  zoom: number;
  /** Zoom that maps the sheet onto exactly one printed page. */
  printZoom?: number;
}

export function PosterSheet({ def, lang, orientation, values, image, editing, onEdit, date, zoom, printZoom = 1 }: PosterSheetProps) {
  const [w, h] = SHEET_PX[orientation];
  const portrait = orientation === "portrait";
  const Layout = LAYOUTS[def.layout];
  return (
    <Ctx.Provider value={{ def, lang, values, image, editing, onEdit, portrait }}>
      <div
        className="poster-sheet"
        data-poster={def.key}
        style={
          {
            width: w,
            height: h,
            zoom,
            padding: portrait ? "56px 64px 36px" : "44px 64px 30px",
            display: "flex",
            flexDirection: "column",
            boxSizing: "border-box",
            overflow: "hidden",
            flexShrink: 0,
            "--poster-print-zoom": String(printZoom),
          } as CSSProperties
        }
      >
        <SheetHeader />
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column", gap: 22 }}>
          <Layout />
        </main>
        <SheetFooter date={date} />
      </div>
    </Ctx.Provider>
  );
}
