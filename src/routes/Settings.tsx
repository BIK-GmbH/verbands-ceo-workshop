import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home, Info } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { lastSlidePath } from "@/lib/last-slide";
import { InterviewSetup } from "@/components/interviews/InterviewSetup";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Central place for the two AI keys. They used to be reachable only from inside the
 * protocol and interview pages, which facilitators could not find.
 */
export function Settings() {
  const [lang] = useLang();
  const de = lang === "de";
  const navigate = useNavigate();
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const goBack = () => (canGoBack ? navigate(-1) : navigate(lastSlidePath()));

  const facts = de
    ? [
        ["Claude-Key (Anthropic)", "Für Glätten und Umformulieren im Protokoll, den Ergebnisbericht, die Meinungsbilder der Interviews und das Verdichten der Poster. Erstellen unter console.anthropic.com → API Keys (beginnt mit „sk-ant-“)."],
        ["OpenAI-Key", "Nur für die Transkription der Interview-Aufnahmen. Erstellen unter platform.openai.com → API keys (beginnt mit „sk-“)."],
        ["Wo sie gespeichert werden", "Nur in diesem Browser auf diesem Gerät, nie auf einem Server und nie im Code. Sie bleiben über Updates der App hinweg erhalten, bis ihr sie hier entfernt oder die Browserdaten löscht. Im privaten Fenster gehen sie beim Schließen verloren."],
        ["Zweiter Rechner", "Jeder Rechner, auf dem transkribiert oder zusammengefasst wird, braucht die Keys separat. Ein Rechner, der nur aufnimmt und exportiert, braucht keine."],
        ["Nach dem Workshop", "Keys hier entfernen und in der jeweiligen Console sperren oder neu erzeugen. Tipp: einen eigenen Workspace mit Ausgabelimit nur für den Workshop anlegen."],
      ]
    : [
        ["Claude key (Anthropic)", "For polishing and rewording in the record, the results report, the interview opinion pictures and condensing posters. Create it at console.anthropic.com → API Keys (starts with “sk-ant-”)."],
        ["OpenAI key", "Only for transcribing interview recordings. Create it at platform.openai.com → API keys (starts with “sk-”)."],
        ["Where they are stored", "Only in this browser on this device, never on a server and never in the code. They survive app updates until you remove them here or clear the browser data. In a private window they are lost when it closes."],
        ["Second computer", "Every computer that transcribes or summarises needs the keys separately. A computer that only records and exports needs none."],
        ["After the workshop", "Remove the keys here and revoke or rotate them in the respective console. Tip: create a dedicated workspace with a spending limit just for the workshop."],
      ];

  return (
    <div style={{ background: "var(--bg)", color: "var(--fg)", minHeight: "100svh" }}>
      <header
        className="sticky top-0 z-10 flex items-center gap-2 sm:gap-3 px-4 sm:px-6 border-b"
        style={{ height: "var(--header-height)", background: "var(--bg)", color: "var(--fg)", borderColor: "var(--border)" }}
      >
        <button
          type="button"
          onClick={goBack}
          className="inline-flex items-center gap-2 text-sm font-medium rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_11%,transparent)]"
          style={{ background: "color-mix(in oklch, var(--fg) 6%, transparent)", border: "1px solid var(--border)" }}
        >
          <ArrowLeft size={18} /> {de ? "Zurück" : "Back"}
        </button>
        <Tooltip content={de ? "Zur Startseite des Workshops" : "To the workshop start page"}>
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm rounded-md px-2.5 h-9 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
            style={{ color: "var(--fg)" }}
            aria-label={de ? "Zur Startseite" : "To start"}
          >
            <Home size={16} /> <span className="hidden sm:inline">Start</span>
          </Link>
        </Tooltip>
        <div className="ml-auto text-sm font-semibold">{de ? "KI-Einstellungen" : "AI settings"}</div>
      </header>

      <main className="max-w-3xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--workshop-accent)" }}>
            {de ? "KI-Einstellungen" : "AI settings"}
          </h1>
          <p className="text-sm" style={{ color: "var(--fg-muted)" }}>
            {de
              ? "Hier tragt ihr die beiden API-Keys einmal pro Gerät ein. Ohne Keys funktioniert die App vollständig, nur die KI-Funktionen sind dann aus."
              : "Enter the two API keys here once per device. Without keys the app works fully, only the AI features are off."}
          </p>
        </div>

        <InterviewSetup lang={lang} />

        <section
          className="rounded-lg p-4 space-y-3 text-sm"
          style={{ background: "var(--bg-elev)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center gap-2 font-semibold">
            <Info size={16} style={{ color: "var(--workshop-accent)" }} />
            {de ? "Gut zu wissen" : "Good to know"}
          </div>
          <dl className="space-y-2.5">
            {facts.map(([term, text]) => (
              <div key={term}>
                <dt className="font-medium">{term}</dt>
                <dd style={{ color: "var(--fg-muted)" }}>{text}</dd>
              </div>
            ))}
          </dl>
        </section>
      </main>
    </div>
  );
}
