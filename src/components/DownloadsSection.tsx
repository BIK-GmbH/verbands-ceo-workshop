import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { Download, FileAudio, FileText, FolderOpen, Loader2, Trash2 } from "lucide-react";
import type { Lang } from "@/types/slide";
import {
  AUDIO_FOLDER,
  TRANSCRIPT_FOLDER,
  allTranscriptsFileName,
  allTranscriptsMarkdown,
  downloadAllTranscripts,
  downloadSessionTranscript,
  downloadTranscript,
  formatHours,
  interviewAudioFileName,
  markdownBlob,
  recordingsZipFileName,
  saveFile,
  sessionDurationSec,
  sessionFileName,
  sessionRemoved,
  sessionTranscriptFileName,
  sessionTranscriptMarkdown,
  setAutoExportEnabled,
  transcriptFileName,
  transcriptMarkdown,
  useAutoExportEnabled,
  useAutoExportStatus,
} from "@/lib/auto-export";
import { transcriptProgress, useSessionTranscripts } from "@/lib/session-transcript-store";
import { removedLabel } from "@/lib/transcript-filter";
import { ZipTooLargeError, createZip, type ZipEntry } from "@/lib/zip";
import { useAutoBackup } from "@/lib/auto-backup";
import { useInterviews, type Interview } from "@/lib/interview-store";
import { RECORDING_STORE_EVENT, assembleSession, listSessions, type RecordingSession } from "@/lib/recording-store";
import { deleteStoredRecording, runningSessionId, useSessionRecorder } from "@/lib/session-recorder";
import { BTN, BTN_SM, ERROR_COLOR, Notice, card, danger, downloadBlob, formatBytes, formatDate, formatDuration, muted, outline } from "@/components/interviews/ui";

type AudioItem =
  | { kind: "interview"; key: string; iv: Interview; blob: Blob }
  | { kind: "session"; key: string; session: RecordingSession; running: boolean };

/** Stored session runs, kept in step with the recorder and the recording database. */
function useStoredSessions(): { sessions: RecordingSession[]; failed: boolean } {
  const recorder = useSessionRecorder();
  const [sessions, setSessions] = useState<RecordingSession[]>([]);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => {
    listSessions()
      .then((list) => {
        setSessions(list);
        setFailed(false);
      })
      .catch((err: unknown) => {
        console.error("[downloads] reading the session recordings failed", err);
        setFailed(true);
      });
  }, []);
  useEffect(() => {
    load();
    window.addEventListener(RECORDING_STORE_EVENT, load);
    return () => window.removeEventListener(RECORDING_STORE_EVENT, load);
  }, [load]);
  // Recording started or stopped: the counters of the run changed.
  useEffect(load, [load, recorder.recording, recorder.url]);
  return { sessions, failed };
}

/**
 * Every transcript and every recording on this device, one by one or all at
 * once, plus the switch that saves new ones automatically. Files are readable
 * without the app: transcripts as Markdown, recordings in their own format.
 */
