import { useEffect, useState, type ReactNode } from "react";
import {
  AlertTriangle,
  Check,
  Download,
  FolderOpen,
  FolderSync,
  History,
  Loader2,
  RotateCcw,
  Save,
  Trash2,
  Unplug,
} from "lucide-react";
import type { Lang } from "@/types/slide";
import { describeBackupError, formatBackupCounts } from "@/lib/backup";
import {
  KEEP_RECENT,
  REASON_LABEL,
  chooseFolder,
  createSnapshot,
  deleteAllSnapshots,
  deleteSnapshot,
  describeProblem,
  disconnectFolder,
  downloadSnapshot,
  refreshStorageInfo,
  regrantFolder,
  requestPersistence,
  restoreSnapshot,
  useAutoBackup,
  type SnapshotMeta,
} from "@/lib/auto-backup";
import { Tooltip } from "@/components/ui/Tooltip";
import { BTN, BTN_SM, ERROR_COLOR, Notice, card, formatBytes, muted, outline } from "@/components/interviews/ui";

/** The list stays short on screen; the rest is one click away. */
const VISIBLE_ROWS = 6;

/** formatBytes stops at MB — a browser quota reads better in GB. */
function formatSize(n: number, lang: Lang): string {
  if (n < 1024 ** 3) return formatBytes(n, lang);
  const text = `${(n / 1024 ** 3).toFixed(1)} GB`;
  return lang === "de" ? text.replace(".", ",") : text;
}

/** Re-renders every 30 s so "vor 4 Minuten" stays true without a reload. */
function useNow(stepMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = window.setInterval(() => setNow(Date.now()), stepMs);
    return () => window.clearInterval(t);
  }, [stepMs]);
  return now;
}

function relative(iso: string, now: number, lang: Lang): string {
  const min = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  const de = lang === "de";
  if (min < 1) return de ? "gerade eben" : "just now";
  if (min < 60) return de ? `vor ${min} ${min === 1 ? "Minute" : "Minuten"}` : `${min} ${min === 1 ? "minute" : "minutes"} ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return de ? `vor ${h} ${h === 1 ? "Stunde" : "Stunden"}` : `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.floor(h / 24);
  return de ? `vor ${d} ${d === 1 ? "Tag" : "Tagen"}` : `${d} ${d === 1 ? "day" : "days"} ago`;
}

