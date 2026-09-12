import { useEffect, type ComponentType, type ReactNode, type AnchorHTMLAttributes } from "react";
import { MDXProvider } from "@mdx-js/react";
import {
  I18n,
  Lang,
  De,
  En,
  CommandBox,
  DemoBox,
  ExerciseCard,
  NoteCard,
  SkillCard,
  SpeakerNotes,
  YouTubeEmbed,
  WorkshopInput,
  ParticipantsList,
  BarometerVotes,
  ZoomBox,
  CardCollector,
  WorkshopGlossary,
  GlossaryTable,
  PosterPreview,
  AiSuggest,
  WhyLadder,
  Hint, HintIcon,
} from "./slide-blocks";
import { AudioRecorder } from "./AudioRecorder";
import { SlideBackdrop } from "./art/SlideBackdrop";
import { ModuleArt } from "./art/ModuleArt";
import { isPhaseOverview } from "./art/module-art";
import { getSlideComponent, findSlide } from "@/lib/slides";
import { rememberSlide } from "@/lib/last-slide";
import type { Lang as L } from "@/types/slide";
import { pick, t, formatAsOf } from "@/lib/i18n";

interface ChildrenProps {
  children?: ReactNode;
}

const mdxComponents = {
  I18n,
  Lang,
  De,
  En,
  CommandBox,
  DemoBox,
  ExerciseCard,
  NoteCard,
  SkillCard,
  SpeakerNotes,
  YouTubeEmbed,
  WorkshopInput,
  ParticipantsList,
  BarometerVotes,
  ZoomBox,
  CardCollector,
  WorkshopGlossary,
  GlossaryTable,
  PosterPreview,
  AiSuggest,
  WhyLadder,
  AudioRecorder,
  Hint, HintIcon,
  h1:(props: ChildrenProps) => (
    <h1
      className="text-4xl font-semibold leading-tight mb-6"
      style={{ color: "var(--workshop-accent)" }}
      {...props}
    />
  ),
  h2: (props: ChildrenProps) => <h2 className="text-2xl font-semibold mt-8 mb-3" {...props} />,
  h3: (props: ChildrenProps) => <h3 className="text-xl font-semibold mt-6 mb-2" {...props} />,
  p:  (props: ChildrenProps) => <p className="my-3 leading-relaxed" {...props} />,
  ul: (props: ChildrenProps) => <ul className="list-disc pl-6 my-3 space-y-1" {...props} />,
  ol: (props: ChildrenProps) => <ol className="list-decimal pl-6 my-3 space-y-1" {...props} />,
  li: (props: ChildrenProps) => <li className="leading-relaxed" {...props} />,
  blockquote: (props: ChildrenProps) => (
    <blockquote
      className="border-l-4 pl-4 my-4 italic"
      style={{ borderColor: "var(--workshop-accent)", color: "var(--fg-muted)" }}
      {...props}
    />
  ),
  code: (props: ChildrenProps) => (
    <code
      className="px-1.5 py-0.5 rounded text-[0.9em]"
      style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
      {...props}
    />
  ),
  hr: () => (
    <hr className="my-8 border-0 h-px" style={{ background: "var(--border)" }} />
  ),
  a: (props: AnchorHTMLAttributes<HTMLAnchorElement>) => (
    <a
      {...props}
      target={props.href?.startsWith("http") ? "_blank" : undefined}
      rel={props.href?.startsWith("http") ? "noopener noreferrer" : undefined}
    />
  ),
  table: (props: ChildrenProps) => (
    <div className="overflow-x-auto my-4">
      <table className="min-w-full text-sm border-collapse" {...props} />
    </div>
  ),
  th: (props: ChildrenProps) => (
    <th
      className="text-left font-semibold border-b px-3 py-1.5"
      style={{ borderColor: "var(--border)" }}
      {...props}
    />
  ),
  td: (props: ChildrenProps) => (
    <td
      className="border-b px-3 py-1.5"
      style={{ borderColor: "var(--border)" }}
      {...props}
    />
  ),
} as Record<string, ComponentType<unknown>>;

interface Props {
  slideId: string;
  lang: L;
}

export function SlideRenderer({ slideId, lang }: Props) {
  const Component = getSlideComponent(slideId);
  const meta = findSlide(slideId);

  // Full-page views (record, posters, interviews, settings) return to this slide.
  useEffect(() => {
    rememberSlide(slideId);
  }, [slideId]);

  if (!Component || !meta) {
    return (
      <article className="slide-page max-w-4xl mx-auto px-12 py-16">
        <div className="text-xs font-mono mb-2" style={{ color: "var(--fg-muted)" }}>
          {slideId}
        </div>
        <h1 className="text-4xl font-semibold mb-6" style={{ color: "var(--workshop-accent)" }}>
          {meta ? pick(meta.title, lang) : "—"}
        </h1>
        <p style={{ color: "var(--fg-muted)" }}>
          {lang === "de"
            ? "Inhalt für diese Folie ist noch nicht geschrieben."
            : "Content for this slide hasn't been written yet."}
        </p>
      </article>
    );
  }

  const phaseOverview = isPhaseOverview(meta.module, meta.slide);
  const isCover = meta.module === 0 && meta.slide === 1;

  return (
    <div className="slide-canvas">
    <SlideBackdrop module={meta.module} watermark={!phaseOverview && !isCover} />
    <article className="slide-page max-w-4xl mx-auto px-12 py-16">
      <div className="text-xs font-mono mb-3" style={{ color: "var(--fg-muted)" }}>
        {meta.id} · {t("module", lang)} {meta.module === 99 ? "Anh" : meta.module}
        {meta.researchedOn && (
          <span className="ml-3 opacity-70">· {t("researchedOn", lang)}: {formatAsOf(meta.researchedOn, lang)}</span>
        )}
      </div>
      {phaseOverview && <ModuleArt module={meta.module} />}
      <MDXProvider components={mdxComponents}>
        <Component />
      </MDXProvider>
      {meta.sources && meta.sources.length > 0 && (
        <footer
          className="mt-10 pt-4 border-t text-xs no-print"
          style={{ borderColor: "var(--border)", color: "var(--fg-muted)" }}
        >
          <strong>{t("sources", lang)}:</strong>
          <ul className="list-disc pl-5 mt-1 space-y-0.5">
            {meta.sources.map((s) => (
              <li key={s}>
                <a href={s} target="_blank" rel="noopener noreferrer">{s}</a>
              </li>
            ))}
          </ul>
        </footer>
      )}
    </article>
    </div>
  );
}
