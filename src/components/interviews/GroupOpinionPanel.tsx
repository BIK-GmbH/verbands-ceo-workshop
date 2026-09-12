import { useEffect, useMemo, useState } from "react";
import { Loader2, Pencil, Upload, Users } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useApiKey } from "@/lib/ai-assist";
import { opinionFingerprint, setGroupOpinion, useGroupOpinion, type GroupOpinion, type Interview } from "@/lib/interview-store";
import {
  removeGroupMetricsFromProtocol,
  summarizeGroup,
  writeGroupMetricsToProtocol,
  writeGroupToProtocol,
} from "@/lib/interview-opinion";
import {
  AGREEMENT_LABEL,
  GAP_LABEL,
  SCALE_BY_ID,
  aggregateScales,
  formatNumber,
  formatSigned,
  metricsProtocolText,
  scaleRange,
  type GroupMetrics,
  type ScaleStats,
} from "@/lib/interview-metrics";
import { describeProcessingError } from "./errors";
import { Tooltip } from "@/components/ui/Tooltip";
import { BTN, BTN_SM, MiniMarkdown, Notice, accentOutline, card, field, formatDate, muted, outline, primary } from "./ui";

/** Anonymous synthesis over all per-interview opinions, written to the protocol as one entry. */
export function GroupOpinionPanel({ interviews, lang }: { interviews: Interview[]; lang: Lang }) {
  const de = lang === "de";
  const group = useGroupOpinion();
  const claudeKey = useApiKey();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [draft, setDraft] = useState<string | null>(null);

  const summarized = interviews.filter((iv) => iv.opinion?.trim());
  const metrics = useMemo(() => aggregateScales(interviews.map((iv) => iv.scales)), [interviews]);
  const metricsText = useMemo(() => metricsProtocolText(metrics), [metrics]);
  const hasMetrics = metrics.withScales > 0;
  const fingerprint = opinionFingerprint(interviews);
  const outdated = Boolean(group) && group?.basedOn !== fingerprint;
  const inProtocol = Boolean(group) && group?.protocolText === group?.text;

  // The figures are derived data, so they follow every change into the protocol
  // on their own — no button, no second AI call.
  useEffect(() => {
    try {
      if (hasMetrics) writeGroupMetricsToProtocol(metricsText);
      else removeGroupMetricsFromProtocol();
    } catch (err) {
      console.error("[interviews] writing the group figures to the protocol failed", err);
    }
  }, [hasMetrics, metricsText]);

  function persist(next: GroupOpinion, toProtocol: boolean): boolean {
    try {
      if (toProtocol) {
        writeGroupToProtocol(next.text);
        next = { ...next, protocolText: next.text };
      }
      setGroupOpinion(next);
      return true;
    } catch (err) {
      console.error("[interviews] saving the group opinion failed", err);
      setError(de ? "Das gemeinsame Meinungsbild konnte nicht gespeichert werden." : "The group opinion picture could not be saved.");
      return false;
    }
  }

  async function create() {
    if (busy || !summarized.length) return;
    if (
      group &&
      !window.confirm(
        de
          ? "Das bestehende gemeinsame Meinungsbild (inkl. eigener Änderungen) wird ersetzt und ins Protokoll übernommen. Fortfahren?"
          : "The existing group opinion picture (incl. your edits) will be replaced and written to the record. Continue?",
      )
    ) {
      return;
    }
    setBusy(true);
    setError("");
    setNotice("");
    try {
      // The computed figures go along, so the text matches the numbers.
      const text = await summarizeGroup(
        summarized.map((iv) => iv.opinion ?? ""),
        metricsText,
      );
      const ok = persist(
        { text, updatedAt: new Date().toISOString(), basedOn: fingerprint, count: summarized.length },
        true,
      );
      if (ok) {
        setDraft(null);
        setNotice(
          de
            ? "Gemeinsames Meinungsbild erstellt und automatisch ins Protokoll übernommen (Folie 01.02)."
            : "Group opinion picture created and automatically added to the record (slide 01.02).",
        );
      }
    } catch (err) {
      setError(describeProcessingError(err, "group", lang));
    } finally {
      setBusy(false);
    }
  }

  function saveDraft() {
    if (!group || draft === null) return;
    // An entry that was in sync stays in sync; otherwise the user decides via the button.
    if (persist({ ...group, text: draft }, inProtocol)) setDraft(null);
  }

  return (
    <section className="rounded-md p-3 sm:p-4 space-y-3" style={card} aria-labelledby="group-opinion-title" data-testid="group-opinion">
      <div className="flex flex-wrap items-center gap-2">
        <Users size={18} style={{ color: "var(--workshop-accent)" }} />
        <h2 id="group-opinion-title" className="text-lg font-semibold">
          {de ? "Gemeinsames Meinungsbild" : "Group opinion picture"}
        </h2>
        <span className="text-xs" style={muted}>
          {de
            ? `Basis: ${summarized.length} von ${interviews.length} Interviews mit Meinungsbild · anonymisiert`
            : `Based on ${summarized.length} of ${interviews.length} interviews with an opinion picture · anonymised`}
        </span>
      </div>

      <div className="flex flex-wrap gap-2">
        <Tooltip
          content={
            de
              ? "Claude verdichtet alle Einzel-Meinungsbilder anonymisiert zu einem Gesamtbild: Haltungen, häufigste Begriffe, Top-Herausforderungen, Spannungen und drei Kernaussagen als Diskussionsimpuls"
              : "Claude condenses all individual opinion pictures, anonymised, into a group picture: attitudes, frequent terms, top challenges, tensions and three key statements to spark discussion"
          }
        >
        <button type="button" onClick={create} disabled={busy || !summarized.length || !claudeKey} className={BTN} style={primary}>
          {busy ? <Loader2 size={16} className="animate-spin" /> : <Users size={16} />}
          {busy
            ? de
              ? "Erstelle Gesamtbild …"
              : "Creating …"
            : group
              ? de
                ? "Gesamtbild aktualisieren"
                : "Update group picture"
              : de
                ? "Gesamtbild erstellen"
                : "Create group picture"}
        </button>
        </Tooltip>
        {group && !inProtocol && (
          <button type="button" onClick={() => persist(group, true) && setNotice(de ? "Ins Protokoll übernommen." : "Added to the record.")} className={BTN} style={accentOutline}>
            <Upload size={16} /> {de ? "Ins Protokoll übernehmen" : "Add to record"}
          </button>
        )}
      </div>

      {!claudeKey && (
        <Notice tone="warn">{de ? "Für das Gesamtbild wird der Claude-Schlüssel benötigt (siehe Einrichtung)." : "The Claude key is needed for the group picture (see setup)."}</Notice>
      )}
      {summarized.length > 0 && summarized.length < 3 && (
        <Notice tone="warn">
          {de
            ? "Bei weniger als drei Interviews lassen sich Aussagen leicht einzelnen Personen zuordnen."
            : "With fewer than three interviews, statements can easily be attributed to individuals."}
        </Notice>
      )}
      {outdated && (
        <Notice tone="warn">
          {de
            ? "Seit der letzten Erstellung sind Meinungsbilder hinzugekommen oder geändert worden. Bitte aktualisieren."
            : "Opinion pictures were added or changed since the last run. Please update."}
        </Notice>
      )}
      {summarized.length > 0 && !hasMetrics && (
        <Notice tone="warn">
          {de
            ? "Zu keinem Interview liegen Skalenwerte vor – die Kennzahlen bleiben leer. In der Liste oben lassen sie sich nachtragen oder von Hand setzen."
            : "No interview carries scale values – the figures stay empty. You can derive or set them in the list above."}
        </Notice>
      )}
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

      {hasMetrics && <MetricsPanel metrics={metrics} lang={lang} />}

      {group ? (
        <div className="rounded-md p-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }}>
          <div className="text-[11px] mb-1 flex flex-wrap gap-x-2" style={muted}>
            <span>{formatDate(group.updatedAt, lang)}</span>
            <span>· {de ? `aus ${group.count} Interviews` : `from ${group.count} interviews`}</span>
            <span>· {inProtocol ? (de ? "im Protokoll" : "in the record") : de ? "nicht im Protokoll" : "not in the record"}</span>
          </div>
          {draft === null ? (
            <>
              <MiniMarkdown text={group.text} />
              <button type="button" onClick={() => setDraft(group.text)} className={`${BTN_SM} mt-2`} style={outline}>
                <Pencil size={12} /> {de ? "Bearbeiten" : "Edit"}
              </button>
            </>
          ) : (
            <div className="space-y-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={18}
                autoFocus
                className="w-full rounded-md p-2 text-sm leading-relaxed resize-y font-mono"
                style={field}
                aria-label={de ? "Gemeinsames Meinungsbild bearbeiten" : "Edit group opinion picture"}
              />
              <div className="flex flex-wrap gap-1.5 justify-end">
                <button type="button" onClick={() => setDraft(null)} className={BTN_SM} style={outline}>
                  {de ? "Abbrechen" : "Cancel"}
                </button>
                <button type="button" onClick={saveDraft} disabled={!draft.trim()} className={BTN_SM} style={primary}>
                  {inProtocol ? (de ? "Speichern & Protokoll aktualisieren" : "Save & update record") : de ? "Speichern" : "Save"}
                </button>
              </div>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm" style={muted}>
          {de
            ? "Sobald Meinungsbilder vorliegen, entsteht hier das anonyme Gesamtbild: Verteilung der Haltungen, häufigste Begriffe, Top-Herausforderungen und drei Kernaussagen als Diskussionsimpuls für Phase 1."
            : "Once opinion pictures exist, the anonymous group picture appears here: distribution of attitudes, most frequent terms, top challenges and three key statements to kick off phase 1."}
        </p>
      )}
    </section>
  );
}

/** Distribution, mean and spread per scale — computed locally from the stored scale values. */
function MetricsPanel({ metrics, lang }: { metrics: GroupMetrics; lang: Lang }) {
  const de = lang === "de";
  return (
    <div className="rounded-md p-3 space-y-3" style={{ background: "var(--bg)", border: "1px solid var(--border)" }} data-testid="group-metrics">
      <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <h3 className="text-sm font-semibold">{de ? "Kennzahlen" : "Figures"}</h3>
        <span className="text-[11px]" style={muted}>
          {de
            ? `aus ${metrics.withScales} von ${metrics.interviews} Interviews · im Browser gerechnet, ohne KI`
            : `from ${metrics.withScales} of ${metrics.interviews} interviews · computed in the browser, no AI`}
        </span>
      </div>

      {metrics.thin && (
        <Notice tone="warn">
          {de
            ? "Bislang nur ein oder zwei Angaben je Skala – die Werte sind ein Eindruck, keine Statistik."
            : "Only one or two values per scale so far – these figures are an impression, not statistics."}
        </Notice>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {metrics.scales.map((stat) => (
          <ScaleCard key={stat.id} stat={stat} lang={lang} />
        ))}
      </div>

      <div
        className="rounded-md p-2.5 flex flex-wrap items-baseline gap-x-2 gap-y-1"
        style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
        data-testid="metric-gap"
      >
        <span className="text-sm font-medium">{de ? "Lücke Relevanz heute → morgen" : "Gap relevance today → tomorrow"}</span>
        {metrics.gap === null || metrics.gapTrend === null ? (
          <span className="text-xs" style={muted}>
            {de ? "nicht berechenbar – Angaben fehlen" : "cannot be computed – values missing"}
          </span>
        ) : (
          <>
            <span className="text-base font-semibold" style={{ color: "var(--workshop-accent)" }}>
              {formatSigned(metrics.gap, lang)} {de ? "Stufen" : "steps"}
            </span>
            <span className="text-[11px]" style={muted}>
              {GAP_LABEL[metrics.gapTrend][lang]}
            </span>
          </>
        )}
      </div>

      <TermList title={de ? "Häufigste Begriffe" : "Most frequent terms"} terms={metrics.begriffe} accent testId="metric-terms" />
      <TermList
        title={de ? "Meistgenannte Einsatzgebiete" : "Most named areas of application"}
        terms={metrics.einsatzgebiete}
        testId="metric-areas"
      />
    </div>
  );
}

function ScaleCard({ stat, lang }: { stat: ScaleStats; lang: Lang }) {
  const de = lang === "de";
  const def = SCALE_BY_ID[stat.id];
  return (
    <div className="rounded-md p-2.5 space-y-1.5" style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }} data-testid={`metric-${stat.id}`}>
      <div className="flex flex-wrap items-baseline gap-x-2">
        <span className="text-sm font-medium">{def.label[lang]}</span>
        <span className="text-[11px]" style={muted}>
          {scaleRange(stat.id, lang)}
        </span>
      </div>
      {stat.mean === null ? (
        <p className="text-xs" style={muted}>
          {de ? "keine Angaben" : "no values"}
        </p>
      ) : (
        <>
          <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
            <span className="text-base font-semibold" style={{ color: "var(--workshop-accent)" }}>
              Ø {formatNumber(stat.mean, lang)}
            </span>
            <span className="text-[11px]" style={muted}>
              {de ? "von 4" : "of 4"}
            </span>
            <span className="text-[11px]" style={muted}>
              ·{" "}
              {stat.sd === null
                ? de
                  ? "Streuung erst ab zwei Angaben"
                  : "spread needs two values"
                : `σ ${formatNumber(stat.sd, lang, 2)} (${AGREEMENT_LABEL[stat.agreement ?? "mixed"][lang]})`}
            </span>
            <span className="text-[11px]" style={muted}>
              · {de ? "Spanne" : "range"} {stat.min}–{stat.max}
            </span>
            <span className="text-[11px]" style={muted}>
              · n = {stat.count}
            </span>
          </div>
          <ul className="space-y-0.5" aria-label={de ? `Verteilung ${def.label.de}` : `Distribution ${def.label.en}`}>
            {def.levels.map((level, i) => {
              const n = stat.distribution[i];
              return (
                <li key={level.de} className="grid items-center gap-2 text-[11px]" style={{ gridTemplateColumns: "minmax(0,7rem) 1fr 1.25rem" }}>
                  <span className="truncate" style={n ? undefined : muted}>
                    {level[lang]}
                  </span>
                  <span className="block h-1.5 rounded-full" style={{ background: "var(--border)" }}>
                    <span
                      className="block h-full rounded-full"
                      style={{ width: `${stat.count ? (n / stat.count) * 100 : 0}%`, background: "var(--workshop-accent)" }}
                    />
                  </span>
                  <span className="text-right tabular-nums">{n}</span>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}

function TermList({
  title,
  terms,
  accent,
  testId,
}: {
  title: string;
  terms: { term: string; count: number }[];
  accent?: boolean;
  testId: string;
}) {
  if (!terms.length) return null;
  return (
    <div className="space-y-1" data-testid={testId}>
      <div className="text-xs font-medium">{title}</div>
      <div className="flex flex-wrap gap-1">
        {terms.map((t) => (
          <span
            key={t.term}
            className="text-[11px] px-1.5 py-0.5 rounded-full"
            style={
              accent
                ? { background: "color-mix(in oklch, var(--workshop-accent) 12%, transparent)", color: "var(--workshop-accent)" }
                : { border: "1px solid var(--border)", color: "var(--fg-muted)" }
            }
          >
            {t.term} <span className="tabular-nums opacity-70">{t.count}</span>
          </span>
        ))}
      </div>
    </div>
  );
}
