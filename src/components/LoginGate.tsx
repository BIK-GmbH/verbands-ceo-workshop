import { useState, type CSSProperties, type FormEvent, type ReactNode } from "react";
import { LogIn } from "lucide-react";
import type { Lang } from "@/types/slide";
import { useLang } from "@/lib/i18n";
import "@/styles/landing.css";

/*
 * Soft gate only: the site is a static GitHub-Pages bundle without a backend, so anyone
 * who reads the JS can bypass this. It keeps casual visitors out; it is not real security.
 * We store a SHA-256 of "user:password" instead of the plain password so the credentials
 * are at least not readable at a glance in the bundle.
 */
export const AUTH_STORAGE_KEY = "verbands-ceo.auth.v1";
const AUTH_HASH = "df617b21b8aee6210556bc3949b2d7c6bff8a9d53445323eb8652b70cd13cc36";

const BASE = import.meta.env.BASE_URL;
const NIGHT = "#111218";
const RED = "#CD184B";
const RED_LIGHT = "#EE4D6C";

const COPY = {
  de: {
    titleA: "KI-Geschäftsführer:",
    titleB: "Fiktion oder Realität?",
    meta: "Zweitages-Workshop · 16. und 17. September 2026",
    username: "Benutzername",
    password: "Passwort",
    submit: "Anmelden",
    error: "Benutzername oder Passwort ist falsch.",
    hosts: "Veranstalter",
  },
  en: {
    titleA: "AI managing director:",
    titleB: "fiction or reality?",
    meta: "Two-day workshop · 16–17 September 2026",
    username: "Username",
    password: "Password",
    submit: "Sign in",
    error: "Username or password is incorrect.",
    hosts: "Hosts",
  },
} as const;

function readStoredAuth(): boolean {
  try {
    return localStorage.getItem(AUTH_STORAGE_KEY) === AUTH_HASH;
  } catch {
    return false;
  }
}

function storeAuth() {
  try {
    localStorage.setItem(AUTH_STORAGE_KEY, AUTH_HASH);
  } catch {
    // Private mode: login then only lasts for this session via React state.
  }
}

async function sha256Hex(text: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Forgets the login without reloading (used by the reset in the settings). */
export function clearStoredAuth() {
  try {
    localStorage.removeItem(AUTH_STORAGE_KEY);
  } catch {
    // Nothing stored in private mode; the in-memory state lasts until the next load.
  }
}

export function logout() {
  clearStoredAuth();
  window.location.reload();
}

export function LoginGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(readStoredAuth);
  if (authed) return <>{children}</>;
  return (
    <LoginScreen
      onSuccess={() => {
        storeAuth();
        setAuthed(true);
      }}
    />
  );
}