function clock(iso: string, lang: Lang, withDay: boolean): string {
  const d = new Date(iso);
  return d.toLocaleString(lang === "de" ? "de-DE" : "en-GB", {
    ...(withDay ? { weekday: "short", day: "2-digit", month: "2-digit" } : {}),
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatusTile({ label, value, ok, children }: { label: string; value: ReactNode; ok: boolean | null; children?: ReactNode }) {
  const dot = ok === null ? "var(--fg-muted)" : ok ? "var(--workshop-accent)" : ERROR_COLOR;
  return (
    <div className="rounded-md p-3 space-y-1 min-w-0" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
      <div className="text-[11px] uppercase tracking-wide font-semibold" style={muted}>
        {label}
      </div>
      <div className="flex items-center gap-2 text-sm font-semibold min-w-0">
        {ok !== null && (
          <span
            className="size-2 rounded-full shrink-0"
            style={ok ? { background: dot } : { border: `2px solid ${dot}` }}
            aria-hidden
          />
        )}
        <span className="truncate">{value}</span>
      </div>
      {children && (
        <div className="text-xs leading-snug" style={muted}>
          {children}
        </div>
      )}
    </div>
  );
}

/**
 * "Automatische Sicherung" in the settings: status of the snapshots, the
 * backup folder and the storage, plus the list of snapshots to restore,
 * download or delete. The engine itself (auto-backup.ts) runs on every route.
 */
export function AutoBackupSection({ lang }: { lang: Lang }) {
  const de = lang === "de";
  const st = useAutoBackup();
  const now = useNow();
  const [busy, setBusy] = useState<string | null>(null);
  const [done, setDone] = useState("");
  const [error, setError] = useState("");
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [confirmAll, setConfirmAll] = useState(false);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    void refreshStorageInfo();
  }, [st.snapshots.length]);

  const notices = (ok: string, err = "") => {
    setDone(ok);
    setError(err);
  };

  async function run(key: string, action: () => Promise<void>) {
    notices("");
    setBusy(key);
    try {
      await action();
    } finally {
      setBusy(null);
    }
  }

  const newest = st.snapshots[0];
  const snapshotBytes = st.snapshots.reduce((n, m) => n + m.bytes, 0);
  const folder = st.folder;
  // A folder without a readable name (e.g. a drive root) is still a connected folder.
  const folderName = folder?.name ? (de ? `„${folder.name}“` : `“${folder.name}”`) : de ? "Ordner" : "folder";
  const folderOk = folder ? folder.permission === "granted" || folder.permission === "unknown" : false;

  const snapshotNow = () =>
    run("snapshot", async () => {
      try {
        const meta = await createSnapshot("manual");
        notices(
          meta
            ? de
              ? `Zwischenstand angelegt (${clock(meta.createdAt, lang, false)}).`
              : `Snapshot taken (${clock(meta.createdAt, lang, false)}).`
            : newest
              ? de
                ? "Seit dem letzten Zwischenstand hat sich nichts geändert, der Stand ist bereits gesichert."
                : "Nothing has changed since the last snapshot; the state is already saved."
              : de
                ? "Noch keine Inhalte vorhanden, daher kein Zwischenstand."
                : "No content yet, so no snapshot.",
        );
      } catch (err) {
        console.error("[settings] manual snapshot failed", err);
        notices("", de ? "Der Zwischenstand konnte nicht angelegt werden." : "The snapshot could not be taken.");
      }
    });

  const pickFolder = () =>
    run("folder", async () => {
      try {
        if (await chooseFolder()) {
          notices(de ? "Sicherungsordner verbunden. Der aktuelle Stand wird dort abgelegt." : "Backup folder connected. The current state is saved there.");
        }
      } catch (err) {
        console.error("[settings] choosing the backup folder failed", err);
        notices("", de ? "Der Ordner konnte nicht verbunden werden. Bitte einen anderen Ordner wählen." : "The folder could not be connected. Please choose another folder.");
      }
    });

  const regrant = () =>
    run("regrant", async () => {
      const ok = await regrantFolder();
      notices(
        ok ? (de ? "Ordner wieder freigegeben." : "Folder access granted again.") : "",
        ok ? "" : de ? "Die Freigabe wurde nicht erteilt. Bis dahin wird nur im Browser gesichert." : "Access was not granted. Until then backups stay in the browser only.",
      );
    });

  const restore = (m: SnapshotMeta) =>
    run(`restore:${m.id}`, async () => {
      try {
        const s = await restoreSnapshot(m.id);
        setConfirmId(null);
        notices(
          de
            ? `Zwischenstand von ${clock(m.createdAt, lang, true)} wiederhergestellt: ${formatBackupCounts(s, lang)}. Der vorherige Stand liegt als Zwischenstand „vor dem Wiederherstellen“ bereit.`
            : `Snapshot from ${clock(m.createdAt, lang, true)} restored: ${formatBackupCounts(s, lang)}. The previous state is kept as a snapshot “before restoring a snapshot”.`,
        );
      } catch (err) {
        console.error("[settings] restoring a snapshot failed", { id: m.id, err });
        notices("", describeBackupError(err, lang));
      }
    });

  const download = (m: SnapshotMeta) =>
    run(`download:${m.id}`, async () => {
      try {
        const name = await downloadSnapshot(m.id);
        notices(de ? `Heruntergeladen: ${name}` : `Downloaded: ${name}`);
      } catch (err) {
        console.error("[settings] downloading a snapshot failed", { id: m.id, err });
        notices("", de ? "Der Zwischenstand konnte nicht heruntergeladen werden." : "The snapshot could not be downloaded.");
      }
    });

  const remove = (m: SnapshotMeta) =>
    run(`delete:${m.id}`, async () => {
      try {
        await deleteSnapshot(m.id);
      } catch (err) {
        console.error("[settings] deleting a snapshot failed", { id: m.id, err });
        notices("", de ? "Der Zwischenstand konnte nicht gelöscht werden." : "The snapshot could not be deleted.");
      }
    });

  const removeAll = () =>
    run("delete-all", async () => {
      try {
        await deleteAllSnapshots();
        setConfirmAll(false);
        notices(de ? "Alle Zwischenstände wurden gelöscht." : "All snapshots were deleted.");
      } catch (err) {
        console.error("[settings] deleting all snapshots failed", err);
        notices("", de ? "Die Zwischenstände konnten nicht gelöscht werden." : "The snapshots could not be deleted.");
      }
    });

  const subHead = "text-sm font-semibold";
  const disabled = busy !== null || st.busy;

  const folderValue = !st.folderSupported
    ? de
      ? "in diesem Browser nicht möglich"
      : "not possible in this browser"
    : !folder
      ? de
        ? "nicht verbunden"
        : "not connected"
      : folder.permission === "prompt"
        ? de
          ? `${folderName} – Freigabe nötig`
          : `${folderName} – access needed`
        : folder.permission === "denied"
          ? de
            ? `${folderName} – blockiert`
            : `${folderName} – blocked`
          : folder.name
            ? de
              ? `verbunden: ${folderName}`
              : `connected: ${folderName}`
            : de
              ? "verbunden"
              : "connected";

  return (
    <section className="rounded-lg p-4 sm:p-5 space-y-5" style={card} aria-labelledby="auto-backup-heading" data-testid="auto-backup-section">
      <div className="space-y-2">
        <h2 id="auto-backup-heading" className={`${subHead} flex items-center gap-2`}>
          <History size={16} style={{ color: "var(--workshop-accent)" }} aria-hidden />
          {de ? "Automatische Sicherung" : "Automatic backup"}
        </h2>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? "Die App legt alle 15 Minuten einen Zwischenstand im Browser an, sobald sich etwas geändert hat, außerdem beim Verlassen der Seite und immer vor dem Zurücksetzen oder Einlesen. Mit einem Sicherungsordner landet jeder Zwischenstand zusätzlich als Datei auf der Festplatte. API-Schlüssel und Anmeldung sind nie enthalten."
            : "The app takes a snapshot in the browser every 15 minutes once something has changed, also when the page is left and always before a reset or restore. With a backup folder, every snapshot is also written to disk as a file. API keys and login are never included."}
        </p>
      </div>

      {/* --------------------------------------------------------- status */}
      <div className="grid gap-2 sm:grid-cols-2" data-testid="auto-backup-status">
        <StatusTile
          label={de ? "Letzter Zwischenstand" : "Last snapshot"}
          ok={newest ? now - new Date(newest.createdAt).getTime() < 2 * 60 * 60 * 1000 : null}
          value={newest ? `${relative(newest.createdAt, now, lang)} (${clock(newest.createdAt, lang, false)})` : de ? "noch keiner" : "none yet"}
        >
          {newest
            ? formatBackupCounts(newest.summary, lang)
            : de
              ? "Entsteht, sobald Inhalte erfasst sind."
              : "Appears as soon as content is captured."}
        </StatusTile>

        <StatusTile label={de ? "Sicherungsordner" : "Backup folder"} ok={st.folderSupported ? folderOk : null} value={folderValue}>
          {!st.folderSupported
            ? de
              ? "Nur Chrome und Edge können direkt in einen Ordner schreiben."
              : "Only Chrome and Edge can write straight to a folder."
            : folder?.lastFileName
              ? de
                ? `Zuletzt: ${folder.lastFileName}${folder.lastWriteAt ? `, ${relative(folder.lastWriteAt, now, lang)}` : ""}`
                : `Last: ${folder.lastFileName}${folder.lastWriteAt ? `, ${relative(folder.lastWriteAt, now, lang)}` : ""}`
              : folder
                ? de
                  ? "Noch keine Datei geschrieben."
                  : "No file written yet."
                : de
                  ? "Empfohlen: einmal einen Ordner wählen."
                  : "Recommended: choose a folder once."}
        </StatusTile>

        <StatusTile
          label={de ? "Speicher dauerhaft" : "Persistent storage"}
          ok={st.persisted}
          value={st.persisted === null ? (de ? "unbekannt" : "unknown") : st.persisted ? (de ? "ja" : "yes") : de ? "nein" : "no"}
        >
          {st.persisted
            ? de
              ? "Der Browser räumt die Daten nicht von sich aus weg, wenn der Speicher knapp wird."
              : "The browser will not clear the data on its own when storage runs low."
            : de
              ? "Der Browser könnte die Daten bei knappem Speicher räumen. Hilft: App installieren oder als Lesezeichen speichern."
              : "The browser might clear the data when storage runs low. Helps: install the app or bookmark it."}
          {st.persisted === false && (
            <button
              type="button"
              onClick={() => void requestPersistence()}
              className="block mt-1 font-semibold"
              style={{ color: "var(--workshop-accent)" }}
            >
              {de ? "Erneut anfordern" : "Request again"}
            </button>
          )}
        </StatusTile>

        <StatusTile
          label={de ? "Belegter Speicher" : "Storage used"}
          ok={null}
          value={de ? `Zwischenstände: ${formatBytes(snapshotBytes, lang)}` : `Snapshots: ${formatBytes(snapshotBytes, lang)}`}
        >
          {st.storage
            ? de
              ? `Browser gesamt: ${formatSize(st.storage.usage, lang)} von ${formatSize(st.storage.quota, lang)} verfügbar`
              : `Browser total: ${formatSize(st.storage.usage, lang)} of ${formatSize(st.storage.quota, lang)} available`
            : de
              ? "Der Browser nennt keine Gesamtgröße."
              : "The browser does not report a total."}
        </StatusTile>
      </div>

      {st.snapshotProblem && <Notice tone="error">{describeProblem(st.snapshotProblem, lang)}</Notice>}
      {st.folderProblem && <Notice tone="error">{describeProblem(st.folderProblem, lang)}</Notice>}

      {/* -------------------------------------------------------- actions */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className={subHead}>{de ? "Sicherungsordner auf der Festplatte" : "Backup folder on disk"}</div>
        {st.folderSupported ? (
          <p className="text-xs leading-snug" style={muted}>
            {de
              ? "Einmal einen Ordner wählen, zum Beispiel auf einem USB-Stick oder in einem synchronisierten Cloud-Ordner. Danach schreibt die App jeden neuen Zwischenstand als eigene Datei mit Datum und Uhrzeit hinein (fbs-workshop-2026-09-16_10-45.json) und einmal pro Tag eine Datei mit den Interview-Aufnahmen. Alte Dateien bleiben liegen. Nach einem Neustart des Browsers fragt Chrome einmal nach, ob die App weiter hineinschreiben darf – dafür erscheint unten links ein Hinweis."
              : "Choose a folder once, for example on a USB stick or in a synced cloud folder. From then on the app writes every new snapshot into it as its own file with date and time (fbs-workshop-2026-09-16_10-45.json), and once a day a file with the interview recordings. Old files are kept. After a browser restart Chrome asks once whether the app may keep writing — a notice appears in the bottom left for that."}
          </p>
        ) : (
          <Notice tone="warn">
            {de
              ? "Dieser Browser (z. B. Firefox oder Safari) kann nicht selbst in einen Ordner schreiben. Es bleiben die automatischen Zwischenstände im Browser und die Sicherung als Download weiter unten. Für den Workshop Chrome oder Edge verwenden, dann geht beides."
              : "This browser (e.g. Firefox or Safari) cannot write to a folder itself. What remains are the automatic snapshots in the browser and the backup download further down. Use Chrome or Edge for the workshop to get both."}
          </Notice>
        )}
        <div className="flex flex-wrap gap-2">
          {st.folderSupported && folder?.permission === "prompt" && (
            <button type="button" onClick={regrant} disabled={disabled} className={BTN} style={outline} data-testid="auto-backup-regrant-settings">
              {busy === "regrant" ? <Loader2 size={16} className="animate-spin" /> : <FolderSync size={16} />}
              {de ? "Ordner wieder freigeben" : "Re-allow folder"}
            </button>
          )}
          {st.folderSupported && (
            <button type="button" onClick={pickFolder} disabled={disabled} className={BTN} style={outline} data-testid="auto-backup-choose-folder">
              {busy === "folder" ? <Loader2 size={16} className="animate-spin" /> : <FolderOpen size={16} />}
              {folder ? (de ? "Anderen Ordner wählen" : "Choose another folder") : de ? "Sicherungsordner wählen" : "Choose backup folder"}
            </button>
          )}
          {folder && (
            <button
              type="button"
              onClick={() => run("disconnect", disconnectFolder)}
              disabled={disabled}
              className={BTN}
              style={{ ...outline, color: "var(--fg-muted)" }}
            >
              <Unplug size={16} />
              {de ? "Ordner trennen" : "Disconnect folder"}
            </button>
          )}
        </div>
      </div>

      {done && <Notice tone="ok">{done}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {/* ----------------------------------------------------------- list */}
      <div className="space-y-2 pt-4" style={{ borderTop: "1px solid var(--border)" }}>
        <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
          <div className={subHead}>
            {de ? "Zwischenstände im Browser" : "Snapshots in the browser"}{" "}
            <span className="font-normal" style={muted}>
              ({st.snapshots.length})
            </span>
          </div>
          <button
            type="button"
            onClick={snapshotNow}
            disabled={disabled}
            className={BTN}
            style={{ background: "var(--workshop-accent)", color: "white" }}
            data-testid="auto-backup-now"
          >
            {busy === "snapshot" ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
            {de ? "Jetzt Zwischenstand anlegen" : "Take snapshot now"}
          </button>
        </div>
        <p className="text-xs leading-snug" style={muted}>
          {de
            ? `Aufbewahrt werden die letzten ${KEEP_RECENT} (etwa drei Stunden), dazu der erste jeder Stunde der letzten zwei Tage, der letzte jedes Tages und die letzten fünf vor dem Zurücksetzen oder Einlesen. Nur diese enthalten auch die Interview-Aufnahmen. Über 200 MB fallen die ältesten weg.`
            : `Kept are the last ${KEEP_RECENT} (about three hours), plus the first of every hour of the last two days, the last of each day and the last five taken before a reset or restore. Only those also contain the interview recordings. Above 200 MB the oldest are dropped.`}
        </p>

        {st.snapshots.length === 0 ? (
          <p className="text-xs italic" style={muted}>
            {st.ready ? (de ? "Noch keine Zwischenstände." : "No snapshots yet.") : de ? "Wird geladen…" : "Loading…"}
          </p>
        ) : (
          <ul className="rounded-md overflow-hidden" style={{ border: "1px solid var(--border)" }} data-testid="auto-backup-list">
            {(showAll ? st.snapshots : st.snapshots.slice(0, VISIBLE_ROWS)).map((m, i) => {
              const confirming = confirmId === m.id;
              const safety = m.reason.startsWith("before-");
              return (
                <li
                  key={m.id}
                  data-testid="auto-backup-item"
                  className="px-3 py-2 text-xs space-y-2"
                  style={{ background: "var(--bg)", borderTop: i ? "1px solid var(--border)" : undefined }}
                >
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <div className="min-w-0 flex-1 basis-80">
                      <div className="flex flex-wrap items-baseline gap-x-2">
                        <span className="text-sm font-semibold tabular-nums" style={{ color: "var(--fg)" }}>
                          {clock(m.createdAt, lang, true)}
                        </span>
                        <span style={muted}>{relative(m.createdAt, now, lang)}</span>
                        <span
                          className="px-1.5 rounded text-[11px] font-medium"
                          style={
                            safety
                              ? { color: "var(--workshop-accent)", background: "color-mix(in oklch, var(--workshop-accent) 10%, transparent)" }
                              : { color: "var(--fg-muted)", background: "color-mix(in oklch, var(--fg) 6%, transparent)" }
                          }
                        >
                          {REASON_LABEL[m.reason][lang]}
                        </span>
                      </div>
                      <div className="mt-0.5" style={muted}>
                        {formatBackupCounts(m.summary, lang)} · {formatBytes(m.bytes, lang)}
                        {m.withAudio ? (de ? " · mit Aufnahmen" : " · with recordings") : ""}
                        {m.summary.hasReport ? (de ? " · mit Ergebnisbericht" : " · with results report") : ""}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => {
                          notices("");
                          setConfirmId(confirming ? null : m.id);
                        }}
                        disabled={disabled}
                        className={BTN_SM}
                        style={outline}
                        data-testid="auto-backup-restore"
                      >
                        <RotateCcw size={13} /> {de ? "Wiederherstellen" : "Restore"}
                      </button>
                      <Tooltip content={de ? "Als Sicherungsdatei herunterladen" : "Download as backup file"}>
                        <button
                          type="button"
                          onClick={() => download(m)}
                          disabled={disabled}
                          className={BTN_SM}
                          style={outline}
                          aria-label={de ? `Zwischenstand von ${clock(m.createdAt, lang, true)} herunterladen` : `Download snapshot from ${clock(m.createdAt, lang, true)}`}
                        >
                          {busy === `download:${m.id}` ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
                        </button>
                      </Tooltip>
                      <Tooltip content={de ? "Diesen Zwischenstand löschen" : "Delete this snapshot"}>
                        <button
                          type="button"
                          onClick={() => remove(m)}
                          disabled={disabled}
                          className={BTN_SM}
                          style={{ ...outline, color: ERROR_COLOR }}
                          aria-label={de ? `Zwischenstand von ${clock(m.createdAt, lang, true)} löschen` : `Delete snapshot from ${clock(m.createdAt, lang, true)}`}
                        >
                          <Trash2 size={14} />
                        </button>
                      </Tooltip>
                    </div>
                  </div>
                  {confirming && (
                    <div
                      className="rounded-md p-2.5 space-y-2"
                      style={{ border: "1px solid var(--workshop-accent)", background: "color-mix(in oklch, var(--workshop-accent) 5%, transparent)" }}
                      role="alertdialog"
                      aria-label={de ? "Wiederherstellen bestätigen" : "Confirm restore"}
                    >
                      <p className="flex items-start gap-1.5 font-medium" style={{ color: "var(--fg)" }}>
                        <AlertTriangle size={14} className="mt-px shrink-0" style={{ color: ERROR_COLOR }} aria-hidden />
                        <span>
                          {de
                            ? `Der aktuelle Stand wird vollständig durch den Stand von ${clock(m.createdAt, lang, true)} ersetzt. Vorher wird der aktuelle Stand automatisch als Zwischenstand gesichert, das Wiederherstellen lässt sich also rückgängig machen.`
                            : `The current state is replaced completely by the state from ${clock(m.createdAt, lang, true)}. The current state is saved as a snapshot first, so the restore can be undone.`}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => restore(m)}
                          disabled={disabled}
                          className={BTN_SM}
                          style={{ background: "var(--workshop-accent)", color: "white" }}
                          data-testid="auto-backup-restore-confirm"
                        >
                          {busy === `restore:${m.id}` ? <Loader2 size={13} className="animate-spin" /> : <Check size={13} />}
                          {de ? "Wiederherstellen" : "Restore"}
                        </button>
                        <button type="button" onClick={() => setConfirmId(null)} disabled={disabled} className={BTN_SM} style={outline}>
                          {de ? "Abbrechen" : "Cancel"}
                        </button>
                      </div>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          {st.snapshots.length > VISIBLE_ROWS && (
            <button
              type="button"
              onClick={() => setShowAll((v) => !v)}
              className="text-xs font-semibold"
              style={{ color: "var(--workshop-accent)" }}
              data-testid="auto-backup-show-all"
            >
              {showAll
                ? de
                  ? "Weniger anzeigen"
                  : "Show fewer"
                : de
                  ? `Alle ${st.snapshots.length} anzeigen`
                  : `Show all ${st.snapshots.length}`}
            </button>
          )}

          {st.snapshots.length > 0 &&
            (confirmAll ? (
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span style={{ color: ERROR_COLOR }}>
                  {de ? "Wirklich alle Zwischenstände löschen? Die Inhalte selbst bleiben." : "Really delete all snapshots? The content itself stays."}
                </span>
                <button type="button" onClick={removeAll} disabled={disabled} className={BTN_SM} style={{ background: ERROR_COLOR, color: "white" }}>
                  <Trash2 size={13} /> {de ? "Alle löschen" : "Delete all"}
                </button>
                <button type="button" onClick={() => setConfirmAll(false)} disabled={disabled} className={BTN_SM} style={outline}>
                  {de ? "Abbrechen" : "Cancel"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmAll(true)}
                disabled={disabled}
                className="text-xs font-medium"
                style={{ color: "var(--fg-muted)" }}
              >
                {de ? "Alle Zwischenstände löschen (nach dem Workshop)" : "Delete all snapshots (after the workshop)"}
              </button>
            ))}
        </div>
      </div>
    </section>
  );
}
