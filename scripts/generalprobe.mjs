/**
 * Automatische Generalprobe für den Workshop „KI-Geschäftsführer: Fiktion oder Realität?“
 *
 * Spielt einen Workshop in 14 Schritten gegen den Production-Build durch: leerer Start,
 * Sicherung einlesen, jede Folie, Live-Erfassung, Rückblick, Exporte, Poster, Interviews,
 * Präsentation, Sitzungsaufnahme (3 Minuten echte Zeit), automatische Sicherung, Ernstfall
 * (Zurücksetzen + Wiederherstellen), Neuladen und Druckansicht.
 *
 *   npm run generalprobe
 *
 * Optionen (nur zum Entwickeln des Skripts, nicht für die Probe am Workshop-Morgen):
 *   --fixture=<pfad>          andere Sicherung statt tests/fixtures/generalprobe-backup.json
 *   --ohne-build              vorhandenes dist/ verwenden, nicht neu bauen
 *   --aufnahme-sekunden=<n>   Länge der Sitzungsaufnahme (Standard 180; kürzer = keine gültige Probe)
 *   --sichtbar                Browserfenster anzeigen
 *
 * Ergebnis: exports/generalprobe-<Datum>.md, Screenshots und Downloads unter
 * test-results/generalprobe/. Exit-Code 1, sobald eine Prüfung fehlschlägt.
 */
import { chromium } from "@playwright/test";
import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

/* ------------------------------------------------------------------ setup */

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PORT = 4240;
const BASE_PATH = "/verbands-ceo-workshop/";
const ORIGIN = `http://localhost:${PORT}`;
const APP = `${ORIGIN}${BASE_PATH}`;
const ARTIFACTS = path.join(ROOT, "test-results", "generalprobe");
const DOWNLOADS = path.join(ARTIFACTS, "downloads");
const REL_ARTIFACTS = "test-results/generalprobe";

// Mirrors src/components/LoginGate.tsx — signs in without typing credentials.
const AUTH_KEY = "verbands-ceo.auth.v1";
const AUTH_HASH = "df617b21b8aee6210556bc3949b2d7c6bff8a9d53445323eb8652b70cd13cc36";
// Mirrors src/components/AutoBackup.tsx — the end-of-day reminder shows once per day.
const REMINDER_KEY = "verbands-ceo.autobackup.reminder.v1";
const STORE_KEYS = {
  workshop: "verbands-ceo.workshop.v1",
  glossary: "verbands-ceo.glossary.v1",
  poster: "verbands-ceo.poster.v1",
  report: "verbands-ceo.report.v1",
  group: "verbands-ceo.interviews.group.v1",
};
const FOLDER_NAME = "Generalprobe-Sicherungsordner";

/** Network errors that are expected on a device without API keys (or without internet). */
const EXPECTED_NETWORK = [
  { re: /api\.anthropic\.com/i, why: "Claude-API ohne Schlüssel (Technik-Check „Internet“/„Claude-Schlüssel“)" },
  { re: /api\.openai\.com/i, why: "OpenAI-API ohne Schlüssel (Technik-Check „Internet“/„OpenAI-Schlüssel“)" },
  { re: /google\.com\/generate_204/i, why: "Erreichbarkeit der Spracherkennung (Technik-Check „Internet“)" },
];

const argv = new Map(
  process.argv.slice(2).map((a) => {
    const [k, ...v] = a.replace(/^--/, "").split("=");
    return [k, v.length ? v.join("=") : true];
  }),
);
const KNOWN_ARGS = new Set(["fixture", "ohne-build", "aufnahme-sekunden", "sichtbar"]);
for (const k of argv.keys()) {
  if (!KNOWN_ARGS.has(k)) {
    console.error(`Unbekannte Option --${k}. Erlaubt: ${[...KNOWN_ARGS].map((x) => `--${x}`).join(", ")}`);
    process.exit(2);
  }
}
const FIXTURE_PATH = path.resolve(ROOT, String(argv.get("fixture") ?? "tests/fixtures/generalprobe-backup.json"));
const SKIP_BUILD = argv.has("ohne-build");
const RECORD_SECONDS = Number(argv.get("aufnahme-sekunden") ?? 180);
const HEADED = argv.has("sichtbar");
const SLIDE_SWITCHES = 12;

