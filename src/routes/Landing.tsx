import { Link } from "react-router-dom";
import { ArrowRight, CalendarDays, ClipboardList, Play, Users, Layers, LogOut } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import { logout } from "@/components/LoginGate";
import { MANIFEST, ALL_SLIDES } from "@/lib/slides";
import "@/styles/landing.css";

const BASE = import.meta.env.BASE_URL;
const FIRST = ALL_SLIDES[0].id;

/* The landing page is always dark (night hero). Red from the agenda sheets as the only accent;
 * RED is for filled surfaces with white text, RED_LIGHT for red text on the dark ground. */
const ANTHRAZIT = "#181A27";
const NIGHT = "#111218";
const RED = "#CD184B";
const RED_LIGHT = "#EE4D6C";

const COPY = {
  de: {
    eyebrow: "Zweitages-Workshop · Fachverband Betonbohren und -sägen Deutschland e. V.",
    titleA: "KI-Geschäftsführer:",
    titleB: "Fiktion oder Realität?",
    lead: "Zwei Tage, eine ehrliche Frage: Was kann KI in der Verbandsarbeit des FBS heute wirklich leisten? Wir prüfen gemeinsam und ergebnisoffen, ob und wie ein KI-Geschäftsführer den Verband entlasten kann, in einer Geschäftsstelle mit weniger Köpfen und kaum weniger Aufgaben.",
    start: "Workshop starten",
    present: "Präsentieren",
    protocol: "Protokoll",
    facts: [
      { icon: CalendarDays, label: "Termin", value: "16. und 17. September 2026" },
      { icon: Layers, label: "Format", value: "Zweitages-Workshop, interaktiv" },
      { icon: Users, label: "Mit", value: "Vertretern des Fachverbandes" },
    ],
    hosts: "Veranstalter",
    moderation: "Moderation",
    expert: "Experteninput",
    whyTitle: "Warum dieser Workshop",
    why: [
      {
        k: "Weniger Köpfe, gleiche Aufgaben",
        v: "Früher trugen zwei Geschäftsführer und deutlich mehr Assistenz die Verbandsarbeit. Aus Kostengründen ist die Geschäftsstelle schlanker geworden, die Aufgaben sind es nicht.",
      },
      {
        k: "Skepsis ernst nehmen",
        v: "Das Projekt Wilma hat Digitalisierung schon einmal versucht, ohne Akzeptanz zu schaffen. Deshalb heißt die Devise diesmal: prüfen statt versprechen.",
      },
    ],
    modulesTitle: "Der Weg durch die zwei Tage",
    visualEyebrow: "Fiktion oder Realität?",
    visualTitle: "Zukunft auf festem Grund",
    visualText:
      "KI ersetzt weder das Handwerk noch die Erfahrung der Branche. Wenn, dann baut sie darauf auf: auf dem Wissen, den Regelwerken und den Prozessen, die der FBS über Jahrzehnte geschaffen hat. In zwei Tagen prüfen wir gemeinsam, ob und wo daraus echte Entlastung werden kann.",
    visualAlt: "Zukunft auf festem Grund – Innovation, KI, Beton, gemeinsam stärker",
    tags: ["Innovation", "KI", "Beton", "Gemeinsam stärker"],
    day1: "Tag 1",
    day2: "Tag 2",
    module: "Modul",
  },
  en: {
    eyebrow: "Two-day workshop · Fachverband Betonbohren und -sägen Deutschland e. V.",
    titleA: "AI managing director:",
    titleB: "fiction or reality?",
    lead: "Two days, one honest question: what can AI really deliver in the FBS's association work today? Together and with an open outcome, we examine whether and how an AI managing director could relieve the association, in an office with fewer people and hardly fewer tasks.",
    start: "Start workshop",
    present: "Present",
    protocol: "Record",
    facts: [
      { icon: CalendarDays, label: "Date", value: "16–17 September 2026" },
      { icon: Layers, label: "Format", value: "Two-day workshop, interactive" },
      { icon: Users, label: "With", value: "Representatives of the association" },
    ],
    hosts: "Hosts",
    moderation: "Facilitation",
    expert: "Expert input",
    whyTitle: "Why this workshop",
    why: [
      {
        k: "Fewer people, same tasks",
        v: "Two managing directors and considerably more assistance used to carry the association's work. For cost reasons the office has become leaner, the workload has not.",
      },
      {
        k: "Taking scepticism seriously",
        v: "The Wilma project already tried digitalisation once without building acceptance. So this time the motto is: examine instead of promise.",
      },
    ],
    modulesTitle: "The path through the two days",
    visualEyebrow: "Fiction or reality?",
    visualTitle: "A future on solid ground",
    visualText:
      "AI replaces neither the craft nor the industry's experience. If anything, it builds on them: on the knowledge, rulebooks and processes the FBS has created over decades. In two days we examine together whether and where this can turn into real relief.",
    visualAlt: "A future on solid ground – innovation, AI, concrete, stronger together",
    tags: ["Innovation", "AI", "Concrete", "Stronger together"],
    day1: "Day 1",
    day2: "Day 2",
    module: "Module",
  },
} as const;

