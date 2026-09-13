/**
 * Date stamp for file names, in local time. `toISOString()` is UTC, so a file
 * saved in Germany shortly after midnight would carry the previous day.
 */
export function localDateStamp(d: Date = new Date()): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
