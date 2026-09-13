import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Home } from "lucide-react";
import { useLang } from "@/lib/i18n";
import { lastSlidePath } from "@/lib/last-slide";
import { Tooltip } from "@/components/ui/Tooltip";
import { SystemCheck } from "@/components/SystemCheck";

/** Route #/systemcheck: the tech check on its own page, for the morning before the workshop. */
export function SystemCheckPage() {
  const [lang, setLang] = useLang();
  const de = lang === "de";
  const navigate = useNavigate();
  const canGoBack = ((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0;
  const goBack = () => (canGoBack ? navigate(-1) : navigate(lastSlidePath()));

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
        <div className="ml-auto flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLang(de ? "en" : "de")}
            className="text-xs font-semibold rounded-md px-2 h-8 transition-colors hover:bg-[color-mix(in_oklch,var(--fg)_8%,transparent)]"
            style={{ border: "1px solid var(--border)" }}
            aria-label={de ? "Switch to English" : "Auf Deutsch umschalten"}
            data-testid="syscheck-lang"
          >
            {de ? "EN" : "DE"}
          </button>
          <span className="text-sm font-semibold">{de ? "Technik-Check" : "Tech check"}</span>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-5 sm:px-8 py-8 space-y-6">
        <div>
          <h1 className="text-3xl font-semibold mb-2" style={{ color: "var(--workshop-accent)" }}>
            {de ? "Technik-Check" : "Tech check"}
          </h1>
          <p className="text-sm max-w-2xl" style={{ color: "var(--fg-muted)" }}>
            {de
              ? "Vor Beginn einmal auf dem Laptop am Beamer durchlaufen lassen, im Tagungsraum und im WLAN, das wir dort nutzen. Jede Zeile sagt, was gefunden wurde und was zu tun ist."
              : "Run it once before starting, on the laptop at the projector, in the meeting room and on the Wi-Fi we use there. Each row says what was found and what to do."}
          </p>
        </div>
        <SystemCheck />
      </main>
    </div>
  );
}
