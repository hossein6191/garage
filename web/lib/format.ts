// Words and numbers as the pages print them. Pure, so node runs it in tests/unit.

export const GEN = 10n ** 18n;
export const MILLI = GEN / 1000n;

/** A decimal atto string (or bigint) as a bigint; anything unreadable is 0. */
export function big(v: string | bigint | number | undefined | null): bigint {
  if (typeof v === "bigint") return v;
  if (typeof v === "number") return Number.isFinite(v) ? BigInt(Math.trunc(v)) : 0n;
  const s = String(v ?? "").trim();
  return /^-?\d+$/.test(s) ? BigInt(s) : 0n;
}

/** "0.215 GEN": up to four decimals, trailing zeros dropped; "0 GEN" for nothing. */
export function gen(atto: string | bigint | number | undefined | null, unit = true): string {
  const v0 = big(atto);
  const neg = v0 < 0n;
  const v = neg ? -v0 : v0;
  const whole = v / GEN;
  const frac = (v % GEN).toString().padStart(18, "0").slice(0, 4).replace(/0+$/, "");
  const text = `${neg ? "-" : ""}${whole}${frac ? "." + frac : ""}`;
  return unit ? text + " GEN" : text;
}

/** "0.22" GEN as atto; null when it is not a plain decimal with at most 18 places. */
export function parseGen(text: string): bigint | null {
  const m = /^\s*(\d{0,9})(?:\.(\d{0,18}))?\s*$/.exec(text);
  if (!m || (!m[1] && !m[2])) return null;
  return BigInt(m[1] || "0") * GEN + BigInt((m[2] || "").padEnd(18, "0") || "0");
}

/** "3 h 20 min", "2 d 4 h", "45 s". */
export function span(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  if (s < 60) return `${s} s`;
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return h ? `${d} d ${h} h` : `${d} d`;
  if (h > 0) return m ? `${h} h ${m} min` : `${h} h`;
  return `${m} min`;
}

/** "19 Nov, 14:05" in the reader's own time zone; "" for no time. */
export function when(seconds: number): string {
  if (!seconds || seconds <= 0) return "";
  const d = new Date(seconds * 1000);
  return d.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

/** A contract reason as a sentence: a capital first letter and a full stop. */
export function sentence(text: string): string {
  const t = String(text ?? "").trim().replace(/\s+/g, " ");
  if (!t) return "";
  const first = t.charAt(0).toUpperCase() + t.slice(1);
  return /[.!?]$/.test(first) ? first : first + ".";
}

export const short = (a: string) => (a && a.length > 12 ? a.slice(0, 6) + "…" + a.slice(-4) : a);

/** "Q12" → 12; anything else 0. */
export const idNumber = (id: string): number => (/^Q[1-9]\d{0,8}$/.test(id) ? Number(id.slice(1)) : 0);

/** A quote id as typed ("q12", " Q12 ", "12"), or "". */
export function parseQuoteId(raw: string): string {
  const t = String(raw ?? "").trim().toUpperCase();
  const m = /^Q?([1-9]\d{0,8})$/.exec(t);
  return m ? "Q" + m[1] : "";
}