const T0 = Date.now();
const clock = () => {
  const s = Math.round((Date.now() - T0) / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
};
const log = (msg) => console.log(`[${clock()}] ${msg}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => String(s ?? "").replace(/\s+/g, " ").trim();
const oneLine = (err) => norm(err instanceof Error ? err.message.split("\n").slice(0, 3).join(" ") : err).slice(0, 400);
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), "utf8");
const pad2 = (n) => String(n).padStart(2, "0");

/* ------------------------------------------------------------- fixture + deck */

const fixture = JSON.parse(fs.readFileSync(FIXTURE_PATH, "utf8"));
const FX = {
  entries: fixture.stores?.workshop?.entries ?? {},
  meta: fixture.stores?.workshop?.meta ?? {},
  drafts: fixture.stores?.poster?.drafts ?? {},
  glossaryTerms: fixture.stores?.glossary?.terms ?? [],
  interviews: fixture.interviews ?? [],
  group: fixture.stores?.interviewsGroup ?? null,
  report: fixture.stores?.report ?? null,
};
const FX_COUNTS = countsOf(FX.entries, FX.interviews.length, FX.drafts, FX.glossaryTerms.length);

/** Slide order from the single source of truth, read as text. */
const SLIDES = [
  ...read("src/lib/manifest.ts").matchAll(
    /\{\s*id:\s*"(\d{2}\.\d{2})",\s*module:\s*(\d+),\s*slide:\s*\d+,\s*title:\s*\{\s*de:\s*"([^"]*)"/g,
  ),
].map((m) => ({ id: m[1], module: Number(m[2]), title: m[3] }));
const SLIDE_INDEX = new Map(SLIDES.map((s, i) => [s.id, i]));

/** Capture blocks per slide, in the order they appear in the MDX source. */
const FIELDS = (() => {
  const attr = (s, name) => {
    const m = new RegExp(`(?<![\\w-])${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|\\{\\s*["']([^"']*)["']\\s*\\})`).exec(s);
    return m ? (m[1] ?? m[2] ?? m[3]) : undefined;
  };
  const out = new Map();
  for (const file of fs.readdirSync(path.join(ROOT, "src/content")).sort()) {
    const m = /^(\d{2})-(\d{2})/.exec(file);
    if (!m || !file.endsWith(".mdx")) continue;
    const slideId = `${m[1]}.${m[2]}`;
    const fields = [];
    for (const tag of read(`src/content/${file}`).matchAll(/<([A-Z][A-Za-z]*)\b([^>]*?)\/?>/gs)) {
      const field = attr(tag[2], "field");
      if (!field || fields.some((f) => f.field === field)) continue;
      fields.push({
        component: tag[1],
        field,
        kind: attr(tag[2], "kind") ?? "text",
        prompt: attr(tag[2], "prompt") ?? "",
        prefixed: /\b(groups|tags)\s*=/.test(tag[2]),
      });
    }
    out.set(slideId, fields);
  }
  return out;
})();

/** Poster definitions (key, entry ids, kinds) from src/lib/posters.ts. */
const POSTERS = (() => {
  const src = read("src/lib/posters.ts");
  const list = src.slice(src.indexOf("export const POSTERS"), src.indexOf("export const PHASE_POSTERS"));
  return list
    .split(/\n {2}\{\n {4}key: "/)
    .slice(1)
    .map((block) => ({
      key: /^([a-z-]+)"/.exec(block)[1],
      fields: [...block.matchAll(/\{\s*key: "([^"]+)",\s*entryId: "([^"]+)",([\s\S]*?)kind: "(text|choice)"/g)].map((f) => ({
        key: f[1],
        entryId: f[2],
        alsoFrom: [...(/alsoFrom:\s*\[([^\]]*)\]/.exec(f[3])?.[1] ?? "").matchAll(/"([^"]+)"/g)].map((x) => x[1]),
        kind: f[4],
      })),
    }));
})();

function countsOf(entries, interviews, drafts, glossaryTerms) {
  return {
    entries: Object.keys(entries ?? {}).length,
    interviews,
    posterFields: Object.values(drafts ?? {}).reduce((n, d) => n + Object.keys(d?.fields ?? {}).length, 0),
    glossaryTerms,
  };
}

/** Same wording as formatBackupCounts in src/lib/backup.ts. */
function countLine(c) {
  const p = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  return [
    p(c.entries, "Beitrag", "Beiträge"),
    p(c.interviews, "Interview", "Interviews"),
    p(c.posterFields, "Posterfeld", "Posterfelder"),
    p(c.glossaryTerms, "Glossarbegriff", "Glossarbegriffe"),
  ].join(" · ");
}

const sameCounts = (a, b) => ["entries", "interviews", "posterFields", "glossaryTerms"].every((k) => a[k] === b[k]);
const valueText = (v) => (Array.isArray(v) ? v.join(", ") : String(v ?? ""));
/** Lines without bullet markers — the recap reads poster text this way (src/lib/day-recap.ts). */
const toLines = (text) =>
  String(text ?? "")
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*(?:[-–•*]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
/** A short, render-independent piece of a stored text for "is it in the file" checks. */
function sample(text, max = 36) {
  const line = toLines(text)[0] ?? "";
  const plain = line.replace(/\*\*/g, "").replace(/[„“"]/g, "");
  if (plain.length <= max) return plain;
  const cut = plain.slice(0, max);
  return cut.slice(0, Math.max(cut.lastIndexOf(" "), 12)).trim();
}
/** What a poster shows for a field: poster wording first, then the record (src/lib/posters.ts). */
function posterValue(drafts, key, field, record) {
  const draft = drafts?.[key]?.fields;
  if (draft && Object.prototype.hasOwnProperty.call(draft, field.entryId)) return draft[field.entryId];
  for (const id of [field.entryId, ...field.alsoFrom]) {
    const v = record[id]?.trim();
    if (v) return v;
  }
  return "";
}
const recordOf = (entries) => Object.fromEntries(Object.entries(entries).map(([id, e]) => [id, valueText(e.value)]));

/* ------------------------------------------------------------------ report */

const run = { steps: [], network: new Map(), shortened: RECORD_SECONDS < 180 };
/** App defects found during the run, each with its evidence — reported, never silently tolerated. */
const APP_FINDINGS = [];

function finding(title, detail) {
  if (APP_FINDINGS.some((f) => f.title === title)) return;
  APP_FINDINGS.push({ title, detail, step: current?.n });
  console.log(`   ⚑ App-Befund: ${title}`);
}

const localDay = (d = new Date()) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
let current = null;
let where = "";

function check(name, ok, detail = "", shot = null) {
  current.checks.push({ name, ok: Boolean(ok), detail: String(detail ?? ""), shot });
  console.log(`   ${ok ? "✓" : "✗"} ${name}${detail ? ` — ${String(detail).slice(0, 300)}` : ""}`);
  return Boolean(ok);
}

function note(text) {
  current.notes.push(text);
  console.log(`   ℹ ${text}`);
}

const TOTAL_STEPS = 14;

async function step(title, fn) {
  const s = { n: run.steps.length + 1, title, checks: [], notes: [], errors: [], started: Date.now(), duration: 0 };
  run.steps.push(s);
  current = s;
  where = title;
  log(`Schritt ${s.n}/${TOTAL_STEPS} · ${title}`);
  try {
    await fn(s);
  } catch (err) {
    const shot = await screenshot("abbruch").catch(() => null);
    check("Schritt lief ohne Abbruch durch", false, oneLine(err), shot);
  } finally {
    const unexpected = s.errors.filter((e) => !e.expected);
    const expected = s.errors.length - unexpected.length;
    check(
      "Keine Seiten- oder Konsolenfehler",
      unexpected.length === 0,
      unexpected.length
        ? unexpected.slice(0, 6).map((e) => `[${e.where}] ${e.kind}: ${e.text}`).join(" | ")
        : expected
          ? `${expected} erwartete Netzwerkmeldung(en) ohne Schlüssel ausgenommen`
          : "",
    );
    s.duration = Date.now() - s.started;
    log(`Schritt ${s.n} ${s.checks.every((c) => c.ok) ? "✓" : "✗"} (${Math.round(s.duration / 1000)} s)`);
  }
}

let page;
let context;

async function screenshot(name, { locator, fullPage = false } = {}) {
  const file = `${pad2(current.n)}-${name.toLowerCase().replace(/[^a-z0-9äöüß]+/g, "-").replace(/^-|-$/g, "")}.png`;
  const target = locator ?? page;
  await target.screenshot({ path: path.join(ARTIFACTS, file), ...(locator ? {} : { fullPage }) });
  return `${REL_ARTIFACTS}/${file}`;
}

function recordError(kind, text, url = "") {
  if (!current) return;
  const hit = EXPECTED_NETWORK.find((x) => x.re.test(text) || x.re.test(url));
  const entry = { kind, text: norm(text).slice(0, 300), where, expected: Boolean(hit) };
  current.errors.push(entry);
  if (hit) run.network.set(hit.why, (run.network.get(hit.why) ?? 0) + 1);
}

/* -------------------------------------------------------------- page helpers */

/** Top-left corner of the header: no tooltip trigger there, so no tooltip can take an Esc or cover a screenshot. */
async function parkMouse() {
  await page.mouse.move(2, 2);
}

async function waitReady() {
  await page.waitForFunction(
    () => !document.getElementById("splash") && (document.getElementById("root")?.childElementCount ?? 0) > 0,
    null,
    { timeout: 30_000 },
  );
}

async function gotoRoute(route) {
  await page.goto(`${APP}#/${route}`);
}

async function waitSlide(id, timeout = 15_000) {
  await page.waitForFunction(
    (sid) => {
      const a = document.querySelector("main [data-slide-stage] article.slide-page");
      return Boolean(a && a.querySelector("h1") && a.textContent.includes(`${sid} ·`));
    },
    id,
    { timeout },
  );
}

async function openSlide(id) {
  await gotoRoute(`s/${id}`);
  await waitSlide(id);
}

async function setPanel(open) {
  const btn = page.getByTestId("open-protocol");
  if (((await btn.getAttribute("aria-pressed")) === "true") !== open) await btn.click();
  await page.locator("aside[data-live-protocol]").waitFor({ state: open ? "visible" : "detached" });
}

/** Content stores exactly as the app keeps them, plus the interview ids from IndexedDB. */
async function readState() {
  return page.evaluate(async (keys) => {
    const json = (k) => {
      try {
        return JSON.parse(localStorage.getItem(k) || "null");
      } catch {
        return null;
      }
    };
    const raw = Object.fromEntries(Object.entries(keys).map(([name, key]) => [name, localStorage.getItem(key)]));
    const ws = json(keys.workshop);
    const poster = json(keys.poster);
    const glossary = json(keys.glossary);
    const report = json(keys.report);
    const group = json(keys.group);
    let interviews = [];
    const dbs = await indexedDB.databases();
    // Never open a database the app has not created yet: an empty v1 database would block its upgrade.
    if (dbs.some((d) => d.name === "verbands-ceo-interviews")) {
      const db = await new Promise((res, rej) => {
        const r = indexedDB.open("verbands-ceo-interviews");
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      });
      try {
        if (db.objectStoreNames.contains("interviews")) {
          interviews = await new Promise((res, rej) => {
            const q = db.transaction("interviews").objectStore("interviews").getAll();
            q.onsuccess = () => res(q.result.map((iv) => ({ id: iv.id, pseudonym: iv.pseudonym, hasAudio: Boolean(iv.audio) })));
            q.onerror = () => rej(q.error);
          });
        }
      } finally {
        db.close();
      }
    }
    return {
      raw,
      entries: ws?.entries ?? {},
      meta: ws?.meta ?? null,
      drafts: poster?.drafts ?? {},
      prefs: poster?.prefs ?? null,
      glossaryTerms: Array.isArray(glossary?.terms) ? glossary.terms.length : 0,
      report: typeof report?.markdown === "string" ? report.markdown : "",
      group: typeof group?.text === "string" ? group.text : "",
      interviews: interviews.sort((a, b) => a.id.localeCompare(b.id)),
    };
  }, STORE_KEYS);
}

const stateCounts = (st) => countsOf(st.entries, st.interviews.length, st.drafts, st.glossaryTerms);

async function readSnapshots(withPayloadOf = null) {
  return page.evaluate(async (payloadId) => {
    const dbs = await indexedDB.databases();
    if (!dbs.some((d) => d.name === "verbands-ceo-autobackup")) return { list: [], payload: null };
    const db = await new Promise((res, rej) => {
      const r = indexedDB.open("verbands-ceo-autobackup");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    try {
      if (!db.objectStoreNames.contains("snapshots")) return { list: [], payload: null };
      const get = (store, fn) =>
        new Promise((res, rej) => {
          const q = fn(db.transaction(store).objectStore(store));
          q.onsuccess = () => res(q.result);
          q.onerror = () => rej(q.error);
        });
      const all = await get("snapshots", (s) => s.getAll());
      const list = all
        .sort((a, b) => b.id.localeCompare(a.id))
        .map((m) => ({ id: m.id, createdAt: m.createdAt, reason: m.reason, bytes: m.bytes, summary: m.summary }));
      const payload = payloadId ? ((await get("payloads", (s) => s.get(payloadId)))?.json ?? null) : null;
      return { list, payload };
    } finally {
      db.close();
    }
  }, withPayloadOf);
}

/** Waits until no snapshot is being written any more (list unchanged for a moment). */
async function settleSnapshots(timeoutMs = 20_000) {
  const end = Date.now() + timeoutMs;
  let last = JSON.stringify((await readSnapshots()).list.map((m) => m.id));
  let stableSince = Date.now();
  while (Date.now() < end) {
    await sleep(400);
    const now = JSON.stringify((await readSnapshots()).list.map((m) => m.id));
    if (now !== last) {
      last = now;
      stableSince = Date.now();
    } else if (Date.now() - stableSince > 2_000) break;
  }
  return (await readSnapshots()).list;
}

async function readFolder() {
  return page.evaluate(async (dirName) => {
    const root = await navigator.storage.getDirectory();
    let dir;
    try {
      dir = await root.getDirectoryHandle(dirName);
    } catch {
      return [];
    }
    const out = [];
    for await (const [name, handle] of dir.entries()) {
      if (handle.kind !== "file") continue;
      const f = await handle.getFile();
      out.push({ name, size: f.size, text: await f.text() });
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }, FOLDER_NAME);
}

/** Checks a backup file the way backup.ts reads it; returns counts or an error text. */
function inspectBackup(text) {
  let file;
  try {
    file = JSON.parse(text);
  } catch {
    return { ok: false, why: "keine gültige JSON-Datei" };
  }
  if (file?.format !== "verbands-ceo-backup") return { ok: false, why: `format=${file?.format}` };
  if (file.version !== 1) return { ok: false, why: `version=${file.version}` };
  const counts = countsOf(
    file.stores?.workshop?.entries,
    Array.isArray(file.interviews) ? file.interviews.length : 0,
    file.stores?.poster?.drafts,
    file.stores?.glossary?.terms?.length ?? 0,
  );
  return { ok: true, counts, file };
}

async function download(trigger, name) {
  const [dl] = await Promise.all([page.waitForEvent("download", { timeout: 30_000 }), trigger()]);
  const failure = await dl.failure();
  if (failure) throw new Error(`Download ${name} fehlgeschlagen: ${failure}`);
  const file = path.join(DOWNLOADS, dl.suggestedFilename());
  await dl.saveAs(file);
  return { file, rel: path.relative(ROOT, file).replace(/\\/g, "/"), name: dl.suggestedFilename(), size: fs.statSync(file).size };
}

/** Minimal ZIP reader (stored + deflate) — enough to open a .docx without a dependency. */
function readZipEntry(buf, wanted) {
  let eocd = -1;
  for (let i = buf.length - 22; i >= Math.max(0, buf.length - 65_557); i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error("keine ZIP-Datei");
  const count = buf.readUInt16LE(eocd + 10);
  let off = buf.readUInt32LE(eocd + 16);
  const names = [];
  let content = null;
  for (let n = 0; n < count; n++) {
    if (buf.readUInt32LE(off) !== 0x02014b50) throw new Error("ZIP-Verzeichnis beschädigt");
    const method = buf.readUInt16LE(off + 10);
    const size = buf.readUInt32LE(off + 20);
    const nameLen = buf.readUInt16LE(off + 28);
    const extraLen = buf.readUInt16LE(off + 30);
    const commentLen = buf.readUInt16LE(off + 32);
    const local = buf.readUInt32LE(off + 42);
    const name = buf.toString("utf8", off + 46, off + 46 + nameLen);
    names.push(name);
    if (name === wanted) {
      const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28);
      const data = buf.subarray(start, start + size);
      content = method === 0 ? data : zlib.inflateRawSync(data);
    }
    off += 46 + nameLen + extraLen + commentLen;
  }
  return { names, content };
}

const xmlText = (xml) =>
  xml
    .replace(/<w:tab\/>/g, " ")
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

/* ------------------------------------------------------------ build + server */

function runCommand(command, logFile) {
  return new Promise((resolve) => {
    const env = { ...process.env };
    delete env.BASE_PATH;
    const child = spawn(command, { cwd: ROOT, env, shell: true, stdio: ["ignore", "pipe", "pipe"] });
    const out = fs.createWriteStream(logFile);
    let tail = "";
    const onData = (d) => {
      out.write(d);
      tail = (tail + d.toString()).slice(-3000);
    };
    child.stdout.on("data", onData);
    child.stderr.on("data", onData);
    child.on("close", (code) => {
      out.end();
      resolve({ code, tail });
    });
  });
}

async function isUp() {
  try {
    const res = await fetch(APP, { signal: AbortSignal.timeout(1500) });
    return res.ok;
  } catch {
    return false;
  }
}

async function startPreview() {
  if (await isUp()) throw new Error(`Port ${PORT} ist schon belegt. Bitte den dort laufenden Server beenden und erneut starten.`);
  const env = { ...process.env };
  delete env.BASE_PATH;
  const child = spawn(
    process.execPath,
    [path.join(ROOT, "node_modules/vite/bin/vite.js"), "preview", "--port", String(PORT), "--strictPort", "--host", "localhost"],
    { cwd: ROOT, env, stdio: ["ignore", "pipe", "pipe"] },
  );
  let output = "";
  child.stdout.on("data", (d) => (output += d));
  child.stderr.on("data", (d) => (output += d));
  const end = Date.now() + 30_000;
  while (Date.now() < end) {
    if (child.exitCode !== null) throw new Error(`vite preview beendet sich sofort: ${norm(output).slice(-400)}`);
    if (await isUp()) return child;
    await sleep(300);
  }
  child.kill();
  throw new Error(`vite preview antwortet nicht auf ${APP}: ${norm(output).slice(-400)}`);
}

/* -------------------------------------------------------------------- steps */

const shared = {};

async function step1() {
  await page.goto(APP);
  await waitReady();
  const landing = page.locator("h1", { hasText: "Fiktion oder Realität" }).first();
  await landing.waitFor();
  const start = page.locator(`a[href="#/s/${SLIDES[0].id}"]`).first();
  check("Landing Page erscheint", await start.isVisible(), `Einstieg „Workshop starten“ führt zu Folie ${SLIDES[0].id}`, await screenshot("landing"));

  const empty = await readState();
  const snaps = (await readSnapshots()).list;
  check(
    "Gerät ist leer",
    sameCounts(stateCounts(empty), { entries: 0, interviews: 0, posterFields: 0, glossaryTerms: 0 }) && snaps.length === 0,
    `${countLine(stateCounts(empty))} · ${snaps.length} Zwischenstände`,
  );

  await start.click();
  await waitSlide(SLIDES[0].id);
  check("Erste Folie öffnet sich", page.url().endsWith(`#/s/${SLIDES[0].id}`), page.url().replace(ORIGIN, ""), await screenshot("erste-folie"));

  await gotoRoute("systemcheck");
  await page.getByTestId("syscheck-run-all").click();
  await page.waitForFunction(
    () => {
      const btn = document.querySelector("[data-testid=syscheck-run-all]");
      const rows = [...document.querySelectorAll("[data-testid^=syscheck-row-]")];
      return btn && !btn.disabled && rows.length > 0 && rows.every((r) => !["open", "running"].includes(r.dataset.verdict));
    },
    null,
    { timeout: 180_000 },
  );
  const rows = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid^=syscheck-row-]")].map((r) => ({
      id: r.dataset.testid.replace("syscheck-row-", ""),
      verdict: r.dataset.verdict,
      finding: r.querySelector("[data-testid^=syscheck-finding-]")?.textContent.trim() ?? "",
    })),
  );
  const labels = { ok: "OK", warn: "Achtung", fail: "Problem", skipped: "übersprungen" };
  const allDone = rows.length === 10 && rows.every((r) => ["ok", "warn", "fail", "skipped"].includes(r.verdict));
  check(
    "Technik-Check: „Alles prüfen“ liefert für jede Zeile ein Ergebnis",
    allDone,
    `${rows.length} Zeilen: ${rows.map((r) => `${r.id} ${labels[r.verdict] ?? r.verdict}`).join(", ")}`,
    await screenshot("technik-check", { fullPage: true }),
  );
  for (const r of rows.filter((x) => x.verdict === "fail" || x.verdict === "warn")) {
    note(`Technik-Check ${r.id} (${labels[r.verdict]}): ${r.finding}`);
  }

  await openSlide(SLIDES[0].id);
  await page.keyboard.press("?");
  const help = page.locator('[role=dialog][aria-labelledby="help-title"]');
  await help.waitFor({ timeout: 5_000 }).catch(() => {});
  check("Hilfe öffnet per Taste ?", await help.isVisible(), "", await screenshot("hilfe"));
  await parkMouse();
  await page.keyboard.press("Escape");
  await help.waitFor({ state: "detached", timeout: 5_000 }).catch(() => {});
  check("Hilfe schließt per Esc", !(await help.isVisible()));
}

