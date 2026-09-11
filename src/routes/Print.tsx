import { ALL_SLIDES, getSlideComponent } from "@/lib/slides";
import { pick, useLang, t, formatAsOf } from "@/lib/i18n";
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
  CardCollector,
  WorkshopGlossary,
  PrintHint, PrintHintIcon,
} from "@/components/slide-blocks";
import { AudioRecorder } from "@/components/AudioRecorder";
import { ModuleArt } from "@/components/art/ModuleArt";
import { isPhaseOverview } from "@/components/art/module-art";
import type { ComponentProps, ComponentType } from "react";

// Print shows the participant list as a plain table, never as input fields.
const PrintParticipantsList = () => <ParticipantsList readOnly />;
const PrintBarometerVotes = (props: ComponentProps<typeof BarometerVotes>) => <BarometerVotes {...props} readOnly />;

const printMdxComponents = {
  I18n, Lang, De, En, CommandBox, DemoBox, ExerciseCard, NoteCard, SkillCard, SpeakerNotes, YouTubeEmbed,
  Hint: PrintHint, HintIcon: PrintHintIcon,
  WorkshopInput, AudioRecorder, ParticipantsList: PrintParticipantsList, BarometerVotes: PrintBarometerVotes,
  CardCollector: (props: ComponentProps<typeof CardCollector>) => <CardCollector {...props} readOnly />,
  WorkshopGlossary: () => <WorkshopGlossary readOnly />,
} as Record<string, ComponentType<unknown>>;

/** Linear print view — all slides, no chrome, used by browser print + Playwright PDF export. */
export function Print() {
  const [lang] = useLang();
  return (
    <div className="bg-white text-black">
      {ALL_SLIDES.map((s) => {
        const Component = getSlideComponent(s.id);
        return (
          <article
            key={s.id}
            className="slide-page max-w-4xl mx-auto px-10 py-12 print:py-0"
          >
            <div className="text-xs font-mono mb-1 text-gray-500">
              {s.id} · {t("module", lang)} {s.module === 99 ? "Anh" : s.module}
              {s.researchedOn && ` · ${t("researchedOn", lang)}: ${formatAsOf(s.researchedOn, lang)}`}
            </div>
            {isPhaseOverview(s.module, s.slide) && <ModuleArt module={s.module} />}
            {Component ? (
              <MDXProvider components={printMdxComponents}>
                <Component />
              </MDXProvider>
            ) : (
              <>
                <h1
                  className="text-3xl font-semibold mb-4"
                  style={{ color: "var(--bik-blue)" }}
                >
                  {pick(s.title, lang)}
                </h1>
                <p className="text-gray-600 italic">
                  {lang === "de" ? "(Inhalt folgt)" : "(content TBD)"}
                </p>
              </>
            )}
            {s.sources && s.sources.length > 0 && (
              <footer className="mt-8 pt-2 border-t text-xs text-gray-600">
                <strong>{t("sources", lang)}:</strong>
                <ul className="list-disc pl-5 mt-1 space-y-0.5">
                  {s.sources.map((src) => (
                    <li key={src}>{src}</li>
                  ))}
                </ul>
              </footer>
            )}
          </article>
        );
      })}
    </div>
  );
}

