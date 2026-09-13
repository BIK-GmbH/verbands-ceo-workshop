import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import {
  Check,
  CircleCheck,
  CircleDashed,
  CircleMinus,
  CircleX,
  Copy,
  Loader2,
  Maximize,
  Mic,
  Minimize,
  Play,
  ShieldCheck,
  TriangleAlert,
  Type,
} from "lucide-react";
import type { Bilingual } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { useFontScale } from "@/lib/font-scale";
import { isDictationSupported, useDictation } from "@/lib/useDictation";
import {
  CHECKS,
  CHECK_GROUPS,
  CheckTimeout,
  DICTATION_LISTEN_MS,
  FONT_SCALE_NAME,
  MIC_LISTEN_MS,
  RECORDING_MS,
  checkBrowser,
  checkClaude,
  checkInternet,
  checkMicrophone,
  checkOffline,
  checkOpenAi,
  checkRecording,
  checkScreen,
  checkStorage,
  crashResult,
  dictationUnsupportedResult,
  formatReport,
  interpretDictation,
  micBlockedForDictationResult,
  micPermissionState,
  requestPersistentStorage,
  sessionRecordingActive,
  skippedForRecording,
  sleep,
  tally,
  timeoutResult,
  withTimeout,
  type CheckId,
  type CheckResult,
  type Verdict,
} from "@/lib/system-check";

/** Checks without microphone run side by side; the microphone ones strictly one after another. */
const PARALLEL: CheckId[] = ["browser", "storage", "offline", "screen", "internet", "claude", "openai"];
const SEQUENTIAL: CheckId[] = ["microphone", "dictation", "recording"];

/**
 * Status colours, scoped to this component so the global tokens stay untouched.
 * Light and dark variants each keep ≥ 4.5:1 on --bg and --bg-elev.
 */
const SCOPED_STYLE = `
.system-check { --sc-ok: #15803d; --sc-warn: #b45309; --sc-fail: #b91c1c; --sc-skipped: var(--fg-muted); }
[data-theme="dark"] .system-check { --sc-ok: #4ade80; --sc-warn: #fbbf24; --sc-fail: #f87171; }
`;

const VERDICT_COLOR: Record<Verdict | "open" | "running", string> = {
  ok: "var(--sc-ok)",
  warn: "var(--sc-warn)",
  fail: "var(--sc-fail)",
  skipped: "var(--sc-skipped)",
  open: "var(--border)",
  running: "var(--workshop-accent)",
};

const VERDICT_LABEL: Record<Verdict, Bilingual> = {
  ok: { de: "OK", en: "OK" },
  warn: { de: "Achtung", en: "Warning" },
  fail: { de: "Problem", en: "Problem" },
  skipped: { de: "Übersprungen", en: "Skipped" },
};

const BTN =
  "inline-flex items-center justify-center gap-1.5 rounded-md text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed";
const outline: CSSProperties = { border: "1px solid var(--border)", color: "var(--fg)", background: "var(--bg)" };
const muted: CSSProperties = { color: "var(--fg-muted)" };

type Prompt = { id: CheckId; text: Bilingual; endsAt: number };

function VerdictIcon({ verdict, running, size = 20 }: { verdict?: Verdict; running: boolean; size?: number }) {
  if (running) return <Loader2 size={size} className="animate-spin" style={{ color: VERDICT_COLOR.running }} aria-hidden />;
  if (!verdict) return <CircleDashed size={size} style={{ color: "var(--fg-muted)" }} aria-hidden />;
  const Icon = verdict === "ok" ? CircleCheck : verdict === "warn" ? TriangleAlert : verdict === "fail" ? CircleX : CircleMinus;
  return <Icon size={size} style={{ color: VERDICT_COLOR[verdict] }} aria-hidden />;
}

/**
 * Technik-Check: answers in about two minutes whether everything the workshop
 * depends on works on this device, with one concrete sentence per finding.
 * Self-contained — it can sit on its own route or inside the settings.
 */