async function importFixture() {
  await page.getByTestId("backup-import-input").setInputFiles(FIXTURE_PATH);
  const preview = page.getByTestId("backup-preview");
  await preview.waitFor({ timeout: 10_000 });
  return preview;
}

async function step2() {
  await gotoRoute("einstellungen");
  const stored = page.locator("#backup-heading").locator("xpath=..").locator("p", { hasText: "Aktuell gespeichert:" });
  await stored.waitFor();
  const before = (await readSnapshots()).list;

  const preview = await importFixture();
  const text = norm(await preview.innerText());
  const expectLine = countLine(FX_COUNTS);
  check(
    "Vorschau zeigt den Inhalt der Datei",
    text.includes(path.basename(FIXTURE_PATH)) && text.includes(expectLine) && !text.includes("unbekannt"),
    `erwartet „${expectLine}“ · Vorschau: ${text.slice(0, 260)}`,
    await screenshot("vorschau", { locator: preview }),
  );
  check(
    "Vorschau nennt Bericht und fehlende Aufnahmen richtig",
    text.includes(FX.report?.markdown ? "Ergebnisbericht" : "kein Ergebnisbericht") &&
      text.includes(FX.interviews.some((iv) => iv.audio) || fixture.withAudio ? "mit Interview-Aufnahmen" : "ohne Interview-Aufnahmen"),
  );

  await page.getByRole("button", { name: "Einlesen und ersetzen" }).click();
  const done = page.getByRole("status").filter({ hasText: "Sicherung eingelesen" });
  await done.waitFor({ timeout: 20_000 });
  check("Einlesen meldet Erfolg mit den Zahlen der Datei", norm(await done.innerText()).includes(expectLine), norm(await done.innerText()));

  const st = await readState();
  const counts = stateCounts(st);
  const shown = norm(await stored.innerText()).replace("Aktuell gespeichert: ", "");
  check(
    "Zahlen nach dem Einlesen stimmen mit der Datei überein",
    sameCounts(counts, FX_COUNTS) && shown === expectLine,
    `Datei: ${expectLine} · Speicher: ${countLine(counts)} · Anzeige: ${shown}`,
    await screenshot("eingelesen", { fullPage: true }),
  );
  const diff = Object.keys({ ...FX.entries, ...st.entries }).filter(
    (id) => JSON.stringify(FX.entries[id]?.value) !== JSON.stringify(st.entries[id]?.value),
  );
  check("Beiträge inhaltlich identisch mit der Datei", diff.length === 0, diff.length ? `abweichend: ${diff.slice(0, 8).join(", ")}` : `${counts.entries} Beiträge verglichen`);
  check(
    "Interviews, Gruppenbild und Ergebnisbericht übernommen",
    st.interviews.length === FX.interviews.length &&
      st.interviews.every((iv) => FX.interviews.some((f) => f.id === iv.id)) &&
      st.group === (FX.group?.text ?? "") &&
      st.report === (FX.report?.markdown ?? ""),
    `${st.interviews.map((iv) => iv.pseudonym).join(", ")} · Gruppenbild ${st.group ? "ja" : "nein"} · Bericht ${st.report ? "ja" : "nein"}`,
  );

  // Safety snapshot: an empty device has nothing to lose, so the app deliberately takes none there
  // (auto-backup.ts, hasContent). Reading the file a second time is the real case — a device with content.
  const afterFirst = (await readSnapshots()).list;
  note(
    `Erstes Einlesen auf dem leeren Gerät: ${afterFirst.length - before.length} Zwischenstand angelegt (gewollt: ein leeres Gerät wird nicht gesichert).`,
  );
  const preview2 = await importFixture();
  const warn = norm(await preview2.innerText());
  check("Zweites Einlesen warnt vor dem Ersetzen des aktuellen Stands", warn.includes(`Einlesen ersetzt den aktuellen Stand (${expectLine})`), warn.slice(-200));
  await page.getByRole("button", { name: "Einlesen und ersetzen" }).click();
  await page.getByRole("status").filter({ hasText: "Sicherung eingelesen" }).waitFor({ timeout: 20_000 });
  const after = await settleSnapshots(8_000);
  const safety = after.find((m) => !afterFirst.some((x) => x.id === m.id) && m.reason === "before-restore");
  check(
    "Vor dem Einlesen wurde automatisch ein Zwischenstand angelegt",
    Boolean(safety) && sameCounts(safety.summary, FX_COUNTS),
    safety
      ? `„vor dem Einlesen einer Datei“, ${countLine(safety.summary)}, ${safety.createdAt}`
      : `Zwischenstände vorher ${afterFirst.length}, nachher ${after.length}: ${after.map((m) => m.reason).join(", ")}`,
    await screenshot("zwischenstand-vor-einlesen", { locator: page.getByTestId("auto-backup-section") }),
  );
  shared.step2 = await readState();
  shared.step2Counts = stateCounts(shared.step2);
}

async function step3() {
  const before = shared.step2 ?? (await readState());
  const fx = before.entries;
  const problems = [];
  const fieldProblems = [];
  const checkedSlides = new Set();
  const checkedModules = new Set();
  let checkedFields = 0;
  let skipped = 0;
  let reminderSeen = "";

  for (const slide of SLIDES) {
    where = `Folie ${slide.id}`;
    const errorsBefore = current.errors.filter((e) => !e.expected).length;
    try {
      await openSlide(slide.id);
    } catch (err) {
      problems.push(`${slide.id}: keine Überschrift (${oneLine(err)})`);
      continue;
    }
    await sleep(350);
    const h1 = norm(await page.locator("main [data-slide-stage] article.slide-page h1").first().textContent());
    if (!h1) problems.push(`${slide.id}: leere Überschrift`);

    const expected = (FIELDS.get(slide.id) ?? [])
      .map((f) => ({ ...f, entry: fx[`${slide.id}:${f.field}`] }))
      .filter((f) => f.entry && (Array.isArray(f.entry.value) ? f.entry.value.length : String(f.entry.value).trim()));
    const verifiable = expected.filter((f) => f.component === "WorkshopInput" || f.component === "CardCollector");
    skipped += expected.length - verifiable.length;
    if (verifiable.length) {
      const misses = await page.evaluate(
        ({ slideId, fields }) => {
          const main = document.querySelector("main [data-slide-stage]");
          const out = [];
          for (const f of fields) {
            const v = f.entry.value;
            if (f.component === "CardCollector") {
              const shown = [...main.querySelectorAll(`[data-card-collector="${slideId}:${f.field}"] [data-card] button.text-left`)].map((b) =>
                b.textContent.trim(),
              );
              const want = (Array.isArray(v) ? v : [v]).map((l) => (f.prefixed ? l.replace(/^\[[^\]]+\]\s*/, "").replace(/^\{[^}]+\}\s*/, "") : l).trim());
              const missing = want.filter((w) => !shown.includes(w));
              if (missing.length) out.push(`${f.field}: ${missing.length} von ${want.length} Karten fehlen`);
            } else if (f.kind === "text") {
              if (![...main.querySelectorAll("textarea")].some((t) => t.value === v)) out.push(`${f.field}: Text nicht im Feld`);
            } else if (f.kind === "checklist") {
              const opts = Array.isArray(v) ? v : [v];
              const active = [...main.querySelectorAll("button")].filter((b) => b.querySelector("span svg")).map((b) => b.textContent.trim());
              const missing = opts.filter((o) => !active.includes(o));
              if (missing.length) out.push(`${f.field}: nicht angehakt: ${missing.join(", ")}`);
            } else {
              const on = [...main.querySelectorAll("button")].some(
                (b) => b.textContent.trim() === v && getComputedStyle(b).color === "rgb(255, 255, 255)",
              );
              if (!on) out.push(`${f.field}: Auswahl „${v}“ nicht markiert`);
            }
          }
          return out;
        },
        { slideId: slide.id, fields: verifiable },
      );
      checkedFields += verifiable.length;
      checkedSlides.add(slide.id);
      checkedModules.add(slide.module);
      for (const m of misses) fieldProblems.push(`${slide.id} ${m}`);
    }

    const newErrors = current.errors.filter((e) => !e.expected).length - errorsBefore;
    await page.screenshot({ path: path.join(ARTIFACTS, `03-folie-${slide.id}.png`) });
    if (newErrors) problems.push(`${slide.id}: ${newErrors} Fehler (siehe unten)`);

    const reminder = page.getByTestId("auto-backup-reminder");
    if (await reminder.isVisible()) {
      reminderSeen += `${reminderSeen ? ", " : ""}${slide.id}`;
      await page.getByRole("button", { name: "Erinnerung schließen" }).click();
    }
  }
  where = "Folien";

  check(
    "Alle Folien des Manifests rendern eine Überschrift",
    problems.length === 0,
    problems.length ? problems.slice(0, 10).join(" | ") : `${SLIDES.length} Folien · Screenshots ${REL_ARTIFACTS}/03-folie-<id>.png`,
    `${REL_ARTIFACTS}/03-folie-${SLIDES[0].id}.png`,
  );
  const modules = [...new Set(SLIDES.filter((s) => s.module !== 99).map((s) => s.module))];
  check(
    "Werte aus der Fixture stehen sichtbar in den Feldern",
    fieldProblems.length === 0 && checkedSlides.size >= 15 && modules.every((m) => checkedModules.has(m)),
    `${checkedFields} Felder auf ${checkedSlides.size} Folien in Modul ${[...checkedModules].sort((a, b) => a - b).join(", ")} geprüft` +
      (skipped ? ` (${skipped} abgeleitete Barometer-Auswertungen nicht als Feld prüfbar)` : "") +
      (fieldProblems.length ? ` · Abweichungen: ${fieldProblems.slice(0, 8).join(" | ")}` : ""),
    `${REL_ARTIFACTS}/03-folie-03.04.png`,
  );
  if (reminderSeen) note(`Tagesend-Erinnerung erschien beim Durchblättern auf ${reminderSeen} (einmal pro Tag) und wurde geschlossen.`);

  const after = await readState();
  const changed = Object.keys({ ...before.entries, ...after.entries }).filter(
    (id) => JSON.stringify(before.entries[id]?.value) !== JSON.stringify(after.entries[id]?.value),
  );
  if (changed.length) note(`Beim Durchblättern haben sich Beiträge verändert: ${changed.join(", ")}`);
  else note("Das Durchblättern hat keinen Beitrag verändert.");
}

