import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { Plus, Trash2, Users } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { useWorkshopMeta } from "@/lib/useWorkshop";
import {
  type Participant,
  addParticipant,
  filledParticipants,
  importLegacyParticipants,
  removeParticipant,
  updateParticipant,
} from "@/lib/workshop-store";
import type { Lang } from "@/types/slide";

type Field = Exclude<keyof Participant, "id">;
const FIELDS: Field[] = ["lastName", "firstName", "organisation", "role"];

const STR = {
  de: {
    title: "Teilnehmende",
    lastName: "Name",
    firstName: "Vorname",
    organisation: "Organisation",
    role: "Rolle",
    add: "Person hinzufügen",
    remove: "Person entfernen",
    empty: "Noch niemand eingetragen.",
    legacy: "Bisheriger Freitext:",
    import: "In Liste übernehmen",
    count: (n: number) => (n === 1 ? "1 Person" : `${n} Personen`),
  },
  en: {
    title: "Participants",
    lastName: "Last name",
    firstName: "First name",
    organisation: "Organisation",
    role: "Role",
    add: "Add person",
    remove: "Remove person",
    empty: "Nobody entered yet.",
    legacy: "Previous free text:",
    import: "Move to list",
    count: (n: number) => (n === 1 ? "1 person" : `${n} people`),
  },
} as const;

const ROLE_SUGGESTIONS: Record<Lang, string[]> = {
  de: ["Vorstand", "Geschäftsführung", "Geschäftsstelle", "Mitgliedsunternehmen", "Ausschuss", "Moderation", "Gast"],
  en: ["Board", "Management", "Head office", "Member company", "Committee", "Facilitation", "Guest"],
};

interface Props {
  /** Plain table without inputs — used by the linear print view (/print, PDF export). */
  readOnly?: boolean;
}

/**
 * Structured participant list (last name · first name · organisation · role).
 * Backed by `meta.participantsList` in the workshop store, so the same list shows
 * on slide 00.04, in /protokoll and in the protocol/report exports.
 */
export function ParticipantsEditor({ readOnly = false }: Props) {
  const [lang] = useLang();
  const [meta] = useWorkshopMeta();
  const s = STR[lang];
  const list = meta.participantsList;
  const count = filledParticipants(list).length;

  if (readOnly) return <ReadOnlyTable list={filledParticipants(list)} lang={lang} />;

  const legacy = meta.participants.trim();

  return (
    <div
      className="my-4 rounded-md border p-4"
      style={{
        borderColor: "var(--workshop-accent)",
        background: "color-mix(in oklch, var(--workshop-accent) 4%, transparent)",
        color: "var(--fg)",
      }}
    >
      <div className="flex items-center gap-2 mb-3">
        <Users size={16} style={{ color: "var(--workshop-accent)" }} aria-hidden />
        <span className="text-sm font-semibold">{s.title}</span>
        <span
          className="ml-auto text-xs px-2 py-0.5 rounded-full"
          style={{ background: "color-mix(in oklch, var(--workshop-accent) 14%, transparent)", color: "var(--workshop-accent)" }}
          aria-live="polite"
        >
          {s.count(count)}
        </span>
      </div>

      {list.length === 0 && legacy && (
        <div
          className="mb-3 rounded-md p-3 text-sm flex flex-wrap items-center gap-2"
          style={{ background: "var(--bg-elev)", border: "1px dashed var(--border)" }}
        >
          <span className="flex-1 min-w-0" style={{ color: "var(--fg-muted)" }}>
            {s.legacy} <span style={{ color: "var(--fg)" }}>{legacy}</span>
          </span>
          <button
            type="button"
            onClick={importLegacyParticipants}
            className="text-xs font-medium px-2.5 py-1.5 rounded-md shrink-0"
            style={{ background: "var(--workshop-accent)", color: "white" }}
          >
            {s.import}
          </button>
        </div>
      )}

      <EditableRows list={list} lang={lang} />
    </div>
  );
}

