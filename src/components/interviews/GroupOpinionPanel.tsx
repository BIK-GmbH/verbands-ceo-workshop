import { useState } from "react";
import { Loader2, Pencil, Upload, Users } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useApiKey } from "@/lib/ai-assist";
import { opinionFingerprint, setGroupOpinion, useGroupOpinion, type GroupOpinion, type Interview } from "@/lib/interview-store";
import { summarizeGroup, writeGroupToProtocol } from "@/lib/interview-opinion";
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
  const fingerprint = opinionFingerprint(interviews);
  const outdated = Boolean(group) && group?.basedOn !== fingerprint;
  const inProtocol = Boolean(group) && group?.protocolText === group?.text;

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
      const text = await summarizeGroup(summarized.map((iv) => iv.opinion ?? ""));
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
      {notice && <Notice tone="ok">{notice}</Notice>}
      {error && <Notice tone="error">{error}</Notice>}

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