export function DownloadsSection({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const { interviews } = useInterviews();
  const { sessions, failed } = useStoredSessions();
  const { sessions: sessionTranscripts } = useSessionTranscripts();
  const autoOn = useAutoExportEnabled();
  const { last } = useAutoExportStatus();
  const backup = useAutoBackup();
  const folder = backup.folder;
  const folderReady = Boolean(folder && (folder.permission === "granted" || folder.permission === "unknown"));

  const [busy, setBusy] = useState<string | null>(null);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  // The link on the interviews page lands here.
  const location = useLocation();
  const sectionRef = useRef<HTMLElement>(null);
  const focused = (location.state as { focus?: string } | null)?.focus === "downloads";
  useEffect(() => {
    if (focused) sectionRef.current?.scrollIntoView({ block: "start" });
  }, [focused]);

  const running = runningSessionId();
  const transcripts = interviews.filter((iv) => iv.transcript?.trim());
  const sessionDocs = sessionTranscripts.filter((t) => t.segments.length > 0);
  const transcriptCount = transcripts.length + sessionDocs.length;
  const audio: AudioItem[] = [
    ...interviews.flatMap((iv): AudioItem[] => (iv.audio ? [{ kind: "interview", key: `iv:${iv.id}`, iv, blob: iv.audio }] : [])),
    ...sessions.map((s): AudioItem => ({ kind: "session", key: `rec:${s.id}`, session: s, running: s.id === running })),
  ];
  const downloadableAudio = audio.filter((a) => !(a.kind === "session" && (a.running || a.session.chunkCount === 0)));

  const notify = (ok: string) => {
    setError("");
    setDone(ok);
  };
  const fail = (message: string, context: Record<string, unknown>, err: unknown) => {
    console.error("[downloads] saving failed", { ...context, err });
    setDone("");
    setError(message);
  };

  async function audioFile(item: AudioItem): Promise<{ name: string; blob: Blob } | null> {
    if (item.kind === "interview") return { name: interviewAudioFileName(item.iv), blob: item.blob };
    const assembled = await assembleSession(item.session.id);
    return assembled ? { name: sessionFileName(assembled.session), blob: assembled.blob } : null;
  }

  function setAuto(on: boolean) {
    try {
      setAutoExportEnabled(on);
    } catch (err) {
      fail(de ? "Die Einstellung ließ sich nicht speichern (Browser-Speicher blockiert?)." : "The setting could not be stored (browser storage blocked?).", { on }, err);
    }
  }

  async function downloadOneAudio(item: AudioItem) {
    setBusy(item.key);
    try {
      const file = await audioFile(item);
      if (!file) {
        setError(de ? "Diese Aufnahme enthält keine abspielbaren Daten." : "This recording contains no playable data.");
        return;
      }
      downloadBlob(file.blob, file.name);
      notify(de ? `Heruntergeladen: ${file.name}` : `Downloaded: ${file.name}`);
    } catch (err) {
      fail(de ? "Die Aufnahme konnte nicht zusammengesetzt werden." : "The recording could not be assembled.", { item: item.key }, err);
    } finally {
      setBusy(null);
    }
  }

  /** All recordings as one zip: assembling the session recordings and the checksums take a moment, hence the progress. */
  async function downloadAllAudioZip() {
    const items = downloadableAudio;
    if (!items.length) return;
    setBusy("audio-all:download");
    setProgress({ done: 0, total: items.length });
    try {
      const entries: ZipEntry[] = [];
      for (const [i, item] of items.entries()) {
        const file = await audioFile(item);
        if (file) {
          const date = new Date(item.kind === "interview" ? item.iv.createdAt : item.session.startedAt);
          entries.push({ name: file.name, data: file.blob, date });
        }
        setProgress({ done: i + 1, total: items.length });
      }
      const name = recordingsZipFileName();
      downloadBlob(await createZip(entries), name);
      notify(
        de
          ? `Heruntergeladen: ${name} (${entries.length} ${entries.length === 1 ? "Aufnahme" : "Aufnahmen"}).`
          : `Downloaded: ${name} (${entries.length} ${entries.length === 1 ? "recording" : "recordings"}).`,
      );
    } catch (err) {
      fail(
        err instanceof ZipTooLargeError
          ? de
            ? "Zusammen sind die Aufnahmen größer als 4 GB – bitte einzeln herunterladen."
            : "Together the recordings exceed 4 GB – please download them one by one."
          : de
            ? "Die Zip-Datei konnte nicht erstellt werden. Bitte erneut versuchen oder einzeln herunterladen."
            : "The zip file could not be created. Please retry or download them one by one.",
        { count: items.length },
        err,
      );
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function saveAllAudioToFolder() {
    const items = downloadableAudio;
    if (!items.length) return;
    setBusy("audio-all:folder");
    setProgress({ done: 0, total: items.length });
    let saved = 0;
    try {
      for (const item of items) {
        const file = await audioFile(item);
        if (file) {
          const res = await saveFile(AUDIO_FOLDER, file.name, file.blob, "folder");
          if (!res) throw new Error("backup folder not available");
          saved++;
        }
        setProgress({ done: saved, total: items.length });
      }
      notify(
        de
          ? `${saved} ${saved === 1 ? "Aufnahme" : "Aufnahmen"} in „${folder?.name}/${AUDIO_FOLDER}“ gespeichert.`
          : `${saved} ${saved === 1 ? "recording" : "recordings"} saved to “${folder?.name}/${AUDIO_FOLDER}”.`,
      );
    } catch (err) {
      fail(
        de
          ? `Nach ${saved} von ${items.length} Aufnahmen abgebrochen. Bitte erneut versuchen oder einzeln herunterladen.`
          : `Stopped after ${saved} of ${items.length} recordings. Please retry or download them one by one.`,
        { saved, total: items.length },
        err,
      );
    } finally {
      setBusy(null);
      setProgress(null);
    }
  }

  async function downloadAllTranscriptsZip() {
    setBusy("transcripts-all");
    try {
      const name = await downloadAllTranscripts(transcripts, sessionDocs);
      notify(de ? `Heruntergeladen: ${name} (${transcriptCount} ${transcriptCount === 1 ? "Transkript" : "Transkripte"}).` : `Downloaded: ${name} (${transcriptCount} ${transcriptCount === 1 ? "transcript" : "transcripts"}).`);
    } catch (err) {
      fail(de ? "Die Zip-Datei mit den Transkripten konnte nicht erstellt werden." : "The zip file with the transcripts could not be created.", { count: transcriptCount }, err);
    } finally {
      setBusy(null);
    }
  }

  async function saveAllTranscriptsToFolder() {
    setBusy("transcripts-folder");
    try {
      let count = 0;
      for (const iv of transcripts) {
        const res = await saveFile(TRANSCRIPT_FOLDER, transcriptFileName(iv), markdownBlob(transcriptMarkdown(iv)), "folder");
        if (!res) throw new Error("backup folder not available");
        count++;
      }
      for (const t of sessionDocs) {
        const res = await saveFile(TRANSCRIPT_FOLDER, sessionTranscriptFileName(t), markdownBlob(sessionTranscriptMarkdown(t)), "folder");
        if (!res) throw new Error("backup folder not available");
        count++;
      }
      if (transcripts.length) await saveFile(TRANSCRIPT_FOLDER, allTranscriptsFileName(), markdownBlob(allTranscriptsMarkdown(transcripts)), "folder");
      notify(
        de
          ? `${count} ${count === 1 ? "Transkript" : "Transkripte"} in „${folder?.name}/${TRANSCRIPT_FOLDER}“ gespeichert.`
          : `${count} ${count === 1 ? "transcript" : "transcripts"} saved to “${folder?.name}/${TRANSCRIPT_FOLDER}”.`,
      );
    } catch (err) {
      fail(de ? "Die Transkripte konnten nicht in den Sicherungsordner geschrieben werden." : "The transcripts could not be written to the backup folder.", { count: transcriptCount }, err);
    } finally {
      setBusy(null);
    }
  }

  async function removeSession(id: string) {
    setConfirmDelete(null);
    setBusy(`rec:${id}`);
    try {
      await deleteStoredRecording(id);
      notify(de ? "Aufnahme gelöscht." : "Recording deleted.");
    } catch (err) {
      fail(de ? "Die Aufnahme konnte nicht gelöscht werden." : "The recording could not be deleted.", { id }, err);
    } finally {
      setBusy(null);
    }
  }

  const locked = busy !== null;
  const row = "flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-md px-3 py-2";
  const subHead = "flex items-center gap-2 text-sm font-semibold";

  return (
    <section ref={sectionRef} className="rounded-lg p-4 space-y-5 text-sm scroll-mt-20" style={card} aria-labelledby="downloads-heading" data-testid="downloads-section">
      <div className="space-y-1">
        <h2 id="downloads-heading" className="text-lg font-semibold">
          {de ? "Transkripte & Aufnahmen" : "Transcripts & recordings"}
        </h2>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Alles, was auf diesem Gerät transkribiert und aufgenommen wurde, als eigene Dateien: Transkripte als lesbare Markdown-Datei (öffnet in jedem Texteditor und in Word), Aufnahmen im Originalformat. „Alle herunterladen“ packt sie in eine Zip-Datei. Transkripte sind von privaten und unangemessenen Passagen bereinigt."
            : "Everything transcribed and recorded on this device as separate files: transcripts as readable Markdown (opens in any text editor and in Word), recordings in their original format. “Download all” packs them into one zip file. Transcripts are cleaned of private and inappropriate passages."}
        </p>
      </div>

      {/* ------------------------------------------------------ automatic */}
      <div className="space-y-1.5">
        <label className="flex items-start gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={autoOn}
            onChange={(e) => setAuto(e.target.checked)}
            className="size-4 accent-[var(--workshop-accent)] shrink-0 mt-0.5"
            data-testid="auto-export-toggle"
          />
          <span>
            <span className="font-medium">{de ? "Transkripte und Aufnahmen automatisch speichern" : "Save transcripts and recordings automatically"}</span>
            <span className="block text-xs leading-snug mt-0.5" style={muted}>
              {folder
                ? de
                  ? `Jedes neue Interview-Transkript, jede Interview-Aufnahme, jede beendete Sitzungsaufnahme und jedes fertige Sitzungstranskript landet sofort im Sicherungsordner „${folder.name}“ (Unterordner „${TRANSCRIPT_FOLDER}“ und „${AUDIO_FOLDER}“).${folderReady ? "" : " Solange der Ordner nach einem Browser-Neustart noch nicht wieder freigegeben ist, wird stattdessen heruntergeladen."}`
                  : `Every new interview transcript, interview recording, finished session recording and completed session transcript goes straight into the backup folder “${folder.name}” (subfolders “${TRANSCRIPT_FOLDER}” and “${AUDIO_FOLDER}”).${folderReady ? "" : " Until the folder is granted again after a browser restart, files are downloaded instead."}`
                : de
                  ? "Jedes neue Interview-Transkript, jede Interview-Aufnahme, jede beendete Sitzungsaufnahme und jedes fertige Sitzungstranskript wird sofort heruntergeladen. Chrome fragt beim zweiten Mal einmal, ob die Seite mehrere Dateien herunterladen darf – bitte erlauben. Mit einem Sicherungsordner (oben) landen die Dateien stattdessen dort."
                  : "Every new interview transcript, interview recording, finished session recording and completed session transcript is downloaded right away. Chrome asks once, on the second file, whether the page may download multiple files – please allow. With a backup folder (above) the files go there instead."}
            </span>
          </span>
        </label>
        {autoOn && last && (
          <p className="text-xs pl-6" style={muted} data-testid="auto-export-last">
            {de ? "Zuletzt gespeichert: " : "Last saved: "}
            {last.path ?? last.name} · {formatDate(last.at, lang)}
          </p>
        )}
      </div>

      {/* ----------------------------------------------------- transcripts */}
      <div className="space-y-2">
        <div className={subHead}>
          <FileText size={16} style={{ color: "var(--workshop-accent)" }} aria-hidden />
          {de ? `Transkripte (${transcriptCount})` : `Transcripts (${transcriptCount})`}
        </div>
        {transcriptCount === 0 ? (
          <p className="text-xs" style={muted}>
            {de
              ? "Noch keine Transkripte. Sie entstehen auf der Seite KI-Interviews und – wenn eingeschaltet – laufend aus der Sitzungsaufnahme."
              : "No transcripts yet. They are created on the AI interviews page and – when switched on – continuously from the session recording."}
          </p>
        ) : (
          <>
            <ul className="space-y-1.5" data-testid="downloads-transcripts">
              {transcripts.map((iv) => (
                <li key={iv.id} className={row} style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
                  <span className="font-medium">{iv.pseudonym}</span>
                  <span className="text-xs" style={muted}>
                    {formatDate(iv.createdAt, lang)} · {iv.transcript?.split(/\s+/).filter(Boolean).length ?? 0} {de ? "Wörter" : "words"}
                    {iv.opinion ? (de ? " · mit Meinungsbild" : " · with opinion picture") : ""}
                    {removedLabel(iv.transcriptRemoved, lang) ? ` · ${removedLabel(iv.transcriptRemoved, lang)}` : ""}
                  </span>
                  <button type="button" onClick={() => downloadTranscript(iv)} disabled={locked} className={`${BTN_SM} ml-auto`} style={outline}>
                    <Download size={12} /> {de ? "Herunterladen" : "Download"}
                  </button>
                </li>
              ))}
              {sessionDocs.map((t) => {
                const p = transcriptProgress(t);
                const removed = removedLabel(sessionRemoved(t), lang);
                return (
                  <li key={t.sessionId} className={row} style={{ background: "var(--bg)", border: "1px solid var(--border)" }} data-kind="session-transcript">
                    <span className="font-medium">
                      {de ? "Sitzung" : "Session"} {formatDate(t.startedAt, lang)}
                    </span>
                    <span className="text-xs" style={muted}>
                      {formatHours(sessionDurationSec(t))} · {p.done}/{p.total} {de ? "Abschnitte" : "segments"}
                      {p.failed ? (de ? ` · ${p.failed} fehlgeschlagen` : ` · ${p.failed} failed`) : ""}
                      {t.closed ? "" : de ? " · Aufnahme läuft" : " · recording"}
                      {removed ? ` · ${removed}` : ""}
                    </span>
                    <button type="button" onClick={() => downloadSessionTranscript(t)} disabled={locked} className={`${BTN_SM} ml-auto`} style={outline}>
                      <Download size={12} /> {de ? "Herunterladen" : "Download"}
                    </button>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => void downloadAllTranscriptsZip()} disabled={locked} className={BTN} style={outline} data-testid="downloads-transcripts-all">
                {busy === "transcripts-all" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {de ? "Alle Transkripte herunterladen (Zip)" : "Download all transcripts (zip)"}
              </button>
              {folderReady && (
                <button type="button" onClick={() => void saveAllTranscriptsToFolder()} disabled={locked} className={BTN} style={outline}>
                  {busy === "transcripts-folder" ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}
                  {de ? "Alle in den Sicherungsordner" : "All to the backup folder"}
                </button>
              )}
            </div>
          </>
        )}
      </div>

      {/* --------------------------------------------------------- audio */}
      <div className="space-y-2">
        <div className={subHead}>
          <FileAudio size={16} style={{ color: "var(--workshop-accent)" }} aria-hidden />
          {de ? `Aufnahmen (${audio.length})` : `Recordings (${audio.length})`}
        </div>
        {failed && (
          <Notice tone="error">
            {de ? "Die Sitzungsaufnahmen ließen sich nicht lesen (Browser-Speicher blockiert?)." : "The session recordings could not be read (browser storage blocked?)."}
          </Notice>
        )}
        {audio.length === 0 ? (
          <p className="text-xs" style={muted}>
            {de
              ? "Keine Aufnahmen auf diesem Gerät. Interview-Aufnahmen entstehen auf der Seite KI-Interviews, Sitzungsaufnahmen über das Aufnahme-Menü oben."
              : "No recordings on this device. Interview recordings are made on the AI interviews page, session recordings via the recording menu at the top."}
          </p>
        ) : (
          <>
            <ul className="space-y-1.5" data-testid="downloads-audio">
              {audio.map((item) => {
                const isSession = item.kind === "session";
                const unusable = isSession && (item.running || item.session.chunkCount === 0);
                return (
                  <li key={item.key} className={row} style={{ background: "var(--bg)", border: "1px solid var(--border)" }} data-kind={item.kind}>
                    <span className="font-medium">
                      {item.kind === "interview" ? item.iv.pseudonym : de ? "Sitzungsaufnahme" : "Session recording"}
                    </span>
                    <span className="text-xs" style={muted}>
                      {item.kind === "interview"
                        ? `${de ? "Interview" : "Interview"} · ${formatDate(item.iv.createdAt, lang)} · ${formatDuration(item.iv.durationSec)} · ${formatBytes(item.blob.size, lang)}`
                        : `${formatDate(item.session.startedAt, lang)} · ${formatDuration(item.session.seconds)} · ${formatBytes(item.session.bytes, lang)}${
                            item.running
                              ? de
                                ? " · läuft noch"
                                : " · still running"
                              : item.session.closed
                                ? ""
                                : de
                                  ? " · unterbrochen, bis zur letzten Sicherung"
                                  : " · interrupted, up to the last saved part"
                          }`}
                    </span>
                    <span className="ml-auto flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => void downloadOneAudio(item)}
                        disabled={locked || unusable}
                        className={BTN_SM}
                        style={outline}
                      >
                        {busy === item.key ? <Loader2 size={12} className="animate-spin" /> : <Download size={12} />}
                        {de ? "Herunterladen" : "Download"}
                      </button>
                      {isSession && !item.running && confirmDelete !== item.session.id && (
                        <button
                          type="button"
                          onClick={() => setConfirmDelete(item.session.id)}
                          disabled={locked}
                          className={BTN_SM}
                          style={danger}
                          aria-label={de ? "Sitzungsaufnahme löschen" : "Delete session recording"}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                      {isSession && confirmDelete === item.session.id && (
                        <>
                          <button
                            type="button"
                            onClick={() => void removeSession(item.session.id)}
                            className={BTN_SM}
                            style={{ background: ERROR_COLOR, color: "white" }}
                          >
                            {de ? "Endgültig löschen" : "Delete permanently"}
                          </button>
                          <button type="button" onClick={() => setConfirmDelete(null)} className={BTN_SM} style={outline}>
                            {de ? "Abbrechen" : "Cancel"}
                          </button>
                        </>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => void downloadAllAudioZip()}
                disabled={locked || downloadableAudio.length === 0}
                className={BTN}
                style={outline}
                data-testid="downloads-audio-all"
              >
                {busy === "audio-all:download" ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
                {de ? `Alle Aufnahmen herunterladen (Zip, ${downloadableAudio.length} ${downloadableAudio.length === 1 ? "Datei" : "Dateien"})` : `Download all recordings (zip, ${downloadableAudio.length} ${downloadableAudio.length === 1 ? "file" : "files"})`}
              </button>
              {folderReady && (
                <button
                  type="button"
                  onClick={() => void saveAllAudioToFolder()}
                  disabled={locked || downloadableAudio.length === 0}
                  className={BTN}
                  style={outline}
                >
                  {busy === "audio-all:folder" ? <Loader2 size={15} className="animate-spin" /> : <FolderOpen size={15} />}
                  {de ? "Alle in den Sicherungsordner" : "All to the backup folder"}
                </button>
              )}
              {progress && (
                <span className="text-xs tabular-nums" style={muted} role="status">
                  {progress.done} / {progress.total}
                </span>
              )}
            </div>
            <p className="text-xs leading-snug" style={muted}>
              {de
                ? "„Alle Aufnahmen herunterladen“ erzeugt eine Zip-Datei; bei langen Sitzungsaufnahmen kann sie mehrere Hundert MB groß werden. Sitzungsaufnahmen sind nicht in der Sicherung enthalten, ihre Transkripte schon."
                : "“Download all recordings” creates one zip file; with long session recordings it can be several hundred MB. Session recordings are not part of the backup, their transcripts are."}
            </p>
          </>
        )}
      </div>

      {done && <Notice tone="ok">{done}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
    </section>
  );
}