function EditableRows({ list, lang }: { list: Participant[]; lang: Lang }) {
  const s = STR[lang];
  const datalistId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  // Row to focus after the next render (a freshly added person).
  const [focusId, setFocusId] = useState<string | null>(null);

  useEffect(() => {
    if (!focusId) return;
    containerRef.current?.querySelector<HTMLInputElement>(`input[data-pid="${focusId}"][data-col="0"]`)?.focus();
    setFocusId(null);
  }, [focusId, list]);

  const add = () => setFocusId(addParticipant().id);

  // Enter moves to the next field; in the last column it jumps to the next row or appends one.
  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>, rowIndex: number, col: number) => {
    if (e.key !== "Enter" || e.nativeEvent.isComposing) return;
    e.preventDefault();
    const row = list[rowIndex];
    if (col < FIELDS.length - 1) {
      containerRef.current
        ?.querySelector<HTMLInputElement>(`input[data-pid="${row.id}"][data-col="${col + 1}"]`)
        ?.focus();
      return;
    }
    const next = list[rowIndex + 1];
    if (next) setFocusId(next.id);
    else add();
  };

  const inputStyle = { background: "var(--bg)", border: "1px solid var(--border)", color: "var(--fg)" };

  return (
    <div ref={containerRef}>
      <datalist id={datalistId}>
        {ROLE_SUGGESTIONS[lang].map((r) => (
          <option key={r} value={r} />
        ))}
      </datalist>

      {list.length > 0 && (
        <div
          className="hidden sm:grid grid-cols-[1fr_1fr_1.25fr_1.25fr_2.25rem] gap-1.5 px-0.5 mb-1 text-[11px] uppercase tracking-wider"
          style={{ color: "var(--fg-muted)" }}
          aria-hidden
        >
          {FIELDS.map((f) => (
            <span key={f}>{s[f]}</span>
          ))}
          <span />
        </div>
      )}

      <ul className="space-y-2 sm:space-y-1.5">
        {list.map((p, i) => (
          <li
            key={p.id}
            className="grid grid-cols-2 gap-2 p-3 rounded-md border sm:grid-cols-[1fr_1fr_1.25fr_1.25fr_2.25rem] sm:gap-1.5 sm:p-0 sm:border-0 sm:rounded-none sm:items-center"
            style={{ borderColor: "var(--border)", background: "var(--bg-elev)" }}
          >
            {FIELDS.map((f, col) => (
              <label key={f} className={f === "organisation" || f === "role" ? "col-span-2 sm:col-span-1 min-w-0" : "min-w-0"}>
                <span className="sm:hidden block mb-0.5 text-[10px] uppercase tracking-wider" style={{ color: "var(--fg-muted)" }}>
                  {s[f]}
                </span>
                <input
                  type="text"
                  value={p[f]}
                  onChange={(e) => updateParticipant(p.id, { [f]: e.target.value })}
                  onKeyDown={(e) => onKeyDown(e, i, col)}
                  list={f === "role" ? datalistId : undefined}
                  autoComplete="off"
                  aria-label={`${s[f]} (${i + 1})`}
                  data-pid={p.id}
                  data-col={col}
                  className="w-full rounded-md px-2 py-1.5 text-sm"
                  style={inputStyle}
                />
              </label>
            ))}
            <button
              type="button"
              onClick={() => removeParticipant(p.id)}
              className="col-span-2 justify-self-end sm:col-span-1 sm:justify-self-center inline-flex items-center gap-1 text-xs sm:size-8 sm:justify-center rounded-md px-2 py-1 sm:p-0 transition-colors hover:bg-[color-mix(in_oklch,#dc2626_10%,transparent)]"
              style={{ color: "#dc2626", border: "1px solid var(--border)" }}
              title={s.remove}
              aria-label={`${s.remove} (${i + 1})`}
            >
              <Trash2 size={14} />
              <span className="sm:hidden">{s.remove}</span>
            </button>
          </li>
        ))}
      </ul>

      {list.length === 0 && (
        <p className="text-sm mb-1" style={{ color: "var(--fg-muted)" }}>
          {s.empty}
        </p>
      )}

      <button
        type="button"
        onClick={add}
        className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-md"
        style={{ border: "1px solid var(--workshop-accent)", color: "var(--workshop-accent)", background: "var(--bg)" }}
      >
        <Plus size={15} /> {s.add}
      </button>
    </div>
  );
}

/** Print variant: neutral colours because the print view is always black on white. */
function ReadOnlyTable({ list, lang }: { list: Participant[]; lang: Lang }) {
  const s = STR[lang];
  const cell = { border: "1px solid #d1d5db", padding: "4px 8px", textAlign: "left" as const, verticalAlign: "top" as const };
  return (
    <div className="my-4 text-sm">
      <div className="font-semibold mb-1">
        {s.title} · {s.count(list.length)}
      </div>
      {list.length === 0 ? (
        <p className="italic" style={{ color: "#6b7280" }}>
          {s.empty}
        </p>
      ) : (
        <table style={{ borderCollapse: "collapse", width: "100%" }}>
          <thead>
            <tr>
              {FIELDS.map((f) => (
                <th key={f} style={{ ...cell, background: "#f3f4f6", fontWeight: 600 }}>
                  {s[f]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {list.map((p) => (
              <tr key={p.id}>
                {FIELDS.map((f) => (
                  <td key={f} style={cell}>
                    {p[f] || "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