/** Host groups: Harald Ostermann (Innovationswerkstatt & DMS) and Dr. Stefan Reinheimer (BIK) facilitate together. */
const HOSTS = [
  {
    key: "iw-dms",
    role: "moderation" as const,
    org: "Innovationswerkstatt & Digital Management School",
    person: "Harald Ostermann",
    logos: [
      { src: "brand/innovationswerkstatt-white.png", alt: "Innovationswerkstatt", height: 20 },
      { src: "brand/dms-logo-white.png", alt: "Digital Management School", height: 38 },
    ],
  },
  {
    key: "bik",
    role: "moderation" as const,
    org: "BIK GmbH",
    person: "Dr. Stefan Reinheimer",
    logos: [{ src: "brand/bik-logo-white.svg", alt: "BIK GmbH", height: 38 }],
  },
];

/** Modules 0–3 run on day 1, 4–7 on day 2 (see agenda slide 00.05). */
const DAY1_LAST_MODULE = 3;

export function Landing() {
  const [lang, setLang] = useLang();
  const c = COPY[lang];
  const modules = MANIFEST.filter((m) => m.index !== 99);

  return (
    <div className="min-h-screen" style={{ background: NIGHT, color: "white" }}>
      {/* ── Hero ─────────────────────────────────────────────── */}
      <section className="relative isolate overflow-hidden min-h-[100svh] flex flex-col">
        <img
          src={`${BASE}brand/hero-ki-beton.webp`}
          alt=""
          aria-hidden
          className="landing-hero-img absolute inset-0 -z-20 size-full object-cover"
          style={{ objectPosition: "70% center" }}
        />
        <div
          aria-hidden
          className="absolute inset-0 -z-10"
          style={{
            background: `linear-gradient(90deg, ${NIGHT} 0%, ${NIGHT}f2 28%, ${NIGHT}b3 52%, ${NIGHT}33 100%), linear-gradient(0deg, ${NIGHT} 0%, transparent 35%)`,
          }}
        />
        <div
          aria-hidden
          className="landing-glow absolute -z-10 rounded-full blur-3xl"
          style={{ width: "40rem", height: "40rem", left: "-12rem", top: "-14rem", background: `radial-gradient(circle, ${RED}2e, transparent 65%)` }}
        />

        {/* Top bar */}
        <div className="flex items-center justify-between gap-4 px-5 sm:px-10 pt-5">
          <div className="flex items-center gap-3 text-xs tracking-[0.18em] uppercase opacity-80">
            <span className="inline-block size-2 rounded-full shrink-0" style={{ background: RED }} />
            <span className="hidden md:inline">FBS × Innovationswerkstatt × Digital Management School × BIK</span>
            <span className="md:hidden">FBS-Workshop 2026</span>
          </div>
          <div
            className="flex rounded-md overflow-hidden text-xs"
            style={{ background: "rgba(255,255,255,0.12)" }}
            role="group"
            aria-label="Sprache / Language"
          >
            {(["de", "en"] as Lang[]).map((l) => (
              <button
                key={l}
                onClick={() => setLang(l)}
                aria-pressed={lang === l}
                className="px-2.5 h-8 uppercase tracking-wider transition-colors hover:bg-white/10"
                style={lang === l ? { background: "rgba(255,255,255,0.26)", fontWeight: 600 } : undefined}
              >
                {l}
              </button>
            ))}
          </div>
        </div>

        {/* Headline block */}
        <div className="flex-1 flex items-center px-5 sm:px-10 py-10">
          <div className="max-w-3xl">
            <img
              src={`${BASE}brand/fbs-logo-white.png`}
              alt="Fachverband Betonbohren und -sägen Deutschland e. V."
              className="landing-rise w-28 sm:w-36 h-auto mb-7 drop-shadow-[0_8px_30px_rgba(0,0,0,0.55)]"
            />
            <p className="landing-rise landing-d1 text-xs sm:text-sm tracking-[0.14em] uppercase mb-4" style={{ color: RED_LIGHT }}>
              {c.eyebrow}
            </p>
            <h1
              className="landing-rise landing-d2 font-bold leading-[1.04] tracking-tight"
              style={{ fontSize: "clamp(2.5rem, 6.4vw, 5rem)" }}
            >
              <span className="block" style={{ color: RED_LIGHT }}>{c.titleA}</span>
              <span className="block">{c.titleB}</span>
            </h1>
            <span aria-hidden className="landing-rise landing-d3 block mt-6 h-[3px] w-16 rounded-full" style={{ background: RED }} />
            <p className="landing-rise landing-d3 mt-6 max-w-2xl text-base sm:text-lg leading-relaxed opacity-85">
              {c.lead}
            </p>

            <div className="landing-rise landing-d4 mt-8 flex flex-wrap gap-3">
              <Link
                to={`/s/${FIRST}`}
                className="inline-flex items-center gap-2 px-5 h-12 rounded-lg font-semibold shadow-lg transition-all hover:brightness-110 active:scale-[0.98]"
                style={{ background: RED, color: "white" }}
              >
                {c.start}
                <ArrowRight size={18} strokeWidth={2.5} />
              </Link>
              <Link
                to={`/p/${FIRST}`}
                className="inline-flex items-center gap-2 px-5 h-12 rounded-lg font-semibold transition-colors hover:bg-white/15"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
              >
                <Play size={16} strokeWidth={2.25} fill="currentColor" />
                {c.present}
              </Link>
              <Link
                to="/protokoll"
                className="inline-flex items-center gap-2 px-5 h-12 rounded-lg font-semibold transition-colors hover:bg-white/15"
                style={{ background: "rgba(255,255,255,0.08)", border: "1px solid rgba(255,255,255,0.3)", color: "white" }}
              >
                <ClipboardList size={16} strokeWidth={2.25} />
                {c.protocol}
              </Link>
            </div>

            <dl className="landing-rise landing-d5 mt-10 grid gap-3 sm:grid-cols-3">
              {c.facts.map(({ icon: Icon, label, value }) => (
                <div
                  key={label}
                  className="rounded-xl px-4 py-3 backdrop-blur-md"
                  style={{ background: "rgba(17,18,24,0.6)", border: "1px solid rgba(255,255,255,0.14)" }}
                >
                  <dt className="flex items-center gap-2 text-[11px] uppercase tracking-[0.14em] opacity-70">
                    <Icon size={14} strokeWidth={2.25} style={{ color: RED_LIGHT }} />
                    {label}
                  </dt>
                  <dd className="mt-1 font-semibold leading-snug">{value}</dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        {/* Hosts */}
        <div className="px-5 sm:px-10 pb-8 flex flex-wrap items-center gap-x-12 gap-y-5">
          <span className="text-[11px] uppercase tracking-[0.18em] opacity-60">{c.hosts}</span>
          {HOSTS.map((h) => (
            <div key={h.key} className="flex items-center gap-4">
              <div className="flex items-center gap-3.5 shrink-0">
                {h.logos.map((l) => (
                  <img key={l.alt} src={`${BASE}${l.src}`} alt={l.alt} style={{ height: `${l.height}px`, width: "auto" }} />
                ))}
              </div>
              <div className="leading-tight">
                <div className="text-sm font-semibold">{h.person}</div>
                <div className="text-[11px] opacity-65">
                  {h.org} · {c[h.role]}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ── Key visual ───────────────────────────────────────── */}
      <section className="px-5 sm:px-10 py-14 sm:py-20" style={{ background: NIGHT }}>
        <div className="max-w-6xl mx-auto grid gap-10 md:grid-cols-[minmax(0,420px)_1fr] items-center">
          <img
            src={`${BASE}brand/zukunft-fester-grund-dark.webp`}
            alt={c.visualAlt}
            loading="lazy"
            className="w-full max-w-[420px] mx-auto h-auto drop-shadow-[0_24px_60px_rgba(0,0,0,0.5)]"
          />
          <div>
            <p className="text-xs sm:text-sm tracking-[0.14em] uppercase mb-3" style={{ color: RED_LIGHT }}>
              {c.visualEyebrow}
            </p>
            <h2 className="text-3xl sm:text-5xl font-bold leading-tight tracking-tight">{c.visualTitle}</h2>
            <p className="mt-5 text-base sm:text-lg leading-relaxed opacity-80 max-w-xl">{c.visualText}</p>
            <ul className="mt-7 flex flex-wrap gap-2">
              {c.tags.map((tag) => (
                <li
                  key={tag}
                  className="px-3 py-1.5 rounded-full text-sm font-medium"
                  style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.18)", color: "rgba(255,255,255,0.88)" }}
                >
                  {tag}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Why + path ───────────────────────────────────────── */}
      <section className="px-5 sm:px-10 py-16 sm:py-20" style={{ background: `linear-gradient(180deg, ${NIGHT}, ${ANTHRAZIT})` }}>
        <div className="max-w-6xl mx-auto grid gap-12 lg:grid-cols-[1fr_1.3fr]">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">{c.whyTitle}</h2>
            <div className="grid gap-4">
              {c.why.map((w, i) => (
                <div
                  key={w.k}
                  className="rounded-xl p-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.1)" }}
                >
                  <div className="flex items-center gap-3 mb-2">
                    <span
                      className="grid place-items-center size-7 rounded-full text-sm font-bold"
                      style={{ background: RED, color: "white" }}
                    >
                      {i + 1}
                    </span>
                    <h3 className="font-semibold">{w.k}</h3>
                  </div>
                  <p className="text-sm leading-relaxed opacity-80">{w.v}</p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h2 className="text-2xl sm:text-3xl font-bold mb-6">{c.modulesTitle}</h2>
            <ol className="grid gap-2 sm:grid-cols-2">
              {modules.map((m) => {
                const day = m.index <= DAY1_LAST_MODULE ? c.day1 : c.day2;
                return (
                  <li key={m.index}>
                    <Link
                      to={`/s/${m.slides[0].id}`}
                      className="group flex items-center gap-3 rounded-lg px-4 py-3 transition-colors hover:bg-white/10"
                      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "white" }}
                    >
                      <span
                        className="font-mono text-sm w-7 shrink-0"
                        style={{ color: m.index <= DAY1_LAST_MODULE ? RED_LIGHT : "rgba(255,255,255,0.7)" }}
                      >
                        {String(m.index).padStart(2, "0")}
                      </span>
                      <span className="flex-1 min-w-0">
                        <span className="block font-medium leading-snug">{m.title[lang]}</span>
                        <span className="block text-[11px] uppercase tracking-[0.12em] opacity-55 mt-0.5">{day}</span>
                      </span>
                      <ArrowRight size={16} className="opacity-40 transition-transform group-hover:translate-x-0.5 group-hover:opacity-90" />
                    </Link>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
      </section>

      <footer
        className="px-5 sm:px-10 py-6 text-xs flex flex-wrap items-center justify-between gap-3"
        style={{ background: ANTHRAZIT, borderTop: "1px solid rgba(255,255,255,0.1)", color: "rgba(255,255,255,0.55)" }}
      >
        <span>Fachverband Betonbohren und -sägen Deutschland e. V. · Darmstadt</span>
        <span className="flex flex-wrap items-center gap-4">
          Innovationswerkstatt & Digital Management School × BIK GmbH · 2026
          <button
            type="button"
            onClick={logout}
            className="inline-flex items-center gap-1.5 px-2.5 h-7 rounded-md transition-colors hover:bg-white/10 hover:text-white"
            style={{ border: "1px solid rgba(255,255,255,0.18)" }}
          >
            <LogOut size={13} strokeWidth={2.25} />
            {lang === "de" ? "Abmelden" : "Sign out"}
          </button>
        </span>
      </footer>
    </div>
  );
}
