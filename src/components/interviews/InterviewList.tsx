import { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Check,
  ChevronRight,
  Download,
  FileAudio,
  FileText,
  Loader2,
  Mic,
  Pencil,
  RotateCcw,
  Sparkles,
  Trash2,
  Upload,
  Wand2,
} from "lucide-react";
import type { Lang } from "@/types/slide";
import { useApiKey } from "@/lib/ai-assist";
import { deleteInterview, getInterview, updateInterview, type Interview } from "@/lib/interview-store";
import {
  INTERVIEW_QUESTIONS,
  deriveScales,
  isInProtocol,
  removeInterviewFromProtocol,
  summarizeInterview,
  writeInterviewToProtocol,
} from "@/lib/interview-opinion";
import { EMPTY_SCALES, SCALES, hasScaleValues, type InterviewScales, type ScaleId } from "@/lib/interview-metrics";
import { autoSaveTranscript } from "@/lib/auto-export";
import { TranscribeError, extensionForMime, fileExtension, isAcceptedAudioName, transcribeAudio, useOpenAiKey } from "@/lib/transcribe";
import { bilingualError, describeProcessingError, isFatal } from "./errors";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  BTN,
  BTN_SM,
  ERROR_COLOR,
  MiniMarkdown,
  Notice,
  WARN_COLOR,
  accentOutline,
  card,
  danger,
  downloadBlob,
  field,
  formatBytes,
  formatDate,
  formatDuration,
  muted,
  outline,
  primary,
  safeFileName,
} from "./ui";

type BusyStage = "transcribe" | "summarize";

const needsWork = (iv: Interview) =>
  (!iv.transcript && Boolean(iv.audio)) || (Boolean(iv.transcript) && !iv.opinion) || (Boolean(iv.opinion) && !isInProtocol(iv));

async function recordError(id: string, stage: BusyStage, err: unknown) {
  try {
    await updateInterview(id, { error: { stage, message: bilingualError(err, stage) } });
  } catch (storeErr) {
    console.error("[interviews] could not store the processing error", { id, stage, storeErr });
  }
}

async function transcribeOne(iv: Interview): Promise<Interview> {
  if (!iv.audio) throw new TranscribeError("no-audio");
  const ext = isAcceptedAudioName(iv.fileName) ? fileExtension(iv.fileName) : extensionForMime(iv.mimeType);
  const result = await transcribeAudio(iv.audio, ext, `interview ${iv.id}`);
  const patch = { transcript: result.text, transcriptModel: result.model, error: undefined };
  const next = (await updateInterview(iv.id, patch)) ?? { ...iv, ...patch };
  // Fire and forget: a failed file save is reported on its own and must not fail the transcription.
  void autoSaveTranscript(next);
  return next;
}

async function summarizeOne(iv: Interview): Promise<Interview> {
  const { text, scales } = await summarizeInterview(iv.transcript ?? "", `interview ${iv.id}`);
  // No usable JSON block: keep the text, mark the card as "ohne Skalenwerte".
  const patch = { opinion: text, opinionAt: new Date().toISOString(), scales: scales ?? undefined, error: undefined };
  // Written straight into the protocol (slide 01.02) so it shows up in /protokoll, PDF/Word and posters.
  const synced = writeInterviewToProtocol({ ...iv, ...patch });
  return (await updateInterview(iv.id, { ...patch, ...synced })) ?? { ...iv, ...patch, ...synced };
}

async function syncOne(iv: Interview) {
  await updateInterview(iv.id, writeInterviewToProtocol(iv));
}