/** Entries in the order a view lists them, mapped back to their ids. */
async function listedIds(selector, entries) {
  const items = await page.evaluate((sel) => {
    return [...document.querySelectorAll(sel)]
      .map((meta) => {
        const m = /^(\d\d\.\d\d) · (text|decision|vote|checklist)/.exec(meta.textContent.trim());
        if (!m) return null;
        const card = meta.parentElement;
        return {
          slideId: m[1],
          prompt: card.querySelector(".font-medium")?.textContent.trim() ?? "",
          value: card.querySelector(".whitespace-pre-wrap")?.textContent ?? "",
        };
      })
      .filter(Boolean);
  }, selector);
  const used = new Set();
  return items.map((it) => {
    const candidates = Object.values(entries).filter((e) => e.slideId === it.slideId && e.prompt === it.prompt && !used.has(e.id));
    const hit =
      candidates.length > 1 ? (candidates.find((e) => norm(it.value).startsWith(norm(valueText(e.value)).slice(0, 20))) ?? candidates[0]) : candidates[0];
    const id = hit?.id ?? `?${it.slideId}:${it.prompt.slice(0, 30)}`;
    used.add(id);
    return id;
  });
}

/** Deck order: slide position, then position of declared fields on the slide. */
function orderProblems(ids) {
  const out = [];
  const fieldPos = (id) => {
    const [slideId, field] = id.split(":");
    const i = (FIELDS.get(slideId) ?? []).findIndex((f) => f.field === field);
    return i < 0 ? null : i;
  };
  for (let i = 1; i < ids.length; i++) {
    const [a, b] = [ids[i - 1], ids[i]];
    const [sa, sb] = [SLIDE_INDEX.get(a.split(":")[0]) ?? 999, SLIDE_INDEX.get(b.split(":")[0]) ?? 999];
    if (sb < sa) out.push(`${b} nach ${a}`);
    else if (sa === sb) {
      const [fa, fb] = [fieldPos(a), fieldPos(b)];
      if (fa !== null && fb !== null && fb < fa) out.push(`${b} nach ${a}`);
    }
  }
  return out;
}

async function step4() {
  const slideId = "03.04";
  const fields = FIELDS.get(slideId) ?? [];
  const first = fields[0];
  const last = fields[fields.length - 1];
  const stamp = new Date();
  shared.newText = `Generalprobe ${pad2(stamp.getHours())}:${pad2(stamp.getMinutes())}: Er bereitet Antworten vor, der Mensch entscheidet.`;
  shared.noteText = `Notiz aus der Generalprobe ${pad2(stamp.getHours())}:${pad2(stamp.getMinutes())}: Rolle gemeinsam geschärft.`;
  shared.fieldId = `${slideId}:${first.field}`;
  shared.noteId = `${slideId}:notiz`;
  const alphabetical = [...fields].map((f) => f.field).sort();
  note(
    `Folie ${slideId}: Feld „${first.field}“ steht auf der Folie an erster Stelle, alphabetisch an Stelle ${alphabetical.indexOf(first.field) + 1} von ${fields.length}.`,
  );

  await openSlide(slideId);
  await setPanel(true);
  const state = await readState();
  const oldValue = valueText(state.entries[shared.fieldId]?.value);
  const marked = await page.evaluate((v) => {
    const t = [...document.querySelectorAll("main [data-slide-stage] textarea")].find((x) => x.value === v);
    if (t) t.setAttribute("data-generalprobe", "feld");
    return Boolean(t);
  }, oldValue);
  if (!marked) throw new Error(`Feld ${shared.fieldId} mit dem Fixture-Text nicht gefunden`);
  const field = page.locator("textarea[data-generalprobe=feld]");
  await field.click();
  await page.keyboard.press("Control+A");
  await page.keyboard.type(shared.newText, { delay: 5 });
  const panel = page.locator("aside[data-live-protocol]");
  const t0 = Date.now();
  await panel.getByText(shared.newText).first().waitFor({ timeout: 2_000 }).catch(() => {});
  check(
    "Eingabe auf der Folie erscheint sofort im Live-Protokoll",
    await panel.getByText(shared.newText).first().isVisible(),
    `nach ${Date.now() - t0} ms`,
    await screenshot("live-protokoll-feld"),
  );

  const noteBox = panel.locator("textarea").first();
  await noteBox.click();
  await page.keyboard.type(shared.noteText, { delay: 5 });
  await panel.locator(".whitespace-pre-wrap", { hasText: shared.noteText }).first().waitFor({ timeout: 2_000 }).catch(() => {});
  check(
    "Notiz zur Folie erscheint sofort als Beitrag im Live-Protokoll",
    await panel.locator(".whitespace-pre-wrap", { hasText: shared.noteText }).first().isVisible(),
    shared.noteText,
  );
  await page.locator("main [data-slide-stage] h1").first().click();

  const live = await readState();
  check(
    "Genau ein neuer Beitrag, das Feld ist aktualisiert",
    stateCounts(live).entries === shared.step2Counts.entries + 1 && live.entries[shared.fieldId]?.value === shared.newText,
    `Beiträge ${shared.step2Counts.entries} → ${stateCounts(live).entries}`,
  );

  const panelIds = await listedIds("aside[data-live-protocol] div.font-mono", live.entries);
  const panelSlide = panelIds.filter((id) => id.startsWith(`${slideId}:`));
  const panelOrder = orderProblems(panelIds);
  check(
    "Live-Protokoll ordnet nach Folien und Feldposition",
    panelOrder.length === 0 && panelSlide[0] === shared.fieldId && panelSlide[panelSlide.length - 1] === shared.noteId,
    panelOrder.length ? panelOrder.slice(0, 5).join(" | ") : `${slideId}: ${panelSlide.map((id) => id.split(":")[1]).join(" → ")}`,
  );

  await gotoRoute("protokoll");
  await page.locator("main h1").first().waitFor();
  await page.getByText(shared.newText).first().waitFor({ timeout: 5_000 });
  const ids = await listedIds("main div.font-mono", live.entries);
  const at = ids.indexOf(shared.fieldId);
  const noteAt = ids.indexOf(shared.noteId);
  const order = orderProblems(ids);
  const slideIds = ids.filter((id) => id.startsWith(`${slideId}:`));
  const next = ids[noteAt + 1] ?? "";
  const prev = ids[at - 1] ?? "";
  await page.locator(`text=${shared.newText}`).first().scrollIntoViewIfNeeded();
  check(
    "#/protokoll zeigt den Beitrag an der Folienposition",
    at >= 0 &&
      order.length === 0 &&
      slideIds[0] === shared.fieldId &&
      slideIds[slideIds.length - 1] === shared.noteId &&
      (SLIDE_INDEX.get(prev.split(":")[0]) ?? -1) < SLIDE_INDEX.get(slideId) &&
      (SLIDE_INDEX.get(next.split(":")[0]) ?? 999) > SLIDE_INDEX.get(slideId),
    order.length
      ? `Reihenfolgefehler: ${order.slice(0, 5).join(" | ")}`
      : `Position ${at + 1} von ${ids.length}: nach ${prev}, ${slideId} = ${slideIds.map((id) => id.split(":")[1]).join(" → ")}, danach ${next} (erstes Feld „${first.field}“, letztes „${last.field}“, Notiz dahinter)`,
    await screenshot("protokoll-position"),
  );
  shared.afterStep4 = live;
}

async function step5() {
  const st = await readState();
  const record = recordOf(st.entries);
  const poster = (key) => POSTERS.find((p) => p.key === key);
  const field = (key, fieldKey) => poster(key).fields.find((f) => f.key === fieldKey);
  const kern = posterValue(st.drafts, "need-to-move", field("need-to-move", "kernproblem"), record);
  const stoss = toLines(posterValue(st.drafts, "moeglichkeitsraum", field("moeglichkeitsraum", "stossrichtungen"), record)).slice(0, 5);
  const leitsatz = posterValue(st.drafts, "zielbild", field("zielbild", "leitsatz"), record);
  const openLines = toLines(record["03.06:tag1-offen"]);
  const openQs = Object.values(st.entries)
    .filter((e) => e.module <= 3 && e.id.split(":")[1]?.startsWith("q-") && e.prompt.trim() && !valueText(e.value).trim())
    .map((e) => e.prompt.trim());

  await openSlide("04.00");
  const recap = page.locator("[data-day-recap]");
  await recap.waitFor();
  const text = async (sel) => norm(await page.locator(sel).first().textContent());
  const kernText = await text("[data-recap-phase=need-to-move]");
  const stossText = await text("[data-recap-phase=moeglichkeitsraum]");
  const zielText = await text("[data-recap-phase=zielbild]");
  const openText = await text("[data-recap-open]");
  const shot = await screenshot("rueckblick", { locator: recap });
  check("Rückblick zeigt das Kernproblem", kern && kernText.includes(norm(toLines(kern)[0])), `„${toLines(kern)[0]}“`, shot);
  const missingStoss = stoss.filter((l) => !stossText.includes(norm(l)));
  check("Rückblick zeigt die Stoßrichtungen", stoss.length > 0 && missingStoss.length === 0, missingStoss.length ? `fehlt: ${missingStoss.join(" | ")}` : stoss.join(" · "));
  check("Rückblick zeigt den Leitsatz", leitsatz && zielText.includes(norm(toLines(leitsatz)[0])), `„${leitsatz}“`);
  const wantOpen = [...openLines, ...openQs];
  const missingOpen = wantOpen.filter((l) => !openText.includes(norm(l)));
  check("Rückblick zeigt die offenen Fragen", wantOpen.length > 0 && missingOpen.length === 0, missingOpen.length ? `fehlt: ${missingOpen.join(" | ")}` : wantOpen.join(" · "));
  const stats = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("[data-recap-stat]")].map((el) => [el.dataset.recapStat, Number(el.querySelector("span")?.textContent)])),
  );
  const people = (st.meta?.participantsList ?? []).filter((p) => [p.lastName, p.firstName, p.organisation, p.role].some((x) => String(x ?? "").trim())).length;
  check(
    "Kennzahlen im Rückblick passen (Interviews, Teilnehmende)",
    stats["KI-Interviews"] === st.interviews.length && stats.Teilnehmende === people,
    JSON.stringify(stats),
  );
}

