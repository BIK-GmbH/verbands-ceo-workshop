import type { CSSProperties } from "react";
import { Link, useParams } from "react-router-dom";
import { Menu, Play, Search, Sun, Moon, ClipboardList, LayoutGrid, Mic, Type, Settings as SettingsIcon } from "lucide-react";
import { useApiKey } from "@/lib/ai-assist";
import {
  FONT_SCALES,
  FONT_SCALE_LABEL,
  nextFontScale,
  useFontScale,
  type FontScale,
} from "@/lib/font-scale";
import type { Lang, Theme } from "@/types/slide";
import { t } from "@/lib/i18n";
import { ALL_SLIDES } from "@/lib/slides";
import { Tooltip } from "@/components/ui/Tooltip";
import { RecordingBadge } from "@/components/RecordingBadge";

interface Props {
  lang: Lang;
  setLang: (l: Lang) => void;
  theme: Theme;
  setTheme: (t: Theme) => void;
  onOpenPalette: () => void;
  onToggleMobileSidebar: () => void;
  protocolOpen: boolean;
  onToggleProtocol: () => void;
}

const ICON = { strokeWidth: 2.25 } as const;
/** The letter itself grows with the step — the quickest way to read the button. */
const FONT_ICON_SIZE: Record<FontScale, number> = { normal: 14, large: 16, xlarge: 18 };
const IS_MAC = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.userAgent);
const BASE = import.meta.env.BASE_URL;

/** Quiet surface for header controls — adapts to light and dark theme. */
const SOFT: CSSProperties = {
  background: "color-mix(in oklch, var(--fg) 6%, transparent)",
  border: "1px solid color-mix(in oklch, var(--fg) 8%, transparent)",
};
const SOFT_HOVER = "hover:bg-[color-mix(in_oklch,var(--fg)_11%,transparent)] active:bg-[color-mix(in_oklch,var(--fg)_16%,transparent)]";

/** Host logos, in the agreed order after the FBS seal. Light = dark artwork, dark = white artwork. */
const HOST_LOGOS = [
  { light: "brand/innovationswerkstatt-dark.png", dark: "brand/innovationswerkstatt-white.png", alt: "Innovationswerkstatt", h: 15 },
  { light: "brand/dms-logo-dark.png", dark: "brand/dms-logo-white.png", alt: "Digital Management School", h: 26 },
  { light: "brand/bik-logo-dark.svg", dark: "brand/bik-logo-white.svg", alt: "BIK GmbH", h: 24 },
];