export function InterviewList({ interviews, lang }: { interviews: Interview[]; lang: Lang }) {
  const de = lang === "de";
  const openAiKey = useOpenAiKey();
  const claudeKey = useApiKey();
  const [busy, setBusy] = useState<Record<string, BusyStage>>({});
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");

  const mark = (id: string, stage: BusyStage | null) =>
    setBusy((b) => {
      const next = { ...b };
      if (stage) next[id] = stage;
      else delete next[id];
      return next;
    });

  async function run(iv: Interview, stage: BusyStage): Promise<Interview> {
    mark(iv.id, stage);
    try {
      return stage === "transcribe" ? await transcribeOne(iv) : await summarizeOne(iv);
    } catch (err) {
      await recordError(iv.id, stage, err);
      throw err;
    } finally {
      mark(iv.id, null);
    }
  }

  function runSingle(iv: Interview, stage: BusyStage) {
    setNotice("");
    setError("");
    run(iv, stage)
      .then(() => {
        if (stage === "summarize") {
          setNotice(
            de
              ? `Meinungsbild „${iv.pseudonym}“ erstellt und automatisch ins Protokoll übernommen (Folie 01.02).`
              : `Opinion picture “${iv.pseudonym}” created and automatically added to the record (slide 01.02).`,
          );
        }
      })
      // The error is stored on the interview and shown on its card.
      .catch(() => undefined);
  }

  async function processAll() {
    setNotice("");
    setError("");
    const queue = interviews.filter(needsWork);
    if (!queue.length) return;
    if (queue.some((iv) => !iv.transcript) && !openAiKey) {
      setError(de ? "Zum Transkribieren fehlt der OpenAI-Schlüssel (siehe Einrichtung oben)." : "The OpenAI key for transcription is missing (see setup above).");
      return;
    }
    if (queue.some((iv) => !iv.opinion) && !claudeKey) {
      setError(de ? "Für die Meinungsbilder fehlt der Claude-Schlüssel (siehe Einrichtung oben)." : "The Claude key for opinion pictures is missing (see setup above).");
      return;
    }
    setProgress({ done: 0, total: queue.length });
    let failed = 0;
    for (let i = 0; i < queue.length; i++) {
      let iv = getInterview(queue[i].id) ?? queue[i];
      try {
        if (!iv.transcript && iv.audio) iv = await run(iv, "transcribe");
        if (iv.transcript && !iv.opinion) await run(iv, "summarize");
        else if (iv.opinion && !isInProtocol(iv)) await syncOne(iv);
      } catch (err) {
        failed++;
        if (isFatal(err)) {
          setError(describeProcessingError(err, iv.transcript ? "summarize" : "transcribe", lang));
          break;
        }
      }
      setProgress({ done: i + 1, total: queue.length });
    }
    setProgress(null);
    const ok = queue.length - failed;
    setNotice(
      de
        ? `${ok} von ${queue.length} verarbeitet. Die Meinungsbilder stehen im Protokoll (Folie 01.02).${failed ? " Fehlgeschlagene Interviews sind markiert." : ""}`
        : `${ok} of ${queue.length} processed. The opinion pictures are in the record (slide 01.02).${failed ? " Failed interviews are marked." : ""}`,
    );
  }

  const pending = interviews.filter(needsWork).length;
  const anyBusy = progress !== null || Object.keys(busy).length > 0;

  if (!interviews.length) {
    return (
      <div className="text-center py-10 rounded-md text-sm" style={{ ...card, borderStyle: "dashed", ...muted }}>
        <FileText size={28} className="mx-auto mb-2 opacity-50" />
        {de
          ? "Noch keine Interviews. Führe ein Interview, lade Audiodateien hoch oder importiere die Datei vom zweiten Rechner."
          : "No interviews yet. Conduct an interview, upload audio files or import the file from the second computer."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <Tooltip
          content={
            de
              ? "Alle offenen Interviews nacheinander transkribieren (OpenAI), je ein Meinungsbild erstellen (Claude) und ins Protokoll auf Folie 01.02 übernehmen"
              : "Transcribe all open interviews one after another (OpenAI), create an opinion picture each (Claude) and add them to the record on slide 01.02"
          }
        >
        <button type="button" onClick={processAll} disabled={anyBusy || pending === 0} className={BTN} style={primary}>
          {progress ? <Loader2 size={16} className="animate-spin" /> : <Wand2 size={16} />}
          {progress
            ? de
              ? `Verarbeite ${Math.min(progress.done + 1, progress.total)} von ${progress.total} …`
              : `Processing ${Math.min(progress.done + 1, progress.total)} of ${progress.total} …`
            : pending
              ? de
                ? `Alle verarbeiten (${pending} offen)`
                : `Process all (${pending} open)`
              : de
                ? "Alles verarbeitet"
                : "All processed"}
        </button>
        </Tooltip>
        <span className="text-xs" style={muted}>
          {de ? "Transkribieren → Meinungsbild → Protokoll, nacheinander" : "Transcribe → opinion picture → record, one by one"}
        </span>
      </div>
      {progress && (
        <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--border)" }} aria-hidden>
          <div
            className="h-full transition-[width] duration-300"
            style={{ width: `${(progress.done / progress.total) * 100}%`, background: "var(--workshop-accent)" }}
          />
        </div>
      )}
      {(!openAiKey || !claudeKey) && (
        <Notice tone="warn">
          {de
            ? `Hinweis: ${[!openAiKey && "OpenAI-Schlüssel (Transkription)", !claudeKey && "Claude-Schlüssel (Meinungsbilder)"].filter(Boolean).join(" und ")} fehlt – siehe Einrichtung oben.`
            : `Note: ${[!openAiKey && "OpenAI key (transcription)", !claudeKey && "Claude key (opinion pictures)"].filter(Boolean).join(" and ")} missing – see setup above.`}
        </Notice>
      )}
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      <ul className="space-y-3">
        {interviews.map((iv) => (
          <li key={iv.id}>
            <InterviewCard
              iv={iv}
              lang={lang}
              busy={busy[iv.id]}
              locked={progress !== null}
              onRun={(stage) => runSingle(iv, stage)}
              onSync={() => {
                syncOne(iv).catch((err: unknown) => {
                  console.error("[interviews] writing to the protocol failed", { id: iv.id, err });
                  setError(de ? "Das Protokoll konnte nicht aktualisiert werden." : "The record could not be updated.");
                });
              }}
            />
          </li>
        ))}
      </ul>
    </div>
  );
}

function StepChip({ label, done, busy }: { label: string; done: boolean; busy?: boolean }) {
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium whitespace-nowrap"
      style={
        done
          ? { background: "color-mix(in oklch, var(--workshop-accent) 14%, transparent)", color: "var(--workshop-accent)" }
          : { border: "1px solid var(--border)", color: "var(--fg-muted)" }
      }
    >
      {busy ? <Loader2 size={11} className="animate-spin" /> : done ? <Check size={11} /> : null}
      {label}
    </span>
  );
}