function LoginScreen({ onSuccess }: { onSuccess: () => void }) {
  const [lang, setLang] = useLang();
  const c = COPY[lang];
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [failed, setFailed] = useState(false);
  const [checking, setChecking] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setChecking(true);
    let hash = "";
    try {
      hash = await sha256Hex(`${username.trim().toLowerCase()}:${password}`);
    } catch {
      // crypto.subtle is missing outside secure contexts; treat as a failed login.
    }
    setChecking(false);
    if (hash === AUTH_HASH) {
      onSuccess();
      return;
    }
    setFailed(true);
  }

  const inputClass =
    "w-full h-11 rounded-lg px-3.5 text-[15px] text-white placeholder:text-white/35 outline-none transition-shadow focus:ring-2";
  const inputStyle = {
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.18)",
    "--tw-ring-color": `${RED_LIGHT}99`,
  } as CSSProperties;

  return (
    <div
      className="relative isolate min-h-[100svh] overflow-hidden flex flex-col"
      style={{ background: NIGHT, color: "white" }}
    >
      <img
        src={`${BASE}brand/hero-ki-beton.webp`}
        alt=""
        aria-hidden
        className="landing-hero-img absolute inset-0 -z-20 size-full object-cover"
        style={{ objectPosition: "70% center", filter: "blur(3px) brightness(0.55)" }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10"
        style={{
          background: `radial-gradient(ellipse at center, ${NIGHT}99 0%, ${NIGHT}e6 70%, ${NIGHT} 100%)`,
        }}
      />
      <div
        aria-hidden
        className="landing-glow absolute -z-10 rounded-full blur-3xl"
        style={{ width: "36rem", height: "36rem", left: "-12rem", top: "-14rem", background: `radial-gradient(circle, ${RED}2e, transparent 65%)` }}
      />

      <div className="flex justify-end px-4 sm:px-8 pt-4">
        <div
          className="flex rounded-md overflow-hidden text-xs"
          style={{ background: "rgba(255,255,255,0.12)" }}
          role="group"
          aria-label="Sprache / Language"
        >
          {(["de", "en"] as Lang[]).map((l) => (
            <button
              key={l}
              type="button"
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

      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div
          className="landing-rise w-full max-w-[420px] rounded-2xl px-6 py-8 sm:px-9 sm:py-10 backdrop-blur-xl shadow-[0_30px_80px_rgba(0,0,0,0.45)]"
          style={{ background: "rgba(24,26,39,0.72)", border: "1px solid rgba(255,255,255,0.14)" }}
        >
          <div className="text-center">
            <img
              src={`${BASE}brand/fbs-logo-white.png`}
              alt="Fachverband Betonbohren und -sägen Deutschland e. V."
              className="mx-auto h-auto drop-shadow-[0_8px_30px_rgba(0,0,0,0.5)]"
              style={{ width: 96 }}
            />
            <h1 className="mt-6 text-2xl sm:text-[1.7rem] font-bold leading-tight tracking-tight">
              <span className="block" style={{ color: RED_LIGHT }}>{c.titleA}</span>
              <span className="block">{c.titleB}</span>
            </h1>
            <span aria-hidden className="mx-auto mt-4 block h-[3px] w-12 rounded-full" style={{ background: RED }} />
            <p className="mt-4 text-xs sm:text-[13px] opacity-65">{c.meta}</p>
          </div>

          <form onSubmit={handleSubmit} className="mt-8 grid gap-4" noValidate>
            <div className="grid gap-1.5">
              <label htmlFor="login-username" className="text-xs font-medium uppercase tracking-[0.12em] opacity-75">
                {c.username}
              </label>
              <input
                id="login-username"
                name="username"
                type="text"
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                required
                value={username}
                onChange={(e) => {
                  setUsername(e.target.value);
                  setFailed(false);
                }}
                aria-invalid={failed || undefined}
                className={inputClass}
                style={inputStyle}
              />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="login-password" className="text-xs font-medium uppercase tracking-[0.12em] opacity-75">
                {c.password}
              </label>
              <input
                id="login-password"
                name="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setFailed(false);
                }}
                aria-invalid={failed || undefined}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <p aria-live="polite" role="status" className="min-h-5 text-sm" style={{ color: "#ff9b9b" }}>
              {failed ? c.error : ""}
            </p>

            <button
              type="submit"
              disabled={checking}
              className="inline-flex items-center justify-center gap-2 h-12 rounded-lg font-semibold shadow-lg transition-all hover:brightness-110 active:scale-[0.98] disabled:opacity-70"
              style={{ background: RED, color: "white" }}
            >
              <LogIn size={18} strokeWidth={2.5} />
              {c.submit}
            </button>
          </form>

          <div className="mt-8 pt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-3" style={{ borderTop: "1px solid rgba(255,255,255,0.1)" }}>
            <span className="w-full text-center text-[10px] uppercase tracking-[0.18em] opacity-55">{c.hosts}</span>
            <img src={`${BASE}brand/innovationswerkstatt-white.png`} alt="Innovationswerkstatt" style={{ height: 15, width: "auto" }} />
            <img src={`${BASE}brand/dms-logo-white.png`} alt="Digital Management School" style={{ height: 28, width: "auto" }} />
            <img src={`${BASE}brand/bik-logo-white.svg`} alt="BIK GmbH" style={{ height: 26, width: "auto" }} />
          </div>
        </div>
      </main>
    </div>
  );
}