export function SystemCheck() {
  const [lang] = useLang();
  const de = lang === "de";
  const [scale, setScale] = useFontScale();

  const [results, setResults] = useState<Partial<Record<CheckId, CheckResult>>>({});
  const [running, setRunning] = useState<ReadonlySet<CheckId>>(new Set());
  const [queued, setQueued] = useState<ReadonlySet<CheckId>>(new Set());
  const [allRunning, setAllRunning] = useState(false);
  const [lastRun, setLastRun] = useState<Date | null>(null);
  const [prompt, setPrompt] = useState<Prompt | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [level, setLevel] = useState(0);
  const [peak, setPeak] = useState(0);
  const [heard, setHeard] = useState("");
  const [report, setReport] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied" | "manual">("idle");
  const [persistDenied, setPersistDenied] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => !!document.fullscreenElement);
  const reportRef = useRef<HTMLDetailsElement>(null);

  // Current font step for the screen check without re-creating the runner.
  const scaleRef = useRef(scale);
  useEffect(() => {
    scaleRef.current = scale;
  }, [scale]);

  // ---- dictation probe: the app's own hook, nothing re-implemented
  const heardRef = useRef<string[]>([]);
  const dictation = useDictation((chunk) => {
    if (!chunk) return;
    heardRef.current.push(chunk);
    setHeard(heardRef.current.join(" "));
  });
  const dictRef = useRef(dictation);
  useEffect(() => {
    dictRef.current = dictation;
  });

  useEffect(() => {
    if (!prompt) return;
    const t = window.setInterval(() => setNowTick(Date.now()), 200);
    return () => window.clearInterval(t);
  }, [prompt]);

  useEffect(() => {
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  const probeDictation = useCallback(async (): Promise<CheckResult> => {
    if (!isDictationSupported()) return dictationUnsupportedResult();
    if (sessionRecordingActive()) return skippedForRecording({ de: "die Diktat-Probe", en: "the dictation test" });
    if ((await micPermissionState()) === "denied") return micBlockedForDictationResult();
    heardRef.current = [];
    setHeard("");
    try {
      const startedAt = Date.now();
      dictRef.current.start();
      await sleep(400);
      let listenedMs = 0;
      if (dictRef.current.listening) {
        setPrompt({ id: "dictation", text: { de: "Jetzt einen Satz sprechen", en: "Say a sentence now" }, endsAt: startedAt + DICTATION_LISTEN_MS });
        while (Date.now() - startedAt < DICTATION_LISTEN_MS && dictRef.current.listening) await sleep(100);
        listenedMs = Date.now() - startedAt;
        setPrompt(null);
        dictRef.current.stop();
        // The last recognised words arrive between stop() and the end event.
        const endBy = Date.now() + 3_000;
        while (Date.now() < endBy && dictRef.current.listening) await sleep(100);
      }
      return interpretDictation({ text: heardRef.current.join(" "), error: dictRef.current.error, listenedMs });
    } finally {
      setPrompt(null);
      if (dictRef.current.listening) dictRef.current.stop();
    }
  }, []);

  const execute = useCallback(
    async (id: CheckId): Promise<CheckResult> => {
      switch (id) {
        case "browser":
          return checkBrowser();
        case "storage":
          return checkStorage();
        case "offline":
          return checkOffline();
        case "screen":
          return checkScreen(scaleRef.current);
        case "internet":
          return checkInternet();
        case "claude":
          return checkClaude();
        case "openai":
          return checkOpenAi();
        case "microphone":
          setPeak(0);
          try {
            return await checkMicrophone({
              onListening: () =>
                setPrompt({ id, text: { de: "Jetzt sprechen", en: "Speak now" }, endsAt: Date.now() + MIC_LISTEN_MS }),
              onLevel: (l) => {
                setLevel(l);
                setPeak((p) => Math.max(p, l));
              },
            });
          } finally {
            setPrompt(null);
            setLevel(0);
          }
        case "dictation":
          return probeDictation();
        case "recording":
          try {
            return await checkRecording(() =>
              setPrompt({ id, text: { de: "Aufnahme läuft", en: "Recording" }, endsAt: Date.now() + RECORDING_MS }),
            );
          } finally {
            setPrompt(null);
          }
      }
    },
    [probeDictation],
  );

  const run = useCallback(
    async (id: CheckId) => {
      setRunning((s) => new Set(s).add(id));
      setQueued((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      let r: CheckResult;
      try {
        r = await withTimeout(execute(id), CHECKS[id].timeoutMs);
      } catch (err) {
        r = err instanceof CheckTimeout ? timeoutResult(id) : crashResult(id, err);
      }
      setResults((prev) => ({ ...prev, [id]: r }));
      setRunning((s) => {
        const next = new Set(s);
        next.delete(id);
        return next;
      });
      setCopyState("idle");
      return r;
    },
    [execute],
  );

  const runAll = useCallback(async () => {
    setAllRunning(true);
    setResults({});
    setCopyState("idle");
    setQueued(new Set(SEQUENTIAL));
    try {
      await Promise.all(PARALLEL.map((id) => run(id)));
      for (const id of SEQUENTIAL) await run(id);
    } finally {
      setQueued(new Set());
      setAllRunning(false);
      setLastRun(new Date());
    }
  }, [run]);

  const anyRunning = allRunning || running.size > 0;
  const micBusy = SEQUENTIAL.some((id) => running.has(id));

  async function copyReport() {
    const text = formatReport(results, lang);
    setReport(text);
    try {
      await navigator.clipboard.writeText(text);
      setCopyState("copied");
      return;
    } catch {
      /* clipboard API refused (permission or focus) — try the old way below */
    }
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    setCopyState(ok ? "copied" : "manual");
    if (!ok && reportRef.current) reportRef.current.open = true;
  }

  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen();
    } catch (err) {
      console.error("[system-check] full screen toggle failed", err);
    }
  }

  async function protectStorage() {
    const granted = await requestPersistentStorage();
    setPersistDenied(!granted);
    await run("storage");
  }

  // ---- summary
  const t = tally(results);
  const checkedCount = t.ok + t.warn + t.fail + t.skipped;
  const overall: { verdict?: Verdict; text: Bilingual } = anyRunning
    ? { text: { de: "Prüfung läuft …", en: "Checking …" } }
    : checkedCount === 0
      ? { text: { de: "Noch nicht geprüft", en: "Not checked yet" } }
      : t.fail > 0
        ? { verdict: "fail", text: { de: `${t.fail} ${t.fail === 1 ? "Problem" : "Probleme"} vor Beginn lösen`, en: `Fix ${t.fail} ${t.fail === 1 ? "problem" : "problems"} before starting` } }
        : t.warn > 0
          ? { verdict: "warn", text: { de: "Einsatzbereit, mit Hinweisen", en: "Ready, with notes" } }
          : t.open > 0
            ? { verdict: "ok", text: { de: "Bisher alles in Ordnung", en: "All fine so far" } }
            : { verdict: "ok", text: { de: "Alles bereit", en: "All set" } };

  const secondsLeft = prompt ? Math.max(0, Math.ceil((prompt.endsAt - nowTick) / 1000)) : 0;

  function renderExtras(id: CheckId, r: CheckResult | undefined, isRunning: boolean): ReactNode {
    if (id === "microphone" && (isRunning || peak > 0)) {
      return (
        <div className="mt-2.5 flex items-center gap-3" data-testid="syscheck-mic-meter">
          <Mic size={15} style={muted} aria-hidden />
          <div
            className="relative h-2.5 flex-1 max-w-sm rounded-full overflow-hidden"
            style={{ background: "color-mix(in oklch, var(--fg) 10%, transparent)" }}
            role="meter"
            aria-label={de ? "Mikrofonpegel" : "Microphone level"}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(level * 100)}
            data-peak={Math.round(peak * 100)}
          >
            <div
              className="absolute inset-y-0 left-0 rounded-full"
              style={{ width: `${Math.round(level * 100)}%`, background: "var(--workshop-accent)", transition: "width 60ms linear" }}
            />
            {peak > 0 && (
              <div className="absolute inset-y-0 w-0.5" style={{ left: `${Math.round(peak * 100)}%`, background: "var(--fg)" }} />
            )}
          </div>
        </div>
      );
    }
    if (id === "dictation" && (isRunning || (heard && !r))) {
      return (
        <p className="mt-2.5 text-sm italic" style={heard ? { color: "var(--fg)" } : muted} data-testid="syscheck-dictation-live">
          {heard ? `„${heard}“` : de ? "Noch nichts erkannt …" : "Nothing recognised yet …"}
        </p>
      );
    }
    if (id === "screen" && r) {
      const rec = r.recommendedScale;
      return (
        <div className="mt-2.5 flex flex-wrap gap-2">
          {rec && rec !== scale && (
            <button
              type="button"
              className={`${BTN} px-2.5 py-1`}
              style={outline}
              onClick={() => {
                setScale(rec);
                scaleRef.current = rec;
                void run("screen");
              }}
            >
              <Type size={14} aria-hidden />
              {de ? `Schriftstufe „${FONT_SCALE_NAME[rec].de}“ übernehmen` : `Apply font step “${FONT_SCALE_NAME[rec].en}”`}
            </button>
          )}
          {document.fullscreenEnabled && (
            <button type="button" className={`${BTN} px-2.5 py-1`} style={outline} onClick={() => void toggleFullscreen()}>
              {isFullscreen ? <Minimize size={14} aria-hidden /> : <Maximize size={14} aria-hidden />}
              {isFullscreen ? (de ? "Vollbild beenden" : "Exit full screen") : de ? "Vollbild testen" : "Try full screen"}
            </button>
          )}
        </div>
      );
    }
    if (id === "storage" && r?.canRequestPersistence) {
      return (
        <div className="mt-2.5 space-y-1.5">
          <button type="button" className={`${BTN} px-2.5 py-1`} style={outline} onClick={() => void protectStorage()} disabled={anyRunning}>
            <ShieldCheck size={14} aria-hidden />
            {de ? "Speicher schützen" : "Protect storage"}
          </button>
          {persistDenied && (
            <p className="text-xs" style={muted}>
              {de
                ? "Der Browser hat den Schutz abgelehnt. Oft hilft es, die App zu installieren oder als Lesezeichen zu speichern; die tägliche Sicherung bleibt Pflicht."
                : "The browser declined. Installing the app or bookmarking it often helps; the daily backup remains a must."}
            </p>
          )}
        </div>
      );
    }
    return null;
  }

  return (
    <section className="system-check space-y-5" aria-labelledby="system-check-heading" data-testid="system-check">
      <style>{SCOPED_STYLE}</style>

      {/* ------------------------------------------------------------ summary */}
      <div
        className="rounded-xl p-5 flex flex-wrap items-center gap-x-6 gap-y-4"
        style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <VerdictIcon verdict={overall.verdict} running={anyRunning} size={30} />
          <div className="min-w-0">
            <h2 id="system-check-heading" className="text-lg font-semibold leading-tight" data-testid="syscheck-overall">
              {overall.text[lang]}
            </h2>
            <p className="text-xs mt-1" style={muted} data-testid="syscheck-tally">
              {checkedCount === 0 && !anyRunning
                ? de
                  ? "Dauert etwa eine Minute. Bei Mikrofon, Diktat und Aufnahme bitte sprechen."
                  : "Takes about a minute. Please speak during microphone, dictation and recording."
                : [
                    `${t.ok} OK`,
                    `${t.warn} ${de ? "Achtung" : t.warn === 1 ? "warning" : "warnings"}`,
                    `${t.fail} ${de ? (t.fail === 1 ? "Problem" : "Probleme") : t.fail === 1 ? "problem" : "problems"}`,
                    t.skipped ? `${t.skipped} ${de ? "übersprungen" : "skipped"}` : "",
                    t.open ? `${t.open} ${de ? "offen" : "open"}` : "",
                    lastRun && !anyRunning
                      ? `${de ? "zuletzt" : "last"} ${lastRun.toLocaleTimeString(de ? "de-DE" : "en-GB", { hour: "2-digit", minute: "2-digit" })}`
                      : "",
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void runAll()}
            disabled={anyRunning}
            className={`${BTN} px-4 py-2`}
            style={{ background: "var(--workshop-accent)", color: "white" }}
            data-testid="syscheck-run-all"
          >
            {allRunning ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <Play size={16} aria-hidden />}
            {de ? "Alles prüfen" : "Check everything"}
          </button>
          <button
            type="button"
            onClick={() => void copyReport()}
            disabled={anyRunning || checkedCount === 0}
            className={`${BTN} px-4 py-2`}
            style={outline}
            data-testid="syscheck-copy"
          >
            {copyState === "copied" ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
            {copyState === "copied" ? (de ? "Kopiert" : "Copied") : de ? "Ergebnis kopieren" : "Copy result"}
          </button>
        </div>
      </div>

      {/* ------------------------------------------------------------- groups */}
      {CHECK_GROUPS.map((group) => (
        <div key={group.id} className="space-y-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider px-1" style={muted}>
            {group.title[lang]}
          </h3>
          <ul className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)", background: "var(--bg)" }}>
            {group.checks.map((id, i) => {
              const meta = CHECKS[id];
              const r = results[id];
              const isRunning = running.has(id);
              const isQueued = queued.has(id);
              const color = isRunning ? VERDICT_COLOR.running : r ? VERDICT_COLOR[r.verdict] : VERDICT_COLOR.open;
              const disabled = allRunning || isRunning || (meta.usesMic && micBusy);
              return (
                <li
                  key={id}
                  className="flex gap-3.5 px-4 py-3.5"
                  style={{
                    borderTop: i === 0 ? undefined : "1px solid var(--border)",
                    boxShadow: `inset 3px 0 0 ${color}`,
                  }}
                  data-testid={`syscheck-row-${id}`}
                  data-verdict={isRunning ? "running" : (r?.verdict ?? "open")}
                >
                  <div className="pt-0.5">
                    <VerdictIcon verdict={r?.verdict} running={isRunning} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
                      <span className="font-semibold">{meta.title[lang]}</span>
                      {r && !isRunning && (
                        <span className="text-xs font-semibold uppercase tracking-wide" style={{ color: VERDICT_COLOR[r.verdict] }}>
                          {VERDICT_LABEL[r.verdict][lang]}
                        </span>
                      )}
                    </div>

                    {isRunning && prompt?.id === id ? (
                      <p className="text-sm mt-1 font-medium" style={{ color: "var(--workshop-accent)" }} role="status" data-testid="syscheck-prompt">
                        {prompt.text[lang]} · {secondsLeft} s
                      </p>
                    ) : isRunning ? (
                      <p className="text-sm mt-1" style={muted} role="status">
                        {meta.usesMic
                          ? de
                            ? "Wartet auf das Mikrofon – ggf. oben links „Zulassen“ klicken …"
                            : "Waiting for the microphone – click “Allow” at the top left if asked …"
                          : de
                            ? "Wird geprüft …"
                            : "Checking …"}
                      </p>
                    ) : r ? (
                      <>
                        <p className="text-sm mt-1" data-testid={`syscheck-finding-${id}`}>
                          {r.finding[lang]}
                        </p>
                        {r.action && (
                          <p
                            className={`text-sm mt-1 ${r.verdict === "ok" ? "" : "font-medium"}`}
                            style={{ color: r.verdict === "ok" ? "var(--fg-muted)" : "var(--fg)" }}
                            data-testid={`syscheck-action-${id}`}
                          >
                            <span aria-hidden style={{ color: VERDICT_COLOR[r.verdict] }}>→ </span>
                            {r.action[lang]}
                          </p>
                        )}
                        {r.facts && r.facts.length > 0 && (
                          <p className="text-xs mt-1.5 leading-relaxed" style={muted}>
                            {r.facts.map((f) => f[lang]).join(" · ")}
                          </p>
                        )}
                      </>
                    ) : (
                      <p className="text-sm mt-1" style={muted}>
                        {isQueued ? (de ? "Gleich an der Reihe – dann bitte sprechen." : "Up next – please speak then.") : meta.what[lang]}
                      </p>
                    )}

                    {renderExtras(id, r, isRunning)}
                  </div>
                  <div className="shrink-0">
                    <button
                      type="button"
                      onClick={() => void run(id)}
                      disabled={disabled}
                      className={`${BTN} px-3 py-1.5`}
                      style={outline}
                      data-testid={`syscheck-run-${id}`}
                    >
                      {r ? (de ? "Erneut" : "Again") : de ? "Prüfen" : "Check"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      ))}

      {/* ------------------------------------------------------------- report */}
      {report && (
        <details ref={reportRef} className="rounded-xl px-4 py-3" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}>
          <summary className="cursor-pointer text-sm font-medium">
            {copyState === "manual"
              ? de
                ? "Kopieren war nicht möglich: Text hier markieren und kopieren"
                : "Copying was not possible: select and copy the text here"
              : de
                ? "Kopierten Text ansehen"
                : "View copied text"}
          </summary>
          <pre className="mt-3 text-xs whitespace-pre-wrap font-mono leading-relaxed" style={muted} data-testid="syscheck-report">
            {report}
          </pre>
        </details>
      )}
    </section>
  );
}