function InterviewCard({
  iv,
  lang,
  busy,
  locked,
  onRun,
  onSync,
}: {
  iv: Interview;
  lang: Lang;
  busy?: BusyStage;
  locked: boolean;
  onRun: (stage: BusyStage) => void;
  onSync: () => void;
}) {
  const de = lang === "de";
  const [name, setName] = useState(iv.pseudonym);
  const [transcriptDraft, setTranscriptDraft] = useState<string | null>(null);
  const [opinionDraft, setOpinionDraft] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [saveError, setSaveError] = useState("");
  const audioRef = useRef<HTMLAudioElement>(null);
  const audioBlobRef = useRef(iv.audio);
  audioBlobRef.current = iv.audio;
  const hasAudio = Boolean(iv.audio);
  const inProtocol = isInProtocol(iv);
  const disabled = Boolean(busy) || locked;

  useEffect(() => setName(iv.pseudonym), [iv.pseudonym]);
  useEffect(() => setOpinionDraft(null), [iv.opinionAt]);
  useEffect(() => setTranscriptDraft(null), [iv.transcriptModel]);

  // Keyed on id/presence, not the Blob object: every store reload yields new Blob
  // handles, and recreating the URL would reset a playing audio element.
  useEffect(() => {
    const blob = audioBlobRef.current;
    if (!hasAudio || !blob) {
      setAudioUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    setAudioUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [iv.id, hasAudio]);

  async function save(patch: Partial<Interview>, alsoProtocol: boolean) {
    setSaveError("");
    try {
      const next = await updateInterview(iv.id, patch);
      if (alsoProtocol && next?.opinion) await updateInterview(iv.id, writeInterviewToProtocol(next));
      return true;
    } catch (err) {
      console.error("[interviews] saving an edit failed", { id: iv.id, fields: Object.keys(patch), err });
      setSaveError(de ? "Die Änderung konnte nicht gespeichert werden." : "The change could not be saved.");
      return false;
    }
  }

  function commitName() {
    const next = name.trim() || iv.pseudonym;
    setName(next);
    // A renamed, already synced interview keeps its protocol entry in step.
    if (next !== iv.pseudonym) void save({ pseudonym: next }, inProtocol);
  }

  function confirmRerun(stage: BusyStage) {
    const existing = stage === "transcribe" ? iv.transcript : iv.opinion;
    if (
      existing &&
      !window.confirm(
        stage === "transcribe"
          ? de
            ? "Das bestehende Transkript (inkl. eigener Korrekturen) wird ersetzt. Fortfahren?"
            : "The existing transcript (incl. your corrections) will be replaced. Continue?"
          : de
            ? "Das bestehende Meinungsbild (inkl. eigener Änderungen) wird ersetzt und ins Protokoll übernommen. Fortfahren?"
            : "The existing opinion picture (incl. your edits) will be replaced and written to the record. Continue?",
      )
    ) {
      return;
    }
    onRun(stage);
  }

  function remove() {
    if (
      !window.confirm(
        de
          ? `Interview „${iv.pseudonym}“ mit Audio, Transkript und Meinungsbild löschen? Der Eintrag im Protokoll wird ebenfalls entfernt.`
          : `Delete interview “${iv.pseudonym}” with audio, transcript and opinion picture? Its record entry is removed as well.`,
      )
    ) {
      return;
    }
    removeInterviewFromProtocol(iv.id);
    deleteInterview(iv.id).catch((err: unknown) => {
      console.error("[interviews] delete failed", { id: iv.id, err });
      setSaveError(de ? "Das Interview konnte nicht gelöscht werden." : "The interview could not be deleted.");
    });
  }

  function seek(sec: number) {
    const el = audioRef.current;
    if (!el) return;
    el.currentTime = sec;
    el.play().catch((err: unknown) => console.error("[interviews] playback failed", err));
  }

  const ext = isAcceptedAudioName(iv.fileName) ? fileExtension(iv.fileName) : extensionForMime(iv.mimeType);

  return (
    <article className="rounded-md p-3 sm:p-4 space-y-3" style={card} data-testid="interview-card">
      <div className="flex flex-wrap items-start gap-2">
        <span className="size-8 grid place-items-center rounded-full shrink-0" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          {iv.source === "recorded" ? <Mic size={15} /> : <FileAudio size={15} />}
        </span>
        <div className="min-w-0 flex-1 basis-48">
          <input
            type="text"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={commitName}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.currentTarget.blur();
            }}
            aria-label={de ? "Pseudonym" : "Pseudonym"}
            className="w-full bg-transparent font-semibold text-base rounded px-1 -mx-1 focus:outline-none focus:ring-1 focus:ring-[var(--workshop-accent)]"
          />
          <div className="text-[11px] flex flex-wrap gap-x-2" style={muted}>
            <span>{formatDate(iv.createdAt, lang)}</span>
            <span>· {formatDuration(iv.durationSec)} min</span>
            {iv.size > 0 && <span>· {formatBytes(iv.size, lang)}</span>}
            {!hasAudio && <span>· {de ? "ohne Audio" : "no audio"}</span>}
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1 basis-full sm:basis-auto">
          <StepChip label={iv.source === "recorded" ? (de ? "Aufgenommen" : "Recorded") : de ? "Hochgeladen" : "Uploaded"} done />
          <ChevronRight size={12} style={muted} />
          <StepChip label={de ? "Transkribiert" : "Transcribed"} done={Boolean(iv.transcript)} busy={busy === "transcribe"} />
          <ChevronRight size={12} style={muted} />
          <StepChip label={de ? "Zusammengefasst" : "Summarised"} done={Boolean(iv.opinion)} busy={busy === "summarize"} />
          <ChevronRight size={12} style={muted} />
          <StepChip label={de ? "Im Protokoll" : "In record"} done={inProtocol} />
        </div>
      </div>

      {iv.error && !busy && (
        <div className="flex flex-wrap items-center gap-2 text-xs rounded-md px-2.5 py-2" style={{ color: ERROR_COLOR, background: "color-mix(in oklch, #dc2626 8%, transparent)" }} role="alert">
          <AlertTriangle size={14} className="shrink-0" />
          <span className="flex-1 min-w-0">{iv.error.message[lang]}</span>
          <button type="button" onClick={() => onRun(iv.error?.stage ?? "transcribe")} disabled={disabled} className={BTN_SM} style={danger}>
            <RotateCcw size={12} /> {de ? "Erneut versuchen" : "Retry"}
          </button>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        <Tooltip
          content={
            !hasAudio
              ? de ? "Kein Audio gespeichert" : "No audio stored"
              : de
                ? "Aufnahme in Text umwandeln. Dafür wird das Audio an die OpenAI-API übertragen."
                : "Turn the recording into text. The audio is sent to the OpenAI API for this."
          }
        >
          <button
            type="button"
            onClick={() => confirmRerun("transcribe")}
            disabled={disabled || !hasAudio}
            className={BTN_SM}
            style={iv.transcript ? outline : primary}
          >
            {busy === "transcribe" ? <Loader2 size={12} className="animate-spin" /> : <FileText size={12} />}
            {iv.transcript ? (de ? "Neu transkribieren" : "Re-transcribe") : de ? "Transkribieren" : "Transcribe"}
          </button>
        </Tooltip>
        <Tooltip
          content={
            de
              ? "Claude fasst das Transkript entlang der Leitfragen zu einem kurzen Meinungsbild dieser Person zusammen"
              : "Claude condenses the transcript along the guide questions into a short opinion picture of this person"
          }
        >
          <button
            type="button"
            onClick={() => confirmRerun("summarize")}
            disabled={disabled || !iv.transcript?.trim()}
            className={BTN_SM}
            style={iv.transcript && !iv.opinion ? primary : outline}
          >
            {busy === "summarize" ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {iv.opinion ? (de ? "Meinungsbild neu erzeugen" : "Regenerate opinion") : de ? "Meinungsbild erstellen" : "Create opinion picture"}
          </button>
        </Tooltip>
        {iv.opinion && !inProtocol && (
          <Tooltip content={de ? "Meinungsbild ins Protokoll auf Folie 01.02 schreiben" : "Write the opinion picture into the record on slide 01.02"}>
            <button type="button" onClick={onSync} disabled={disabled} className={BTN_SM} style={accentOutline}>
              <Upload size={12} /> {de ? "Ins Protokoll übernehmen" : "Add to record"}
            </button>
          </Tooltip>
        )}
        {iv.audio && (
          <button
            type="button"
            onClick={() => iv.audio && downloadBlob(iv.audio, `${safeFileName(iv.pseudonym)}-${iv.id}.${ext}`)}
            className={BTN_SM}
            style={outline}
          >
            <Download size={12} /> {de ? "Audio herunterladen" : "Download audio"}
          </button>
        )}
        <button type="button" onClick={remove} disabled={disabled} className={`${BTN_SM} ml-auto`} style={danger}>
          <Trash2 size={12} /> {de ? "Löschen" : "Delete"}
        </button>
      </div>

      {audioUrl && (
        <div className="space-y-1.5">
          <audio ref={audioRef} controls preload="metadata" src={audioUrl} className="w-full h-9" />
          {iv.markers.length > 0 && (
            <div className="flex flex-wrap gap-1" aria-label={de ? "Zeitmarken je Frage" : "Time marks per question"}>
              {iv.markers.map((m, i) => (
                <Tooltip
                  key={i}
                  content={`${de ? "Zur Stelle springen" : "Jump to this point"}: ${INTERVIEW_QUESTIONS[m.question]?.[lang] ?? ""}`}
                >
                  <button
                    type="button"
                    onClick={() => seek(m.atSec)}
                    className="px-1.5 py-0.5 rounded text-[11px] font-mono"
                    style={outline}
                  >
                    F{m.question + 1} · {formatDuration(m.atSec)}
                  </button>
                </Tooltip>
              ))}
            </div>
          )}
        </div>
      )}

      {iv.transcript !== undefined && (
        <details className="rounded-md" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            {de ? "Transkript" : "Transcript"}
            <span className="text-[11px] font-normal ml-2" style={muted}>
              {iv.transcript.split(/\s+/).filter(Boolean).length} {de ? "Wörter" : "words"}
              {iv.transcriptModel ? ` · ${iv.transcriptModel}` : ""}
            </span>
          </summary>
          <div className="px-3 pb-3 space-y-2">
            <textarea
              value={transcriptDraft ?? iv.transcript}
              onChange={(e) => setTranscriptDraft(e.target.value)}
              rows={8}
              className="w-full rounded-md p-2 text-sm leading-relaxed resize-y"
              style={field}
              aria-label={de ? "Transkript bearbeiten" : "Edit transcript"}
            />
            {transcriptDraft !== null && transcriptDraft !== iv.transcript && (
              <div className="flex gap-1.5 justify-end">
                <button type="button" onClick={() => setTranscriptDraft(null)} className={BTN_SM} style={outline}>
                  {de ? "Verwerfen" : "Discard"}
                </button>
                <button
                  type="button"
                  onClick={() => void save({ transcript: transcriptDraft }, false).then((ok) => ok && setTranscriptDraft(null))}
                  className={BTN_SM}
                  style={primary}
                >
                  {de ? "Transkript speichern" : "Save transcript"}
                </button>
              </div>
            )}
          </div>
        </details>
      )}

      {iv.opinion !== undefined && <ScalePanel iv={iv} lang={lang} disabled={disabled} />}

      {iv.opinion !== undefined && (
        <details className="rounded-md" style={{ background: "var(--bg)", border: "1px solid var(--border)" }} data-testid="opinion-details">
          <summary className="cursor-pointer px-3 py-2 text-sm font-medium">
            {de ? "Meinungsbild" : "Opinion picture"}
            {iv.opinionAt && (
              <span className="text-[11px] font-normal ml-2" style={muted}>
                {formatDate(iv.opinionAt, lang)}
              </span>
            )}
          </summary>
          <div className="px-3 pb-3 space-y-2">
            {opinionDraft === null ? (
              <>
                <MiniMarkdown text={iv.opinion} />
                <button type="button" onClick={() => setOpinionDraft(iv.opinion ?? "")} className={BTN_SM} style={outline}>
                  <Pencil size={12} /> {de ? "Bearbeiten" : "Edit"}
                </button>
              </>
            ) : (
              <>
                <textarea
                  value={opinionDraft}
                  onChange={(e) => setOpinionDraft(e.target.value)}
                  rows={14}
                  autoFocus
                  className="w-full rounded-md p-2 text-sm leading-relaxed resize-y font-mono"
                  style={field}
                  aria-label={de ? "Meinungsbild bearbeiten" : "Edit opinion picture"}
                />
                <div className="flex flex-wrap gap-1.5 justify-end">
                  <button type="button" onClick={() => setOpinionDraft(null)} className={BTN_SM} style={outline}>
                    {de ? "Abbrechen" : "Cancel"}
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      void save({ opinion: opinionDraft, opinionAt: new Date().toISOString() }, inProtocol).then(
                        (ok) => ok && setOpinionDraft(null),
                      )
                    }
                    disabled={!opinionDraft.trim()}
                    className={BTN_SM}
                    style={primary}
                  >
                    {inProtocol ? (de ? "Speichern & Protokoll aktualisieren" : "Save & update record") : de ? "Speichern" : "Save"}
                  </button>
                </div>
              </>
            )}
          </div>
        </details>
      )}

      {saveError && <Notice tone="error">{saveError}</Notice>}
    </article>
  );
}

/**
 * The four 1–4 scales Claude derived with the opinion picture. The facilitator
 * can overrule every value; the group figures recompute immediately.
 */
function ScalePanel({ iv, lang, disabled }: { iv: Interview; lang: Lang; disabled: boolean }) {
  const de = lang === "de";
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const scales = iv.scales;
  const hasValues = hasScaleValues(scales);
  const terms = [...(scales?.begriffe ?? []), ...(scales?.einsatzgebiete ?? [])];

  function setValue(id: ScaleId, raw: string) {
    setError("");
    const next: InterviewScales = { ...EMPTY_SCALES, ...scales, [id]: raw ? Number(raw) : null };
    updateInterview(iv.id, { scales: next }).catch((err: unknown) => {
      console.error("[interviews] saving a scale value failed", { id: iv.id, scale: id, err });
      setError(de ? "Der Wert konnte nicht gespeichert werden." : "The value could not be saved.");
    });
  }

  async function derive() {
    const transcript = iv.transcript?.trim();
    if (!transcript || busy) return;
    setBusy(true);
    setError("");
    try {
      const next = await deriveScales(transcript, `interview ${iv.id} scales`);
      if (!next) {
        setError(
          de
            ? "Die KI hat keine verwertbaren Skalenwerte geliefert. Bitte von Hand eintragen."
            : "The AI returned no usable scale values. Please set them by hand.",
        );
        return;
      }
      await updateInterview(iv.id, { scales: next });
    } catch (err) {
      setError(describeProcessingError(err, "summarize", lang));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-md p-3 space-y-2" style={{ background: "var(--bg)", border: "1px solid var(--border)" }} data-testid="interview-scales">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{de ? "Skalenwerte" : "Scale values"}</span>
        {!hasValues && (
          <span className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ border: `1px solid ${WARN_COLOR}`, color: WARN_COLOR }}>
            {de ? "ohne Skalenwerte" : "no scale values"}
          </span>
        )}
        <span className="text-[11px] ml-auto" style={muted}>
          {de ? "korrigierbar – die Gruppenauswertung rechnet sofort neu" : "correctable – the group figures recompute at once"}
        </span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {SCALES.map((def) => (
          <label key={def.id} className="block text-[11px] space-y-1">
            <span className="block truncate" style={muted}>
              {def.label[lang]}
            </span>
            <select
              value={scales?.[def.id] ?? ""}
              onChange={(e) => setValue(def.id, e.target.value)}
              disabled={disabled || busy}
              className="w-full rounded-md p-1.5 text-xs"
              style={field}
              aria-label={`${def.label[lang]} · ${iv.pseudonym}`}
              data-testid={`scale-${def.id}`}
            >
              <option value="">{de ? "keine Angabe" : "not stated"}</option>
              {def.levels.map((level, i) => (
                <option key={level.de} value={i + 1}>
                  {i + 1} · {level[lang]}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>

      {terms.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {scales?.begriffe.map((term) => (
            <span
              key={`b-${term}`}
              className="text-[11px] px-1.5 py-0.5 rounded-full"
              style={{ background: "color-mix(in oklch, var(--workshop-accent) 12%, transparent)", color: "var(--workshop-accent)" }}
            >
              {term}
            </span>
          ))}
          {scales?.einsatzgebiete.map((term) => (
            <span key={`e-${term}`} className="text-[11px] px-1.5 py-0.5 rounded-full" style={{ border: "1px solid var(--border)", color: "var(--fg-muted)" }}>
              {term}
            </span>
          ))}
        </div>
      )}

      {!hasValues && iv.transcript?.trim() && (
        <Tooltip
          content={
            de
              ? "Claude liest nur die vier Skalenwerte samt Begriffen neu aus dem Transkript; das Meinungsbild bleibt unverändert"
              : "Claude re-reads only the four scale values and terms from the transcript; the opinion picture stays as it is"
          }
        >
          <button type="button" onClick={() => void derive()} disabled={disabled || busy} className={BTN_SM} style={accentOutline}>
            {busy ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            {de ? "Skalenwerte nachtragen" : "Derive scale values"}
          </button>
        </Tooltip>
      )}

      {error && <Notice tone="error">{error}</Notice>}
    </div>
  );
}