async function step6() {
  const st = await readState();
  const expectedEntries = stateCounts(st).entries;
  const samples = [
    FX.meta.title ? sample(FX.meta.title, 40) : null,
    sample(valueText(st.entries["01.06:poster-kernproblem"]?.value)),
    sample(valueText(st.entries["07.04:beschluss-text"]?.value)),
    sample(shared.newText, 60),
    sample(shared.noteText, 60),
  ].filter(Boolean);
  const missingIn = (text) => samples.filter((s) => !norm(text).includes(norm(s)));

  await gotoRoute("protokoll");
  await page.locator("main h1").first().waitFor();
  const bar = page.locator("main section", { has: page.getByRole("button", { name: "JSON", exact: true }) }).first();

  // Word
  const word = await download(() => bar.getByRole("button", { name: "Word", exact: true }).click(), "Word");
  let wordText = "";
  let zipNames = [];
  try {
    const { names, content } = readZipEntry(fs.readFileSync(word.file), "word/document.xml");
    zipNames = names;
    wordText = content ? xmlText(content.toString("utf8")) : "";
  } catch (err) {
    wordText = "";
    zipNames = [`Fehler: ${oneLine(err)}`];
  }
  const wordMissing = missingIn(wordText);
  check(
    "Word-Export: .docx heruntergeladen, entpackbar, mit Fixture-Inhalten",
    word.name.endsWith(".docx") && word.size > 10_000 && wordText.length > 2_000 && wordMissing.length === 0,
    `${word.name}, ${Math.round(word.size / 1024)} KB, ${zipNames.length} Teile, ${wordText.length} Zeichen Text` +
      (wordMissing.length ? ` · fehlt: ${wordMissing.join(" | ")}` : ` · enthält ${samples.length} Stichproben`),
    word.rel,
  );

  // PDF: the app hands a designed HTML document to the browser's print dialog. The script
  // catches that document at the print() call and prints it with Chromium's PDF engine.
  await page.evaluate(() => {
    window.__generalprobePrint = null;
    const obs = new MutationObserver((records) => {
      for (const r of records) {
        for (const node of r.addedNodes) {
          if (node.tagName !== "IFRAME") continue;
          const win = node.contentWindow;
          if (!win) continue;
          win.print = () => {
            window.__generalprobePrint = { html: win.document.documentElement.outerHTML, text: win.document.body.textContent };
          };
        }
      }
    });
    obs.observe(document.body, { childList: true });
    window.__generalprobeObserver = obs;
  });
  await bar.getByRole("button", { name: "PDF", exact: true }).click();
  await page.waitForFunction(() => Boolean(window.__generalprobePrint), null, { timeout: 30_000 });
  const printed = await page.evaluate(() => {
    window.__generalprobeObserver?.disconnect();
    return window.__generalprobePrint;
  });
  const pdfPage = await context.newPage();
  const pdfFile = path.join(DOWNLOADS, `workshop-protokoll-druckansicht.pdf`);
  await pdfPage.setContent(printed.html.replace(/<head([^>]*)>/i, `<head$1><base href="${APP}">`), { waitUntil: "load" });
  await pdfPage.pdf({ path: pdfFile, preferCSSPageSize: true, printBackground: true });
  await pdfPage.close();
  const pdfBuf = fs.readFileSync(pdfFile);
  const pages = (pdfBuf.toString("latin1").match(/\/Type\s*\/Page(?![s\w])/g) ?? []).length;
  const pdfMissing = missingIn(printed.text);
  check(
    "PDF-Export: Druckdialog wird mit dem Protokoll aufgerufen, PDF entsteht",
    pdfBuf.subarray(0, 5).toString() === "%PDF-" && pdfBuf.length > 50_000 && pages >= 3 && pdfMissing.length === 0,
    `${Math.round(pdfBuf.length / 1024)} KB, ${pages} Seiten` + (pdfMissing.length ? ` · fehlt im Druckdokument: ${pdfMissing.join(" | ")}` : " · Druckdokument enthält alle Stichproben"),
    path.relative(ROOT, pdfFile).replace(/\\/g, "/"),
  );

  // Markdown
  const md = await download(() => bar.getByRole("button", { name: "Markdown", exact: true }).click(), "Markdown");
  const mdText = fs.readFileSync(md.file, "utf8");
  const mdMissing = missingIn(mdText);
  check(
    "Markdown-Export: heruntergeladen, vollständig, mit Fixture-Inhalten",
    md.size > 5_000 && mdText.startsWith("# Workshop-Protokoll") && mdText.includes(`**Erfasste Beiträge:** ${expectedEntries}`) && mdMissing.length === 0,
    `${md.name}, ${Math.round(md.size / 1024)} KB` + (mdMissing.length ? ` · fehlt: ${mdMissing.join(" | ")}` : ` · „Erfasste Beiträge: ${expectedEntries}“`),
    md.rel,
  );

  // JSON
  const js = await download(() => bar.getByRole("button", { name: "JSON", exact: true }).click(), "JSON");
  let parsed = null;
  try {
    parsed = JSON.parse(fs.readFileSync(js.file, "utf8"));
  } catch {
    parsed = null;
  }
  check(
    "JSON-Export: heruntergeladen, gültig, alle Beiträge",
    parsed &&
      Object.keys(parsed.entries ?? {}).length === expectedEntries &&
      parsed.meta?.title === FX.meta.title &&
      parsed.entries?.[shared.fieldId]?.value === shared.newText &&
      parsed.entries?.[shared.noteId]?.value === shared.noteText,
    parsed ? `${js.name}, ${Math.round(js.size / 1024)} KB, ${Object.keys(parsed.entries ?? {}).length} Beiträge` : `${js.name}: kein gültiges JSON`,
    js.rel,
  );
  await screenshot("protokoll-exporte");

  // File names carry a date — it should be the local calendar day of the workshop room.
  const wrongDay = [word, md, js].filter((f) => /\d{4}-\d{2}-\d{2}/.test(f.name) && !f.name.includes(localDay()));
  if (wrongDay.length) {
    finding(
      "Exportdateien tragen das UTC-Datum statt des lokalen Datums",
      `Heruntergeladen am ${localDay()} (lokal): ${wrongDay.map((f) => f.name).join(", ")}. Ursache: \`new Date().toISOString().slice(0, 10)\` in src/lib/protocol-export.ts, src/lib/export-model.ts, src/routes/Protocol.tsx, src/components/LiveProtocolPanel.tsx (Aufnahmen: src/components/RecorderMenu.tsx, src/components/AudioRecorder.tsx). Betrifft nur Exporte zwischen 0 und 2 Uhr; die Sicherungsdateien (backup.ts) nutzen bereits die lokale Zeit.`,
    );
  }
  await bar.getByRole("button", { name: "Word", exact: true }).hover();
  const tip = page.locator("[role=tooltip]");
  await tip.waitFor({ timeout: 3_000 }).catch(() => {});
  const tipText = norm(await tip.textContent().catch(() => ""));
  if (/\(\.doc\)/.test(tipText) && word.name.endsWith(".docx")) {
    finding("Tooltip des Word-Exports nennt „.doc“, die Datei ist „.docx“", `Tooltip: „${tipText}“ · Datei: ${word.name} · Quelle: EXPORT_HINTS.word in src/components/LiveProtocolPanel.tsx.`);
  }
  await parkMouse();
}

async function step7() {
  const st = await readState();
  const record = recordOf(st.entries);
  shared.posterFill = {};
  await gotoRoute("poster");
  await page.locator("[data-poster-tile]").first().waitFor();
  const tiles = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("[data-poster-tile]")].map((t) => [t.dataset.posterTile, t.querySelector("[data-fill]")?.dataset.fill])),
  );
  const fillProblems = [];
  for (const p of POSTERS) {
    const filled = p.fields.filter((f) => posterValue(st.drafts, p.key, f, record).trim()).length;
    const want = `${filled}/${p.fields.length}`;
    shared.posterFill[p.key] = tiles[p.key];
    if (tiles[p.key] !== want) fillProblems.push(`${p.key}: ${tiles[p.key]} statt ${want}`);
  }
  check(
    "Galerie zeigt alle Poster mit dem erwarteten Füllstand",
    Object.keys(tiles).length === POSTERS.length && fillProblems.length === 0,
    fillProblems.length ? fillProblems.join(" | ") : Object.entries(tiles).map(([k, v]) => `${k} ${v}`).join(", "),
    await screenshot("poster-galerie", { fullPage: true }),
  );

  const problems = [];
  const shots = [];
  for (const p of POSTERS) {
    where = `Poster ${p.key}`;
    await gotoRoute(`poster/${p.key}`);
    const sheet = page.locator(`.poster-stage .poster-sheet[data-poster="${p.key}"]`);
    await sheet.waitFor({ timeout: 10_000 });
    await sleep(300);
    const text = norm(await sheet.textContent());
    const missing = [];
    let checked = 0;
    for (const f of p.fields.filter((x) => x.kind === "text")) {
      const v = posterValue(st.drafts, p.key, f, record);
      if (!v.trim()) continue;
      const lines = v.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      const firstItem = lines.length > 1 || /^([-•*–]|\d+[.)])\s+/.test(lines[0]) ? lines[0].replace(/^([-•*–]|\d+[.)])\s+/, "") : lines.join(" ");
      checked++;
      if (!text.includes(norm(firstItem))) missing.push(`${f.key}: „${firstItem.slice(0, 50)}“`);
    }
    if (checked === 0 || missing.length) problems.push(`${p.key}: ${checked === 0 ? "keine Inhalte" : missing.join(", ")}`);
    const file = await screenshot(`poster-${p.key}`);
    shots.push(file);

    if (p.key === "need-to-move") {
      const formats = page.locator('[role=group][aria-label="Papierformat"]');
      const pick = async (fmt) => {
        await formats.getByRole("button", { name: fmt, exact: true }).click();
        await sleep(200);
        const css = await page.evaluate(() => [...document.querySelectorAll("style")].map((s) => s.textContent).find((t) => t.includes("@page")) ?? "");
        const pressed = await formats.getByRole("button", { name: fmt, exact: true }).getAttribute("aria-pressed");
        return { css: norm(css), pressed };
      };
      const initial = await formats.locator("button[aria-pressed=true]").innerText();
      const a4 = await pick("A4");
      const a0 = await pick("A0");
      const hint = norm(await page.locator(".poster-chrome p", { hasText: "Druck:" }).innerText());
      check(
        "Formatwechsel A4 → A0 stellt die Druckseite um",
        a4.pressed === "true" && a4.css.includes("size: 210mm 297mm") && a0.pressed === "true" && a0.css.includes("size: 841mm 1189mm") && hint.includes("A0 hoch"),
        `A4: ${a4.css} · A0: ${a0.css}`,
        await screenshot("poster-format-a0"),
      );
      await pick(norm(initial));
      // Park the mouse so no format tooltip covers the following screenshots.
      await parkMouse();
      await sleep(300);
    }
  }
  where = "Poster";
  check(
    "Jedes Phasen-Poster und das Filmplakat zeigen die Fixture-Inhalte",
    problems.length === 0,
    problems.length ? problems.join(" | ") : `${POSTERS.length} Poster geprüft`,
    shots[0],
  );
  shared.posterShots = shots;
}