export function Header({
  lang,
  setLang,
  theme,
  setTheme,
  onOpenPalette,
  onToggleMobileSidebar,
  protocolOpen,
  onToggleProtocol,
}: Props) {
  const params = useParams<{ slideId: string }>();
  const currentId = params.slideId ?? ALL_SLIDES[0].id;
  // A dot on the gear signals that AI features are still off on this device.
  const claudeKey = useApiKey();
  const [fontScale, setFontScale] = useFontScale();
  const nextScale = nextFontScale(fontScale);
  const fontStep = FONT_SCALES.indexOf(fontScale) + 1;
  return (
    <header
      data-workshop-header
      className="sticky top-0 z-30 flex items-center px-3 sm:px-5 border-b shrink-0 gap-2"
      style={{
        height: "var(--header-height)",
        background: "var(--bg)",
        color: "var(--fg)",
        borderColor: "var(--border)",
      }}
    >
      {/* Mobile hamburger */}
      <button
        onClick={onToggleMobileSidebar}
        data-testid="mobile-sidebar-toggle"
        className={`md:hidden size-9 grid place-items-center rounded-md transition-colors ${SOFT_HOVER}`}
        style={SOFT}
        aria-label="Menü"
      >
        <Menu size={20} {...ICON} />
      </button>

      <Link
        to="/"
        className="flex items-center gap-3 min-w-0 rounded-md transition-opacity hover:opacity-85"
        style={{ color: "inherit", textDecoration: "none" }}
        title={lang === "de" ? "Zur Startseite" : "To the start page"}
      >
        <span className="hidden sm:block shrink-0">
          <img
            src={`${BASE}brand/fbs-logo.png`}
            alt="Fachverband Betonbohren und -sägen Deutschland e. V."
            width={38}
            height={38}
            className="theme-img-light size-[38px]"
          />
          <img
            src={`${BASE}brand/fbs-logo-white.png`}
            alt="Fachverband Betonbohren und -sägen Deutschland e. V."
            width={38}
            height={38}
            className="theme-img-dark size-[38px]"
          />
        </span>
        <div className="leading-tight min-w-0">
          <div className="text-sm font-semibold truncate">
            {lang === "de" ? "KI-Geschäftsführer: Fiktion oder Realität?" : "AI managing director: fiction or reality?"}
          </div>
          <div className="text-[11px] truncate hidden sm:block" style={{ color: "var(--fg-muted)" }}>
            {lang === "de" ? "FBS-Workshop · 16./17. September 2026" : "FBS workshop · 16–17 September 2026"}
          </div>
        </div>
        <div
          className="hidden xl:flex items-center gap-3.5 ml-2 pl-4 h-8 shrink-0 border-l"
          style={{ borderColor: "var(--border)" }}
        >
          {HOST_LOGOS.map((l) => (
            <span key={l.alt} className="block shrink-0">
              <img src={`${BASE}${l.light}`} alt={l.alt} className="theme-img-light w-auto" style={{ height: l.h }} />
              <img src={`${BASE}${l.dark}`} alt={l.alt} className="theme-img-dark w-auto" style={{ height: l.h }} />
            </span>
          ))}
        </div>
      </Link>

      <div className="ml-auto flex items-center gap-1.5">
        {/* Only visible while the session recorder runs — it keeps recording across slides. */}
        <RecordingBadge />

        <Tooltip
          content={
            lang === "de"
              ? "Live-Protokoll ein- oder ausblenden. Es läuft rechts neben der Folie mit: Notiz zur Folie, eigene Fragen, alle erfassten Beiträge und Export."
              : "Show or hide the live record. It runs next to the slide: note for this slide, own questions, all captured input and export."
          }
        >
        <button
          type="button"
          onClick={onToggleProtocol}
          data-testid="open-protocol"
          aria-pressed={protocolOpen}
          className={`inline-flex items-center gap-2 px-3 h-9 rounded-md transition-all text-xs font-semibold active:scale-[0.98] ${protocolOpen ? "" : SOFT_HOVER}`}
          style={
            protocolOpen
              ? {
                  background: "color-mix(in oklch, var(--workshop-accent) 14%, transparent)",
                  border: "1px solid var(--workshop-accent)",
                  color: "var(--workshop-accent)",
                }
              : SOFT
          }
          aria-label={lang === "de" ? "Live-Protokoll" : "Live record"}
        >
          <ClipboardList size={16} {...ICON} />
          <span className="hidden sm:inline">{lang === "de" ? "Protokoll" : "Record"}</span>
        </button>
        </Tooltip>

        <Tooltip
          content={
            lang === "de"
              ? "Poster-Galerie: die Poster der sieben Phasen ansehen, bearbeiten und drucken, von A4 bis A0, auch als leere Vorlage."
              : "Poster gallery: view, edit and print the posters of the seven phases, from A4 to A0, also as a blank template."
          }
        >
          <Link
            to="/poster"
            className={`inline-flex items-center gap-2 px-3 h-9 rounded-md transition-colors text-xs font-semibold ${SOFT_HOVER}`}
            style={{ ...SOFT, color: "inherit", textDecoration: "none" }}
            aria-label={lang === "de" ? "Poster-Galerie" : "Poster gallery"}
          >
            <LayoutGrid size={16} {...ICON} />
            <span className="hidden lg:inline">Poster</span>
          </Link>
        </Tooltip>

        <Tooltip
          content={
            lang === "de"
              ? "KI-Interviews: Einzelinterviews aufnehmen oder hochladen, transkribieren und daraus die Meinungsbilder erstellen."
              : "AI interviews: record or upload one-to-one interviews, transcribe them and create the opinion pictures."
          }
        >
          <Link
            to="/interviews"
            className={`inline-flex items-center gap-2 px-3 h-9 rounded-md transition-colors text-xs font-semibold ${SOFT_HOVER}`}
            style={{ ...SOFT, color: "inherit", textDecoration: "none" }}
            aria-label={lang === "de" ? "KI-Interviews" : "AI interviews"}
          >
            <Mic size={16} {...ICON} />
            <span className="hidden xl:inline">Interviews</span>
          </Link>
        </Tooltip>

        <Tooltip
          content={
            lang === "de"
              ? `Alle Folien nach Stichwort durchsuchen und direkt hinspringen (${IS_MAC ? "⌘K" : "Strg K"}).`
              : `Search all slides by keyword and jump straight there (${IS_MAC ? "⌘K" : "Ctrl K"}).`
          }
        >
        <button
          onClick={onOpenPalette}
          data-command-palette
          className={`inline-flex items-center gap-2 px-2.5 h-9 rounded-md transition-colors text-xs ${SOFT_HOVER}`}
          style={SOFT}
          aria-label={t("search", lang)}
        >
          <Search size={16} {...ICON} />
          <span className="hidden lg:inline">{t("search", lang)}</span>
          <kbd
            className="hidden lg:inline px-1.5 py-0.5 rounded text-[10px] font-mono"
            style={{ background: "color-mix(in oklch, var(--fg) 8%, transparent)", color: "var(--fg-muted)" }}
          >
            {IS_MAC ? "⌘K" : lang === "de" ? "Strg K" : "Ctrl K"}
          </kbd>
        </button>
        </Tooltip>

        {/* Desktop / tablet: 2-button DE/EN switch */}
        <div
          className="hidden sm:flex rounded-md overflow-hidden text-xs"
          style={SOFT}
          role="group"
          aria-label={t("toggleLang", lang)}
        >
          {(["de", "en"] as Lang[]).map((l) => (
            <Tooltip
              key={l}
              content={
                l === "de"
                  ? "Deutsch: Folien, Sprechernotizen und Oberfläche auf Deutsch"
                  : "English: slides, speaker notes and interface in English"
              }
            >
            <button
              onClick={() => setLang(l)}
              data-testid={`lang-${l}`}
              aria-pressed={lang === l}
              className={`px-2 h-[34px] uppercase tracking-wider transition-colors ${SOFT_HOVER}`}
              style={
                lang === l
                  ? { background: "var(--fg)", color: "var(--bg)", fontWeight: 600 }
                  : { color: "var(--fg-muted)" }
              }
            >
              {l}
            </button>
            </Tooltip>
          ))}
        </div>

        {/* Mobile: single toggle (DE ↔ EN) */}
        <Tooltip content={lang === "de" ? "Sprache wechseln: Deutsch ↔ Englisch" : "Switch language: German ↔ English"}>
        <button
          onClick={() => setLang(lang === "de" ? "en" : "de")}
          data-testid="lang-toggle-mobile"
          className={`sm:hidden size-9 grid place-items-center rounded-md text-xs uppercase font-semibold transition-colors ${SOFT_HOVER}`}
          style={SOFT}
          aria-label={t("toggleLang", lang)}
        >
          {lang}
        </button>
        </Tooltip>

        <Tooltip
          content={
            lang === "de"
              ? `Einstellungen: API-Schlüssel für Glätten, Ergebnisbericht, Poster und Interview-Transkription, dazu Sicherung und Zurücksetzen der Workshop-Inhalte.${claudeKey ? "" : " Der Punkt zeigt: auf diesem Gerät noch nicht eingerichtet."}`
              : `Settings: API keys for polishing, results report, posters and interview transcription, plus backup and reset of the workshop content.${claudeKey ? "" : " The dot means: not set up on this device yet."}`
          }
        >
        <Link
          to="/einstellungen"
          className={`size-9 grid place-items-center rounded-md transition-colors relative ${SOFT_HOVER}`}
          style={{ ...SOFT, color: "inherit" }}
          aria-label={lang === "de" ? "Einstellungen" : "Settings"}
        >
          <SettingsIcon size={18} {...ICON} />
          {!claudeKey && (
            <span
              className="absolute -top-0.5 -right-0.5 size-2 rounded-full"
              style={{ background: "var(--workshop-accent)" }}
              aria-hidden
            />
          )}
        </Link>
        </Tooltip>

        <Tooltip
          content={
            lang === "de"
              ? `Zu ${theme === "dark" ? "hellem" : "dunklem"} Design wechseln. Dunkel schont die Augen im abgedunkelten Raum, hell ist am Beamer meist besser lesbar.`
              : `Switch to ${theme === "dark" ? "light" : "dark"} theme. Dark is easier on the eyes in a dimmed room, light usually reads better on a projector.`
          }
        >
        <button
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          data-testid="theme-toggle"
          className={`size-9 grid place-items-center rounded-md transition-colors ${SOFT_HOVER}`}
          style={SOFT}
          aria-label={t("toggleTheme", lang)}
        >
          {theme === "dark" ? <Moon size={18} {...ICON} /> : <Sun size={18} {...ICON} />}
        </button>
        </Tooltip>

        {/* Font size — three steps, for the beamer and for small laptop screens.
            Shown from the desktop layout upwards, because that is where the steps
            apply (see globals.css); the phone layout keeps its own type scale. */}
        <Tooltip
          content={
            lang === "de"
              ? `Schriftgröße der ganzen Oberfläche: ${FONT_SCALE_LABEL[fontScale].de} (Stufe ${fontStep} von 3). Weiter zu ${FONT_SCALE_LABEL[nextScale].de} — größer für den Beamer, normal für kleine Laptop-Bildschirme. Poster und Druckansicht bleiben unverändert.`
              : `Font size of the whole interface: ${FONT_SCALE_LABEL[fontScale].en} (step ${fontStep} of 3). Next is ${FONT_SCALE_LABEL[nextScale].en} — bigger for the projector, normal for small laptop screens. Posters and the print view stay as they are.`
          }
        >
        <button
          type="button"
          onClick={() => setFontScale(nextScale)}
          data-testid="font-scale-toggle"
          data-step={fontScale}
          className={`hidden md:grid size-9 place-items-center rounded-md transition-colors relative ${SOFT_HOVER}`}
          style={SOFT}
          aria-label={
            lang === "de"
              ? `Schriftgröße: ${FONT_SCALE_LABEL[fontScale].de}, Stufe ${fontStep} von 3. Weiter zu ${FONT_SCALE_LABEL[nextScale].de}.`
              : `Font size: ${FONT_SCALE_LABEL[fontScale].en}, step ${fontStep} of 3. Next: ${FONT_SCALE_LABEL[nextScale].en}.`
          }
        >
          <Type size={FONT_ICON_SIZE[fontScale]} {...ICON} style={{ marginTop: -3 }} />
          {/* Step markers: filled up to the current step. */}
          <span className="absolute inset-x-0 bottom-[5px] flex justify-center gap-[3px]" aria-hidden>
            {FONT_SCALES.map((s, i) => (
              <span
                key={s}
                className="rounded-full"
                style={{
                  width: 3,
                  height: 3,
                  background:
                    i < fontStep
                      ? "var(--workshop-accent)"
                      : "color-mix(in oklch, var(--fg) 32%, transparent)",
                }}
              />
            ))}
          </span>
        </button>
        </Tooltip>

        {/* Divider — sets the primary action visually apart */}
        <span
          className="hidden sm:block w-px h-6 mx-1.5 self-center"
          style={{ background: "var(--border)" }}
          aria-hidden
        />

        {/* Primary action — far right, prominent */}
        <Tooltip
          content={
            lang === "de"
              ? "Präsentations-Modus ab dieser Folie: ohne Menüs, Blättern mit Pfeiltasten, N blendet die Sprechernotizen ein, F für Vollbild, Esc beendet."
              : "Presentation mode from this slide: no menus, arrow keys to navigate, N shows speaker notes, F for fullscreen, Esc exits."
          }
        >
        <Link
          to={`/p/${currentId}`}
          data-testid="enter-presentation"
          className="inline-flex items-center gap-2 px-4 h-9 rounded-md transition-all text-sm font-semibold shadow-sm hover:shadow-md hover:brightness-110 active:scale-[0.98]"
          style={{ background: "var(--workshop-accent)", color: "white" }}
          aria-label={lang === "de" ? "Präsentations-Modus" : "Presentation mode"}
        >
          <Play size={16} {...ICON} fill="currentColor" />
          <span className="max-[520px]:hidden">
            {lang === "de" ? "Präsentieren" : "Present"}
          </span>
        </Link>
        </Tooltip>
      </div>
    </header>
  );
}
