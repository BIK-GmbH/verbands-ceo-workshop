/**
 * Minimal ZIP writer — no dependency, no compression.
 *
 * Recordings are already compressed (Opus/AAC) and transcripts are small, so
 * STORE is enough and keeps the file assembly cheap: the entries are composed
 * as a Blob of headers and the original Blobs, nothing is copied into memory.
 * Only the CRC-32 has to read the data, and it does so in slices.
 *
 * Deliberately without ZIP64: a zip up to 4 GB covers a two-day workshop by far;
 * anything larger is refused with a clear error instead of writing a file that
 * some unzip tools cannot open.
 */

export interface ZipEntry {
  /** Path inside the archive, forward slashes */
  name: string;
  data: Blob;
  date?: Date;
}

export class ZipTooLargeError extends Error {
  constructor(detail: string) {
    super(detail);
    this.name = "ZipTooLargeError";
  }
}

const MAX_32 = 0xffffffff;
const SLICE = 4 * 1024 * 1024;

let crcTable: Uint32Array | null = null;

function table(): Uint32Array {
  if (crcTable) return crcTable;
  crcTable = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    crcTable[n] = c >>> 0;
  }
  return crcTable;
}

async function crc32(blob: Blob): Promise<number> {
  const t = table();
  let crc = 0xffffffff;
  for (let offset = 0; offset < blob.size; offset += SLICE) {
    const bytes = new Uint8Array(await blob.slice(offset, offset + SLICE).arrayBuffer());
    for (let i = 0; i < bytes.length; i++) crc = t[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/** MS-DOS date/time as ZIP stores it (local time, 2-second resolution). */
function dosDateTime(d: Date): { time: number; date: number } {
  const year = Math.max(1980, d.getFullYear());
  return {
    time: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    date: ((year - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

/** "a.md", "a (2).md", … — names inside one archive must be unique. */
export function uniqueNames<T extends { name: string }>(entries: T[]): T[] {
  const seen = new Set<string>();
  return entries.map((e) => {
    let name = e.name;
    const dot = name.lastIndexOf(".");
    const stem = dot > 0 ? name.slice(0, dot) : name;
    const ext = dot > 0 ? name.slice(dot) : "";
    for (let n = 2; seen.has(name.toLowerCase()); n++) name = `${stem} (${n})${ext}`;
    seen.add(name.toLowerCase());
    return { ...e, name };
  });
}

/**
 * Builds the archive. `onProgress` reports finished entries (the CRC of a long
 * recording takes a moment). Throws ZipTooLargeError above the 32-bit limits.
 */
export async function createZip(entries: ZipEntry[], onProgress?: (done: number, total: number) => void): Promise<Blob> {
  const list = uniqueNames(entries);
  if (list.length > 0xffff) throw new ZipTooLargeError(`too many entries: ${list.length}`);
  const total = list.reduce((n, e) => n + e.data.size, 0);
  if (total >= MAX_32) throw new ZipTooLargeError(`archive too large: ${total} bytes`);

  const encoder = new TextEncoder();
  const parts: BlobPart[] = [];
  const central: ArrayBuffer[] = [];
  let offset = 0;

  for (const [i, entry] of list.entries()) {
    const name = encoder.encode(entry.name) as Uint8Array<ArrayBuffer>;
    const crc = await crc32(entry.data);
    const size = entry.data.size;
    const { time, date } = dosDateTime(entry.date ?? new Date());

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true); // local file header signature
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // flags: UTF-8 names
    local.setUint16(8, 0, true); // method: store
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, size, true);
    local.setUint32(22, size, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(local.buffer, name, entry.data);

    const cd = new DataView(new ArrayBuffer(46 + name.length));
    cd.setUint32(0, 0x02014b50, true); // central directory signature
    cd.setUint16(4, 20, true); // version made by
    cd.setUint16(6, 20, true); // version needed
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 0, true);
    cd.setUint16(12, time, true);
    cd.setUint16(14, date, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, size, true);
    cd.setUint32(24, size, true);
    cd.setUint16(28, name.length, true);
    cd.setUint32(42, offset, true); // local header offset
    new Uint8Array(cd.buffer).set(name, 46);
    central.push(cd.buffer);

    offset += 30 + name.length + size;
    if (offset >= MAX_32) throw new ZipTooLargeError(`archive too large at entry ${i}`);
    onProgress?.(i + 1, list.length);
  }

  const cdSize = central.reduce((n, c) => n + c.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true); // end of central directory
  end.setUint16(8, list.length, true);
  end.setUint16(10, list.length, true);
  end.setUint32(12, cdSize, true);
  end.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end.buffer], { type: "application/zip" });
}