async function step8() {
  await gotoRoute("interviews");
  await page.getByRole("tab", { name: /Meinungsbilder/ }).click();
  const cards = page.getByTestId("interview-card");
  await cards.first().waitFor({ timeout: 10_000 });
  const found = await page.evaluate(() =>
    [...document.querySelectorAll("[data-testid=interview-card]")].map((c) => ({
      name: c.querySelector('input[aria-label="Pseudonym"]')?.value ?? "",
      text: c.textContent,
    })),
  );
  const want = FX.interviews.map((iv) => iv.pseudonym);
  check(
    "Alle Interviews aus der Sicherung sind sichtbar",
    found.length === want.length && want.every((n) => found.some((f) => f.name === n)),
    `${found.map((f) => f.name).join(", ")} (erwartet ${want.join(", ")})`,
    await screenshot("interviews", { fullPage: true }),
  );
  const opinions = FX.interviews.map((iv) => sample(iv.opinion?.split("\n").find((l) => l.includes("**")) ?? "", 30));
  check(
    "Interviews zeigen Status ohne Audio",
    found.every((f) => f.text.includes("ohne Audio")),
    fixture.withAudio ? "Sicherung mit Audio" : "Sicherung ohne Audio",
  );
  const group = page.getByTestId("group-opinion");
  const groupText = norm(await group.textContent());
  const groupLines = toLines(FX.group?.text ?? "").filter((l) => !l.startsWith("#")).slice(0, 3);
  const missingGroup = groupLines.filter((l) => !groupText.includes(norm(l.replace(/\*\*/g, ""))));
  check(
    "Gemeinsames Meinungsbild ist sichtbar",
    groupLines.length > 0 && missingGroup.length === 0 && groupText.includes(`Basis: ${want.length} von ${want.length}`),
    missingGroup.length ? `fehlt: ${missingGroup.join(" | ")}` : groupLines.join(" · "),
    await screenshot("gruppenmeinung", { locator: group }),
  );
  if (opinions.some((o) => o)) note(`Einzel-Meinungsbilder vorhanden: ${opinions.filter(Boolean).join(" · ")}`);

  await openSlide("01.02");
  const picture = page.getByTestId("interview-group-picture");
  await picture.waitFor();
  const basis = norm(await page.getByTestId("group-basis").textContent());
  const haltung = norm(await page.getByTestId("group-haltung").textContent().catch(() => ""));
  check(
    "Folie 01.02 zeigt das Gruppenbild aus den Interviews",
    basis.startsWith(`${want.length} von ${want.length} Interviews`) && haltung.length > 0 && !(await page.getByTestId("group-empty").isVisible()),
    `${basis} · ${haltung.slice(0, 120)}`,
    await screenshot("folie-01-02-gruppenbild", { locator: picture }),
  );
}

async function noticesVisible() {
  return page.evaluate(() => {
    const el = document.querySelector("[data-testid=auto-backup-notices]");
    return el ? el.textContent.trim().slice(0, 120) || "(leer)" : "";
  });
}

async function step9() {
  await page.evaluate((k) => localStorage.removeItem(k), REMINDER_KEY);
  note("Tagesend-Erinnerung zurückgesetzt, damit sie beim Blättern über 03.06 im Präsentationsmodus fällig wird.");
  await openSlide("03.05");
  await setPanel(false);
  await page.getByTestId("enter-presentation").click();
  const slide = (id) => page.locator(`[data-presentation] [data-slide-id="${id}"]`);
  await slide("03.05").waitFor({ timeout: 10_000 });
  await parkMouse();
  check("Einstieg in den Präsentationsmodus", page.url().endsWith("#/p/03.05"), page.url().replace(ORIGIN, ""));

  await page.keyboard.press("ArrowRight");
  await slide("03.06").waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowLeft");
  await slide("03.05").waitFor({ timeout: 5_000 });
  await page.keyboard.press("ArrowRight");
  await slide("03.06").waitFor({ timeout: 5_000 });
  check("Pfeiltasten blättern vor und zurück", page.url().includes("#/p/03.06"), "03.05 → 03.06 → 03.05 → 03.06");

  await sleep(1_500);
  const onBeamer = await noticesVisible();
  check("Keine Sicherungshinweise am Beamer (auch nicht auf der Tagesend-Folie)", onBeamer === "", onBeamer || "Tagesend-Folie 03.06 ohne Hinweis", await screenshot("praesentation-03-06"));

  await page.keyboard.press("n");
  const notes = page.locator('[data-presentation] [data-notes-open="1"] aside[data-speaker-notes]');
  await notes.waitFor({ timeout: 5_000 }).catch(() => {});
  const notesText = norm(await notes.textContent().catch(() => ""));
  check("Taste N blendet die Sprechernotizen ein", (await notes.isVisible()) && notesText.length > 40, notesText.slice(0, 120), await screenshot("praesentation-notizen"));
  await page.keyboard.press("n");
  await page.locator('[data-presentation] [data-notes-open="0"]').waitFor({ timeout: 5_000 });

  // Clicking „Präsentieren“ leaves the mouse where the „Zurück“ button of the presentation
  // toolbar appears. Its tooltip takes the first Esc (Tooltip.tsx closes itself on Esc) —
  // probed deliberately here, then the exit is tested with the mouse on the slide.
  const exitLink = page.locator('[data-presentation] a[aria-label="Exit presentation"]');
  await exitLink.hover();
  const tip = page.locator("[role=tooltip]");
  await tip.waitFor({ timeout: 3_000 }).catch(() => {});
  if (await tip.isVisible()) {
    await page.keyboard.press("Escape");
    await sleep(600);
    if (page.url().includes("#/p/")) {
      finding(
        "Erstes Esc beendet die Präsentation nicht, solange ein Tooltip der Werkzeugleiste offen ist",
        "Nach dem Klick auf „Präsentieren“ steht die Maus genau über „Zurück“; dessen Tooltip öffnet sich und fängt Esc ab (src/components/ui/Tooltip.tsx, keydown in der Capture-Phase mit stopPropagation). Erst das zweite Esc kehrt zur Folie zurück. Reproduziert in Schritt 9 per Hover über „Zurück“.",
      );
    }
  }
  await parkMouse();
  await tip.waitFor({ state: "detached", timeout: 3_000 }).catch(() => {});

  if (page.url().includes("#/p/")) await page.keyboard.press("Escape");
  await waitSlide("03.06");
  check("Esc beendet die Präsentation und kehrt zur Folie zurück", page.url().endsWith("#/s/03.06"), page.url().replace(ORIGIN, ""));
  const reminder = page.getByTestId("auto-backup-reminder");
  await reminder.waitFor({ timeout: 5_000 }).catch(() => {});
  const back = await reminder.isVisible();
  note(
    back
      ? "Die am Beamer zurückgehaltene Tagesend-Erinnerung erscheint nach Esc in der Arbeitsansicht (so vorgesehen)."
      : "Die Tagesend-Erinnerung erschien nach Esc nicht in der Arbeitsansicht.",
  );
  await screenshot("nach-praesentation");
  if (back) await page.getByRole("button", { name: "Erinnerung schließen" }).click();
}

const parseMmSs = (s) => {
  const m = /(\d+):(\d{2})/.exec(s ?? "");
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN;
};

async function step10() {
  if (run.shortened) note(`Verkürzte Aufnahme: ${RECORD_SECONDS} s statt 180 s — keine gültige Probe.`);
  await openSlide(SLIDES[0].id);
  await page.getByTestId("recorder-menu-button").click();
  await page.getByTestId("recorder-menu-consent-start").click();
  const time = page.getByTestId("recorder-menu-time");
  await time.waitFor({ timeout: 15_000 });
  const started = Date.now();
  check("Aufnahme startet aus dem Rekorder-Menü der Kopfzeile", await time.isVisible(), norm(await time.textContent()), await screenshot("aufnahme-laeuft"));
  await parkMouse();
  await page.keyboard.press("Escape");
  await page.getByTestId("recorder-menu-panel").waitFor({ state: "detached", timeout: 5_000 });

  let switches = 0;
  let stillRunning = 0;
  const visited = [SLIDES[0].id];
  const interval = (RECORD_SECONDS * 1000) / (SLIDE_SWITCHES + 1);
  for (let i = 1; i <= SLIDE_SWITCHES; i++) {
    const due = started + i * interval;
    await sleep(Math.max(0, due - Date.now()));
    const target = SLIDES[i]?.id;
    where = `Aufnahme, Folie ${target}`;
    await page.keyboard.press("ArrowRight");
    try {
      await waitSlide(target, 8_000);
      switches++;
      visited.push(target);
    } catch {
      /* counted below */
    }
    if (await time.isVisible()) stillRunning++;
  }
  where = "Sitzungsaufnahme";
  await sleep(Math.max(0, started + RECORD_SECONDS * 1000 + 1_000 - Date.now()));
  const elapsed = (Date.now() - started) / 1000;
  const shownSeconds = parseMmSs(await time.textContent());
  check(
    `Aufnahme läuft ${RECORD_SECONDS} s über mindestens 10 Folienwechsel weiter`,
    switches >= 10 && stillRunning === SLIDE_SWITCHES && shownSeconds >= RECORD_SECONDS - 2,
    `${switches} Wechsel (${visited.join(" → ")}), Anzeige ${norm(await time.textContent())} nach ${Math.round(elapsed)} s`,
  );

  await page.getByTestId("recorder-menu-button").click();
  await page.getByTestId("recorder-menu-stop").click();
  const dlLink = page.getByTestId("recorder-menu-download");
  await dlLink.waitFor({ timeout: 60_000 });
  const shotStopped = await screenshot("aufnahme-gestoppt");
  const file = await download(() => dlLink.click(), "Aufnahme");
  const b64 = fs.readFileSync(file.file).toString("base64");
  const decoded = await page.evaluate(async (data) => {
    try {
      const bin = atob(data);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const ctx = new OfflineAudioContext(1, 1, 48_000);
      const buf = await ctx.decodeAudioData(bytes.buffer);
      return { duration: buf.duration };
    } catch (err) {
      return { error: String(err) };
    }
  }, b64);
  check(
    "Aufnahme herunterladbar, Datei > 0 Byte, Länge plausibel",
    file.size > 0 && decoded.duration !== undefined && Math.abs(decoded.duration - elapsed) <= Math.max(8, elapsed * 0.05),
    `${file.name}, ${Math.round(file.size / 1024)} KB, dekodierte Länge ${decoded.duration ? `${decoded.duration.toFixed(1)} s` : decoded.error}, gemessene Laufzeit ${elapsed.toFixed(1)} s`,
    shotStopped,
  );
  await parkMouse();
  await page.keyboard.press("Escape");
}

async function step11() {
  // (a) Backup folder, redirected to the Origin Private File System by the init script.
  await gotoRoute("einstellungen");
  await page.getByTestId("auto-backup-section").waitFor();
  await page.getByTestId("auto-backup-choose-folder").click();
  const status = page.getByTestId("auto-backup-status");
  await page
    .waitForFunction(() => document.querySelector("[data-testid=auto-backup-status]")?.textContent.includes("Zuletzt: fbs-workshop-"), null, { timeout: 20_000 })
    .catch(() => {});
  const statusText = norm(await status.textContent());
  const files = await readFolder();
  const snaps = (await readSnapshots()).list;
  const live = await readState();
  const firstFile = files[0] ? inspectBackup(files[0].text) : { ok: false, why: "keine Datei" };
  check(
    "Sicherungsordner: Datei wird geschrieben und ist gültig",
    files.length >= 1 && firstFile.ok && statusText.includes(`verbunden: „${FOLDER_NAME}“`),
    files.length
      ? `${files.map((f) => `${f.name} (${Math.round(f.size / 1024)} KB)`).join(", ")} · ${firstFile.ok ? countLine(firstFile.counts) : firstFile.why} · Status: ${statusText.slice(0, 160)}`
      : `kein Datei im Ordner · Status: ${statusText.slice(0, 160)}`,
    await screenshot("sicherungsordner", { locator: page.getByTestId("auto-backup-section") }),
  );
  if (firstFile.ok) {
    const isCurrent = firstFile.file.stores?.workshop?.entries?.[shared.noteId]?.value === shared.noteText;
    if (!isCurrent) {
      finding(
        "Beim Verbinden des Sicherungsordners landet der letzte Zwischenstand, nicht der aktuelle Stand",
        `Meldung „Der aktuelle Stand wird dort abgelegt“, die Datei ${files[0].name} enthält aber den Zwischenstand von ${snaps[0]?.createdAt ?? "?"} ohne die Notiz aus Schritt 4. Ursache: syncFolder() in src/lib/auto-backup.ts schreibt den neuesten Zwischenstand; Änderungen seit dem letzten Zwischenstand (bis zu 15 Minuten) fehlen in der ersten Datei.`,
      );
    }
    note(
      isCurrent
        ? "Die erste Datei im Ordner enthält den aktuellen Stand (mit der Notiz aus Schritt 4)."
        : `Die erste Datei im Ordner enthält den neuesten Zwischenstand (${snaps[0]?.createdAt ?? "?"}, ${countLine(firstFile.counts)}), nicht den aktuellen Stand (${countLine(stateCounts(live))}, mit der Notiz aus Schritt 4).`,
    );
  }

  // (b) Fast-forward: the snapshot engine polls the clock, so fake timers must exist before it starts.
  await page.clock.install();
  await page.reload();
  await waitReady();
  await page.getByTestId("auto-backup-section").waitFor();
  await page.clock.runFor(61_000);
  const afterStart = await settleSnapshots();
  note(`Nach dem Neuladen und 61 s: ${afterStart.length} Zwischenstände, neuester „${afterStart[0]?.reason}“ (${afterStart[0]?.createdAt}).`);

  await openSlide("03.04");
  await setPanel(true);
  const noteBox = page.locator("aside[data-live-protocol] textarea").first();
  await noteBox.click();
  await page.keyboard.press("End");
  shared.noteText = `${shared.noteText} Ergänzt vor dem 15-Minuten-Takt.`;
  await page.keyboard.type(" Ergänzt vor dem 15-Minuten-Takt.", { delay: 5 });
  await page.locator("main [data-slide-stage] h1").first().click();
  const baseline = await settleSnapshots(6_000);

  await page.clock.runFor(5 * 60_000);
  const at5 = await settleSnapshots(6_000);
  check(
    "Keine Sicherung bei jeder Änderung: nach 5 Minuten noch kein neuer Zwischenstand",
    at5.length === baseline.length && at5[0]?.id === baseline[0]?.id,
    `${baseline.length} → ${at5.length}`,
  );
  await page.clock.runFor(10 * 60_000 + 2_000);
  const at15 = await settleSnapshots();
  const fresh = at15.find((m) => !baseline.some((b) => b.id === m.id));
  const payload = fresh ? (await readSnapshots(fresh.id)).payload : null;
  const content = payload ? inspectBackup(payload) : null;
  await gotoRoute("einstellungen");
  await page.getByTestId("auto-backup-list").waitFor({ timeout: 10_000 });
  check(
    "15 Minuten vorgespult: neuer automatischer Zwischenstand mit der Änderung",
    Boolean(fresh) && fresh.reason === "auto" && content?.ok && content.file.stores.workshop.entries[shared.noteId]?.value === shared.noteText,
    fresh ? `„${fresh.reason}“ ${fresh.createdAt}, ${countLine(fresh.summary)}` : `keine neue Sicherung (${baseline.length} → ${at15.length})`,
    await screenshot("zwischenstaende", { locator: page.getByTestId("auto-backup-section") }),
  );
  const folderAfter = await readFolder();
  const newestFile = folderAfter[folderAfter.length - 1];
  const newestContent = newestFile ? inspectBackup(newestFile.text) : null;
  check(
    "Der neue Zwischenstand liegt auch als Datei im Sicherungsordner",
    folderAfter.length > files.length && newestContent?.ok && newestContent.file.stores.workshop.entries[shared.noteId]?.value === shared.noteText,
    `${files.length} → ${folderAfter.length} Dateien, neueste ${newestFile?.name ?? "—"}`,
  );

  // (c) End-of-day reminder on the last slide of day 1.
  await page.evaluate((k) => localStorage.removeItem(k), REMINDER_KEY);
  await openSlide("03.05");
  await page.keyboard.press("ArrowRight");
  await waitSlide("03.06");
  const reminder = page.getByTestId("auto-backup-reminder");
  await reminder.waitFor({ timeout: 5_000 }).catch(() => {});
  const shot = await screenshot("tagesend-erinnerung");
  const visible = await reminder.isVisible();
  check("Tagesend-Erinnerung erscheint auf 03.06", visible, visible ? norm(await reminder.textContent()).slice(0, 140) : "", shot);
  if (visible) {
    const file = await download(() => page.getByTestId("auto-backup-reminder-download").click(), "Tagesend-Sicherung");
    const info = inspectBackup(fs.readFileSync(file.file, "utf8"));
    await page.getByTestId("auto-backup-reminder-done").waitFor({ timeout: 10_000 });
    check(
      "Erinnerung lädt eine gültige Sicherung mit dem aktuellen Stand herunter",
      info.ok && sameCounts(info.counts, stateCounts(await readState())),
      `${file.name}, ${Math.round(file.size / 1024)} KB, ${info.ok ? countLine(info.counts) : info.why}`,
      file.rel,
    );
    await page.getByRole("button", { name: "Erinnerung schließen" }).click();
  }
}

async function step12() {
  await gotoRoute("einstellungen");
  await page.getByTestId("auto-backup-section").waitFor();
  const pre = await readState();
  const preCounts = stateCounts(pre);
  const expected = { ...shared.step2Counts, entries: shared.step2Counts.entries + 1 };
  check(
    "Stand vor dem Ernstfall = eingelesene Sicherung plus Eingabe aus Schritt 4",
    sameCounts(preCounts, expected),
    `erwartet ${countLine(expected)} · vorhanden ${countLine(preCounts)}`,
  );

  await page.getByRole("button", { name: "Alles zurücksetzen" }).click();
  await page.getByTestId("reset-confirm").waitFor();
  const backupFile = await download(() => page.getByTestId("reset-confirm-button").click(), "Sicherung vor dem Zurücksetzen");
  await page.getByRole("status").filter({ hasText: "Alle Inhalte wurden zurückgesetzt" }).waitFor({ timeout: 20_000 });
  const info = inspectBackup(fs.readFileSync(backupFile.file, "utf8"));
  check(
    "Zurücksetzen lädt vorher eine vollständige Sicherung herunter",
    info.ok && sameCounts(info.counts, preCounts),
    `${backupFile.name}: ${info.ok ? countLine(info.counts) : info.why}`,
    backupFile.rel,
  );

  const emptied = await readState();
  const shown = norm(await page.locator("p", { hasText: "Aktuell gespeichert:" }).innerText()).replace("Aktuell gespeichert: ", "");
  await gotoRoute("protokoll");
  const emptyNote = page.getByText("Noch keine Eingaben.");
  await emptyNote.waitFor({ timeout: 5_000 }).catch(() => {});
  check(
    "App ist nach dem Zurücksetzen leer",
    sameCounts(stateCounts(emptied), { entries: 0, interviews: 0, posterFields: 0, glossaryTerms: 0 }) &&
      !emptied.report &&
      !emptied.group &&
      shown === countLine({ entries: 0, interviews: 0, posterFields: 0, glossaryTerms: 0 }) &&
      (await emptyNote.isVisible()),
    `Speicher: ${countLine(stateCounts(emptied))} · Anzeige: ${shown}`,
    await screenshot("leer-nach-reset"),
  );

  await gotoRoute("einstellungen");
  const list = await settleSnapshots(6_000);
  const newest = list[0];
  check(
    "Neuester Zwischenstand ist der Sicherheitsstand vor dem Zurücksetzen",
    newest?.reason === "before-reset" && sameCounts(newest.summary, preCounts),
    newest ? `„${newest.reason}“ ${newest.createdAt}, ${countLine(newest.summary)}` : "kein Zwischenstand",
  );
  await page.getByTestId("auto-backup-restore").first().click();
  await page.getByTestId("auto-backup-restore-confirm").click();
  const restoredNotice = page.getByRole("status").filter({ hasText: "wiederhergestellt" });
  await restoredNotice.waitFor({ timeout: 30_000 });

  const back = await readState();
  const backCounts = stateCounts(back);
  const storedLine = norm(await page.locator("p", { hasText: "Aktuell gespeichert:" }).innerText()).replace("Aktuell gespeichert: ", "");
  check(
    "Wiederherstellen bringt alle Zahlen zurück (Schritt 2 plus Eingabe aus Schritt 4)",
    sameCounts(backCounts, expected) && storedLine === countLine(expected),
    `erwartet ${countLine(expected)} · Speicher ${countLine(backCounts)} · Anzeige ${storedLine}`,
    await screenshot("einstellungen-nach-wiederherstellen", { fullPage: true }),
  );
  const diff = Object.keys({ ...pre.entries, ...back.entries }).filter(
    (id) => JSON.stringify(pre.entries[id]?.value) !== JSON.stringify(back.entries[id]?.value),
  );
  check(
    "Beiträge identisch mit dem Stand vor dem Zurücksetzen",
    diff.length === 0 && back.entries[shared.fieldId]?.value === shared.newText && back.entries[shared.noteId]?.value === shared.noteText,
    diff.length ? `abweichend: ${diff.slice(0, 8).join(", ")}` : `${backCounts.entries} Beiträge, Eingabe und Notiz aus Schritt 4 enthalten`,
  );
  check(
    "Interviews, Gruppenbild, Ergebnisbericht und Posterfassungen sind wieder da",
    back.interviews.length === pre.interviews.length &&
      back.group === pre.group &&
      back.report === pre.report &&
      JSON.stringify(back.drafts) === JSON.stringify(pre.drafts),
    `${back.interviews.length} Interviews · Gruppenbild ${back.group ? "ja" : "nein"} · Bericht ${back.report ? "ja" : "nein"} · ${backCounts.posterFields} Posterfelder`,
  );

  await gotoRoute("poster");
  await page.locator("[data-poster-tile]").first().waitFor();
  const tiles = await page.evaluate(() =>
    Object.fromEntries([...document.querySelectorAll("[data-poster-tile]")].map((t) => [t.dataset.posterTile, t.querySelector("[data-fill]")?.dataset.fill])),
  );
  const tileDiff = Object.keys(shared.posterFill ?? {}).filter((k) => tiles[k] !== shared.posterFill[k]);
  check(
    "Poster-Galerie zeigt wieder dieselben Füllstände wie in Schritt 7",
    Object.keys(shared.posterFill ?? {}).length > 0 && tileDiff.length === 0,
    tileDiff.length ? tileDiff.map((k) => `${k}: ${tiles[k]} statt ${shared.posterFill[k]}`).join(", ") : Object.values(tiles).join(", "),
    await screenshot("poster-nach-wiederherstellen"),
  );
  await gotoRoute("protokoll");
  await page.getByText(shared.newText).first().waitFor({ timeout: 10_000 }).catch(() => {});
  check("Protokoll zeigt die wiederhergestellten Beiträge", await page.getByText(shared.newText).first().isVisible(), "", await screenshot("protokoll-nach-wiederherstellen"));
  shared.restored = back;
}

async function step13() {
  const before = await readState();
  await page.reload();
  await waitReady();
  await page.locator("main h1").first().waitFor();
  const after = await readState();
  const same = JSON.stringify(before.raw) === JSON.stringify(after.raw) && JSON.stringify(before.interviews) === JSON.stringify(after.interviews);
  check(
    "Nach dem Neuladen ist der Stand unverändert",
    same,
    same ? `${countLine(stateCounts(after))}, Speicherinhalt byte-gleich` : `vorher ${countLine(stateCounts(before))} · nachher ${countLine(stateCounts(after))}`,
  );
  await openSlide("03.04");
  const inField = await page.evaluate((v) => [...document.querySelectorAll("main textarea")].some((t) => t.value === v), shared.newText);
  check("Eingabe aus Schritt 4 steht nach dem Neuladen im Feld", inField, shared.newText, await screenshot("nach-neuladen"));
}

async function step14() {
  await page.evaluate((k) => localStorage.removeItem(k), REMINDER_KEY);
  const lastDay2 = SLIDES.filter((s) => s.module !== 99).at(-1).id;
  await openSlide(lastDay2);
  await page.getByTestId("auto-backup-reminder").waitFor({ timeout: 5_000 }).catch(() => {});
  const pending = await page.getByTestId("auto-backup-reminder").isVisible();
  note(pending ? `Vorbedingung: Tagesend-Erinnerung auf ${lastDay2} ist offen.` : `Tagesend-Erinnerung auf ${lastDay2} erschien nicht.`);

  await gotoRoute("print");
  await page.locator("article.slide-page").first().waitFor({ timeout: 20_000 });
  await page.waitForFunction((n) => document.querySelectorAll("article.slide-page").length >= n, SLIDES.length, { timeout: 20_000 }).catch(() => {});
  const count = await page.locator("article.slide-page").count();
  check("Druckansicht enthält alle Folien", count === SLIDES.length, `${count} von ${SLIDES.length}`);
  await page.keyboard.press("?");
  await sleep(1_000);
  const dialogs = await page.locator("[role=dialog]").count();
  const notices = await noticesVisible();
  check(
    "Druckansicht ohne Hilfe und ohne Hinweise",
    dialogs === 0 && notices === "" && (await page.locator("[data-pwa-prompt]").count()) === 0,
    `Dialoge ${dialogs} (nach Taste ?), Sicherungshinweise ${notices ? `„${notices}“` : "keine"}`,
    await screenshot("druckansicht"),
  );
}

/* --------------------------------------------------------------------- main */

async function main() {
  fs.rmSync(ARTIFACTS, { recursive: true, force: true });
  fs.mkdirSync(DOWNLOADS, { recursive: true });
  fs.mkdirSync(path.join(ROOT, "exports"), { recursive: true });

  log(`Generalprobe · Fixture ${path.relative(ROOT, FIXTURE_PATH)} · ${FX_COUNTS.entries} Beiträge, ${FX_COUNTS.interviews} Interviews`);
  if (run.shortened) log(`ACHTUNG: Aufnahme auf ${RECORD_SECONDS} s verkürzt — das ist keine gültige Generalprobe.`);

  let preview = null;
  let browser = null;
  let buildInfo = "übersprungen (--ohne-build)";
  const cleanup = async () => {
    await browser?.close().catch(() => {});
    if (preview && preview.exitCode === null) preview.kill();
  };
  const onSignal = () => {
    void cleanup().finally(() => process.exit(130));
  };
  process.once("SIGINT", onSignal);
  process.once("SIGTERM", onSignal);

  try {
    if (!SKIP_BUILD) {
      log("Production-Build: npm run build …");
      const t = Date.now();
      const res = await runCommand("npm run build", path.join(ARTIFACTS, "build.log"));
      if (res.code !== 0) throw new Error(`npm run build ist fehlgeschlagen (Exit ${res.code}). Ende des Logs:\n${res.tail}`);
      buildInfo = `npm run build in ${Math.round((Date.now() - t) / 1000)} s (${REL_ARTIFACTS}/build.log)`;
      log(`Build fertig (${Math.round((Date.now() - t) / 1000)} s)`);
    } else if (!fs.existsSync(path.join(ROOT, "dist", "index.html"))) {
      throw new Error("--ohne-build, aber dist/index.html fehlt.");
    }

    log(`vite preview auf Port ${PORT} …`);
    preview = await startPreview();

    browser = await chromium.launch({
      headless: !HEADED,
      args: ["--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"],
    });
    context = await browser.newContext({
      viewport: { width: 1440, height: 900 },
      locale: "de-DE",
      timezoneId: "Europe/Berlin",
      permissions: ["microphone"],
      acceptDownloads: true,
    });
    await context.addInitScript(
      ({ key, hash, folder }) => {
        localStorage.setItem(key, hash);
        // The folder picker cannot be operated headless: hand out a folder of the Origin Private File System.
        window.showDirectoryPicker = async () => {
          const root = await navigator.storage.getDirectory();
          return root.getDirectoryHandle(folder, { create: true });
        };
      },
      { key: AUTH_KEY, hash: AUTH_HASH, folder: FOLDER_NAME },
    );
    page = await context.newPage();
    page.setDefaultTimeout(20_000);
    page.on("pageerror", (err) => recordError("Seitenfehler", err.message));
    page.on("console", (msg) => {
      if (msg.type() === "error") recordError("Konsole", msg.text(), msg.location()?.url ?? "");
    });
    page.on("response", (res) => {
      if (res.status() >= 400) recordError(`HTTP ${res.status()}`, res.url(), res.url());
    });
    page.on("requestfailed", (req) => {
      if (req.url().startsWith("blob:") || req.url().startsWith("data:")) return;
      recordError("Netzwerk", `${req.url()} ${req.failure()?.errorText ?? ""}`, req.url());
    });
    page.on("dialog", async (d) => {
      recordError("Dialog", `${d.type()}: ${d.message()}`);
      await d.dismiss().catch(() => {});
    });

    run.browser = `Chromium ${browser.version()}${HEADED ? " (sichtbar)" : " (headless)"}`;
    run.build = buildInfo;

    await step("Leerer Start: Landing, erste Folie, Technik-Check, Hilfe", step1);
    await step("Sicherung einlesen über die Einstellungen", step2);
    await step("Jede Folie des Manifests aufrufen", step3);
    await step("Live-Erfassung: Eingabe erscheint im Protokoll an der Folienposition", step4);
    await step("Rückblick 04.00", step5);
    await step("Exporte aus dem Protokoll: Word, PDF, Markdown, JSON", step6);
    await step("Poster: Galerie, alle Poster, Formatwechsel", step7);
    await step("Interviews und Gruppenbild", step8);
    await step("Präsentationsmodus", step9);
    await step(`Sitzungsaufnahme (${RECORD_SECONDS} s echte Zeit)`, step10);
    await step("Automatische Sicherung: Ordner, 15 Minuten, Tagesend-Erinnerung", step11);
    await step("Ernstfall: zurücksetzen und wiederherstellen", step12);
    await step("Neu laden", step13);
    await step("Druckansicht", step14);
  } catch (err) {
    run.fatal = err instanceof Error ? err.message : String(err);
    log(`ABBRUCH: ${run.fatal}`);
  } finally {
    await cleanup();
    process.off("SIGINT", onSignal);
    process.off("SIGTERM", onSignal);
  }

  const reportFile = writeReport();
  const checks = run.steps.flatMap((s) => s.checks);
  const failed = checks.filter((c) => !c.ok).length;
  const ok = !run.fatal && failed === 0 && run.steps.length === TOTAL_STEPS;
  console.log("");
  log(
    ok
      ? `✓ Generalprobe bestanden: ${checks.length} Prüfungen in ${TOTAL_STEPS} Schritten${run.shortened ? " (Aufnahme verkürzt, keine gültige Probe)" : ""}`
      : `✗ Generalprobe NICHT bestanden: ${run.fatal ? `Abbruch (${run.fatal.split("\n")[0]})` : `${failed} von ${checks.length} Prüfungen fehlgeschlagen`}`,
  );
  log(`Bericht: ${path.relative(ROOT, reportFile)}`);
  process.exitCode = ok ? 0 : 1;
}

function writeReport() {
  const now = new Date();
  const date = `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`;
  const file = path.join(ROOT, "exports", `generalprobe-${date}.md`);
  const checks = run.steps.flatMap((s) => s.checks);
  const failed = checks.filter((c) => !c.ok);
  const secs = Math.round((Date.now() - T0) / 1000);
  const link = (p) => (p ? ` · [Screenshot/Datei](../${p})` : "");
  const lines = [];
  lines.push(`# Generalprobe ${date} ${pad2(now.getHours())}:${pad2(now.getMinutes())}`, "");
  lines.push(
    run.fatal
      ? `**Ergebnis: ✗ Abbruch** — ${run.fatal.split("\n")[0]}`
      : failed.length
        ? `**Ergebnis: ✗ ${failed.length} von ${checks.length} Prüfungen fehlgeschlagen**`
        : `**Ergebnis: ✓ alle ${checks.length} Prüfungen bestanden**`,
    "",
  );
  if (run.shortened) lines.push(`> Achtung: Sitzungsaufnahme auf ${RECORD_SECONDS} s verkürzt — dieser Lauf ist keine gültige Generalprobe.`, "");
  lines.push(
    `- **Laufzeit:** ${Math.floor(secs / 60)} min ${secs % 60} s`,
    `- **App:** Production-Build unter ${APP} (vite preview) · Build: ${run.build ?? "—"}`,
    `- **Browser:** ${run.browser ?? "—"}, 1440 × 900, Fake-Mikrofon`,
    `- **Fixture:** \`${path.relative(ROOT, FIXTURE_PATH).replace(/\\/g, "/")}\` (${countLine(FX_COUNTS)})`,
    `- **Artefakte:** \`${REL_ARTIFACTS}/\``,
    "",
  );
  lines.push("## Übersicht", "", "| Schritt | Ergebnis | Prüfungen | Dauer |", "|---|---|---|---|");
  for (const s of run.steps) {
    const bad = s.checks.filter((c) => !c.ok).length;
    lines.push(`| ${s.n}. ${s.title} | ${bad ? "✗" : "✓"} | ${s.checks.length - bad}/${s.checks.length} | ${Math.round(s.duration / 1000)} s |`);
  }
  lines.push("");
  for (const s of run.steps) {
    lines.push(`## ${s.n}. ${s.title}`, "");
    for (const c of s.checks) lines.push(`- ${c.ok ? "✓" : "✗"} **${c.name}**${c.detail ? ` — ${c.detail.replace(/\n/g, " ")}` : ""}${link(c.shot)}`);
    for (const n of s.notes) lines.push(`- ℹ ${n}`);
    lines.push("");
  }
  lines.push("## Erwartete Netzwerkfehler (ausgenommen)", "");
  if (run.network.size) for (const [why, n] of run.network) lines.push(`- ${why}: ${n}×`);
  else lines.push("- keine");
  lines.push("", "Ausgenommen sind nur Aufrufe an api.anthropic.com, api.openai.com und google.com/generate_204 — ohne API-Schlüssel bzw. aus dem Testnetz sind sie nicht erfolgreich. Jeder andere Konsolen-, Seiten- oder HTTP-Fehler zählt als ✗.", "");
  lines.push("## App-Befunde", "");
  if (APP_FINDINGS.length) for (const f of APP_FINDINGS) lines.push(`- **${f.title}** (gefunden in Schritt ${f.step}) — ${f.detail}`);
  else lines.push("- keine");
  lines.push("", "Befunde sind gemeldet, nicht behoben; sie brechen keine Prüfung, solange der Workshop-Ablauf nicht betroffen ist.");
  lines.push("", "## Grenzen der Automatik (nur vor Ort prüfbar)", "");
  for (const l of [
    "Echte Sprache: Das Fake-Mikrofon liefert einen Testton; Diktat und Diktat-Probe brauchen den Google-Sprachdienst und eine echte Stimme im Raum.",
    "Tonqualität der Sitzungsaufnahme (anhören: Anfang, Mitte, Ende) und die 60-Minuten-Probe inklusive Neuladen während der Aufnahme mit „Aufnahme wiederherstellen“.",
    "Der echte Druckdialog und die Druckerei-Ausgabe (A0): Das PDF entsteht hier mit der Chromium-PDF-Engine aus demselben Druckdokument, das die App an den Dialog übergibt.",
    "Der echte Ordner-Dialog von Windows und die erneute Freigabe nach einem Browser-Neustart (hier auf das Origin Private File System umgeleitet).",
    "KI-Funktionen mit echten Schlüsseln: Glätten, Ergebnisbericht, Poster verdichten, Rückblick in fünf Sätzen, Transkription.",
    "Beamer, Auflösung, Lesbarkeit aus der letzten Reihe, Tagungs-WLAN/Hotspot und Offline-Betrieb nach einem Neustart.",
    "„Speicher schützen“ (hängt vom Browser und der Installation ab) und der tatsächlich freie Speicher auf dem Laptop.",
    "Zweiter Rechner: Interviews exportieren/importieren zwischen Laptop A und B.",
    "Darstellung der Word-Datei in Word selbst (hier werden Aufbau und Inhalt geprüft).",
  ])
    lines.push(`- ${l}`);
  lines.push("");
  fs.writeFileSync(file, lines.join("\n"), "utf8");
  return file;
}

await main();
