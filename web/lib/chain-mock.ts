// Mock mode (NEXT_PUBLIC_MOCK=1): an in-memory copy of contracts/garage.py, for local checks and for
// showing the pages with no wallet and no network. It answers in the contract's own JSON, so the
// mappers of lib/parse.ts run in both modes, and it moves money with the contract's integer rules.
//
// No model is asked here. A line is judged by its words: covered when it shares two words (by their
// first five letters) with the approved line, unclear when it names nothing but a vague word such as
// "sundries", not covered otherwise. On chain every validator asks its own model, twice. A reload
// starts again.

import { notify } from "./browser-store.ts";
import { DEMO_BOND, DEMO_EXTRA, DEMO_NAME, demoTurn, invoiceJson, quoteArgs, rebillJson, openDemoQuote } from "./demo-script.ts";
import { mapPage, mapQuote } from "./parse.ts";
import type { Arg, Call, DemoAnswer, DemoMove, DemoStatus, TxStatus } from "./types.ts";

const GEN = 10n ** 18n;
const PENALTY = 20n;
const MIN_STANDING = GEN / 10n;
const ACCEPT_SECONDS = 7 * 86400;
const REBILL_SECONDS = 86400;

export const MOCK_CONTRACT = "0x00000000000000000000000000000000000ca7a6";
export const MOCK_BOT = "0x000000000000000000000000000000000000de70";

export const PERSONAS = [
  { address: "0x00000000000000000000000000000000000c0571", name: "You", note: "the customer" },
  { address: "0x00000000000000000000000000000000000c0572", name: "Second customer", note: "another visitor" },
];

type Line = { kind: "quote" | "extra"; text: string; price: bigint; status: "pending" | "approved"; paid: bigint; asked_at: number; approved_at: number };
type Billed = { bills: number; text: string; price: bigint; wording: string; verdict: string; paid: bigint; penalty: bigint; rebill_text: string; rebill_price: bigint; rebill_verdict: string; rebill_paid: bigint; rebill_penalty: bigint };
type Q = {
  garage: string; customer: string; title: string; car: string; status: string; total: bigint; escrow: bigint; held: bigint; paid: bigint; penalties: bigint; refunded: bigint; lock: bigint;
  job_seconds: number; created_at: number; accept_by: number; accepted_at: number; invoice_by: number; invoiced_at: number; rebill_by: number; mask: string; rebilled: string; rebill_mask: string; closed_at: number;
  lines: Line[]; billed: Billed[];
};

const state = {
  persona: PERSONAS[0].address,
  offset: 0,
  balances: new Map<string, bigint>(PERSONAS.map((p) => [p.address, 10n * GEN])),
  shops: new Map<string, { name: string; registered_at: number; quotes: number; paid: bigint; penalties: bigint }>(),
  bonds: new Map<string, bigint>(),
  quotes: new Map<string, Q>(),
  party: new Map<string, string[]>(),
  counts: { invoiced: 0, rebills: 0, settled: 0, reclaimed: 0, refunds: 0, covered: 0, not_covered: 0, unclear: 0 },
  txs: new Map<string, { at: number; result: Record<string, unknown> | null; error: string; judged: boolean }>(),
};

export const mockNow = (): number => Math.floor(Date.now() / 1000) + state.offset;
export const mockClockOffset = (): number => state.offset;
export const mockAddress = (): string => state.persona;
export function setMockPersona(a: string): void {
  state.persona = a.toLowerCase();
  notify();
}
export function advanceClock(seconds: number): void {
  state.offset += seconds;
  notify();
}
export const mockBalanceText = (a: string): string => (state.balances.get(a.toLowerCase()) ?? 0n).toString();

class Expected extends Error {}
const fail = (m: string): never => {
  throw new Expected(m);
};
const bal = (a: string) => state.balances.get(a) ?? 0n;
const move = (from: string | null, to: string | null, v: bigint) => {
  if (from) state.balances.set(from, bal(from) - v);
  if (to) state.balances.set(to, bal(to) + v);
};
const bond = (a: string) => state.bonds.get(a) ?? 0n;
const index = (who: string, qid: string) => state.party.set(who, [...(state.party.get(who) ?? []), qid]);
const wording = (t: string) => t.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

// The demo garage is registered, with its standing bond, from the first load.
state.shops.set(MOCK_BOT, { name: DEMO_NAME, registered_at: mockNow(), quotes: 0, paid: 0n, penalties: 0n });
state.bonds.set(MOCK_BOT, DEMO_BOND);
state.balances.set(MOCK_BOT, 5n * GEN);

const VAGUE = new Set(["sundries", "sundry", "misc", "miscellaneous", "consumables", "shop", "supplies", "extras", "various", "items", "charge", "charges", "fee"]);
const STOP = new Set(["and", "the", "a", "of", "for", "with", "new", "fit", "fitted", "fitting", "supply", "replaced", "replace", "pair", "hours", "hour", "used", "x"]);
const stems = (t: string) => new Set(wording(t).split(" ").filter((w) => w.length > 1 && !STOP.has(w) && !/^\d/.test(w)).map((w) => w.slice(0, 5)));

/** The mock's judge: one letter per pair, as the stored mask writes it. */
export function mockJudge(approved: string, billed: string): "C" | "N" | "U" {
  const words = wording(billed).split(" ").filter(Boolean);
  if (words.length <= 2 && words.every((w) => VAGUE.has(w) || STOP.has(w))) return "U";
  const a = stems(approved);
  let shared = 0;
  for (const s of stems(billed)) if (a.has(s)) shared++;
  return shared >= 2 ? "C" : "N";
}

const price = (raw: unknown, what: string): bigint => {
  const s = String(raw ?? "");
  if (!/^\d+$/.test(s)) fail(`${what} costs 1000000000000000 to 50000000000000000000 atto, written in digits`);
  const p = BigInt(s);
  if (p < GEN / 1000n || p > 50n * GEN) fail(`${what} costs 1000000000000000 to 50000000000000000000 atto, written in digits`);
  return p;
};
const text = (raw: unknown, what: string): string => {
  const t = String(raw ?? "").trim();
  if (t.length < 3 || t.length > 120 || !/^[\x20-\x7e]+$/.test(t)) fail(`${what} is 3 to 120 printable characters on one line`);
  return t;
};
const list = (raw: unknown, most: number, what: string): Record<string, unknown>[] => {
  let v: unknown;
  try {
    v = JSON.parse(String(raw));
  } catch {
    fail(`${what} is a JSON list`);
  }
  if (!Array.isArray(v) || v.length < 1 || v.length > most) fail(`${what} is a JSON list of 1 to ${most} lines`);
  return v as Record<string, unknown>[];
};
const find = (raw: unknown): [string, Q] => {
  const id = String(raw ?? "").trim().toUpperCase();
  const q = state.quotes.get(id);
  if (!q) fail(`no quote ${id.slice(0, 12)}`);
  return [id, q!];
};

function applyLine(q: Q, bills: number, p: bigint, letter: string): [bigint, bigint, bigint] {
  const line = q.lines[bills - 1];
  const base = (p * PENALTY) / 100n;
  if (letter === "C") {
    const room = line.price - line.paid > 0n ? line.price - line.paid : 0n;
    const got = p < room ? p : room;
    line.paid += got;
    state.counts.covered++;
    return [got, 0n, 0n];
  }
  if (letter === "N") {
    state.counts.not_covered++;
    return [0n, base, 0n];
  }
  state.counts.unclear++;
  return [0n, 0n, base];
}

function close(q: Q, now: number) {
  state.bonds.set(q.garage, bond(q.garage) + q.lock);
  q.lock = 0n;
  q.status = "settled";
  q.closed_at = now;
  state.counts.settled++;
}

function pay(id: string, q: Q, paid: bigint, penalty: bigint, closing: boolean, mask: string) {
  const refund = closing ? q.held - paid : 0n;
  q.held -= paid + refund;
  q.paid += paid;
  q.penalties += penalty;
  q.refunded += refund;
  const shop = state.shops.get(q.garage)!;
  shop.paid += paid;
  shop.penalties += penalty;
  move(null, q.garage, paid);
  move(null, q.customer, penalty + refund);
  return { ok: true, quote: id, status: q.status, mask, paid: paid.toString(), penalty: penalty.toString(), refunded: refund.toString(), held: q.held.toString(), lock: q.lock.toString() };
}

function refuse(sender: string, value: bigint, reason: string) {
  state.counts.refunds++;
  move(null, sender, value);
  return { ok: false, reason, returned: value.toString() };
}

const WRITES: Record<string, (me: string, args: Arg[], value: bigint, now: number) => Record<string, unknown>> = {
  register(me, [name]) {
    if (state.shops.has(me)) fail("this address is already registered");
    state.shops.set(me, { name: text(name, "the garage's name"), registered_at: mockNow(), quotes: 0, paid: 0n, penalties: 0n });
    return { ok: true, garage: me };
  },
  deposit(me, _a, value) {
    if (!state.shops.has(me)) return refuse(me, value, "only a registered garage keeps a bond here; register() first");
    state.bonds.set(me, bond(me) + value);
    return { ok: true, deposited: value.toString(), bond: bond(me).toString() };
  },
  withdraw(me, [amount]) {
    const a = BigInt(String(amount));
    if (a < 1n || a > bond(me)) fail("withdraw 1 to " + bond(me) + " atto, the free bond this address holds");
    state.bonds.set(me, bond(me) - a);
    move(null, me, a);
    return { ok: true, returned: a.toString(), bond: bond(me).toString() };
  },
  quote(me, [customer, title, car, lines, job], _v, now) {
    if (!state.shops.has(me)) fail("only a registered garage may write a quote; register() first");
    const who = String(customer).toLowerCase();
    if (who === me) fail("a garage may not quote itself");
    if (bond(me) < MIN_STANDING) fail("a garage writes quotes while it holds at least " + MIN_STANDING + " atto of free bond");
    const rows = list(lines, 8, "the quote").map((r, k) => ({ text: text(r.text, `quote line ${k + 1}`), price: price(r.price, `quote line ${k + 1}`) }));
    const id = "Q" + (state.quotes.size + 1);
    const total = rows.reduce((s, r) => s + r.price, 0n);
    state.quotes.set(id, {
      garage: me, customer: who, title: text(title, "the job title"), car: text(car, "the car"), status: "quoted", total, escrow: 0n, held: 0n, paid: 0n, penalties: 0n, refunded: 0n, lock: 0n,
      job_seconds: Number(job), created_at: now, accept_by: now + ACCEPT_SECONDS, accepted_at: 0, invoice_by: 0, invoiced_at: 0, rebill_by: 0, mask: "", rebilled: "", rebill_mask: "", closed_at: 0,
      lines: rows.map((r) => ({ kind: "quote", text: r.text, price: r.price, status: "pending", paid: 0n, asked_at: now, approved_at: 0 })), billed: [],
    });
    state.shops.get(me)!.quotes++;
    index(me, id);
    index(who, id);
    return { ok: true, quote: id, customer: who, total: total.toString(), lines: rows.length };
  },
  accept(me, [qid], value, now) {
    const q = state.quotes.get(String(qid));
    if (!q) return refuse(me, value, "no quote " + String(qid));
    if (me !== q.customer) return refuse(me, value, `only the customer named on ${qid} may accept it`);
    if (q.status !== "quoted") return refuse(me, value, `${qid} is ${q.status}; a quote is accepted once`);
    if (now >= q.accept_by) return refuse(me, value, `${qid} could be accepted until ${q.accept_by}; ask the garage for a new one`);
    if (value !== q.total) return refuse(me, value, `accept ${qid} by sending its total, exactly ${q.total} atto; this sends ${value}`);
    q.status = "accepted";
    q.accepted_at = now;
    q.invoice_by = now + q.job_seconds;
    q.escrow = value;
    q.held = value;
    return { ok: true, quote: qid, status: "accepted", held: value.toString(), invoice_by: q.invoice_by };
  },
  request_extra(me, [qid, t, p], _v, now) {
    const [id, q] = find(qid);
    if (me !== q.garage) fail(`only the garage that wrote ${id} may ask for an extra line on it`);
    if (q.status !== "accepted") fail(`${id} is ${q.status}; extras are asked for while the job is on, before the invoice`);
    if (now >= q.invoice_by) fail(`the invoice deadline of ${id} passed`);
    if (q.lines.filter((l) => l.kind === "extra").length >= 4) fail(`${id} has asked for 4 extras, the most one quote may ask for`);
    q.lines.push({ kind: "extra", text: text(t, "extra line"), price: price(p, "extra line"), status: "pending", paid: 0n, asked_at: now, approved_at: 0 });
    return { ok: true, quote: id, line: q.lines.length, price: String(p), status: "pending" };
  },
  approve_extra(me, [qid, n], value, now) {
    const q = state.quotes.get(String(qid));
    const line = q?.lines[Number(n) - 1];
    if (!q) return refuse(me, value, "no quote " + String(qid));
    if (me !== q.customer) return refuse(me, value, `only the customer named on ${qid} may approve an extra on it`);
    if (q.status !== "accepted") return refuse(me, value, `${qid} is ${q.status}; extras are approved while the job is on`);
    if (now >= q.invoice_by) return refuse(me, value, `the invoice deadline of ${qid} passed`);
    if (!line || line.kind !== "extra") return refuse(me, value, `${qid} has no extra line ${n}`);
    if (line.status !== "pending") return refuse(me, value, `extra line ${n} of ${qid} is already approved`);
    if (value !== line.price) return refuse(me, value, `approve extra line ${n} by sending its price, exactly ${line.price} atto; this sends ${value}`);
    line.status = "approved";
    line.approved_at = now;
    q.escrow += value;
    q.held += value;
    return { ok: true, quote: qid, line: Number(n), status: "approved", held: q.held.toString() };
  },
  invoice(me, [qid, lines], _v, now) {
    const [id, q] = find(qid);
    if (me !== q.garage) fail(`only the garage that wrote ${id} may invoice it`);
    if (q.status === "quoted") fail(`${id} has not been accepted, so nothing is held to invoice against`);
    if (q.status !== "accepted") fail(`${id} is ${q.status}; it was invoiced once and takes no second invoice`);
    if (now >= q.invoice_by) fail(`the invoice deadline of ${id} passed; the customer may reclaim the escrow`);
    const rows = list(lines, 10, "the invoice").map((r, k) => {
      const bills = Number(r.bills);
      const line = q.lines[bills - 1];
      if (!line || !(line.kind === "quote" || line.status === "approved")) fail(`invoice line ${k + 1} bills against approved line ${bills}, which is not an approved line of ${id}`);
      return { bills, text: text(r.text, `invoice line ${k + 1}`), price: price(r.price, `invoice line ${k + 1}`) };
    });
    const lock = rows.reduce((s, r) => s + (r.price * PENALTY) / 100n, 0n);
    if (bond(me) < lock) fail(`this invoice locks ${lock} atto of bond until the verdict; the garage holds ${bond(me)} free`);
    const mask = rows.map((r) => mockJudge(q.lines[r.bills - 1].text, r.text)).join("");
    let paid = 0n, penalty = 0n, kept = 0n;
    q.billed = rows.map((r, k) => {
      const [got, fine, wait] = applyLine(q, r.bills, r.price, mask[k]);
      paid += got;
      penalty += fine;
      kept += wait;
      const verdict = mask[k] === "C" ? "covered" : mask[k] === "N" ? "not_covered" : "unclear";
      return { bills: r.bills, text: r.text, price: r.price, wording: wording(r.text), verdict, paid: got, penalty: fine, rebill_text: "", rebill_price: 0n, rebill_verdict: "", rebill_paid: 0n, rebill_penalty: 0n };
    });
    state.bonds.set(me, bond(me) - penalty - kept);
    q.lock = kept;
    q.mask = mask;
    q.invoiced_at = now;
    q.status = "invoiced";
    q.rebill_by = now + REBILL_SECONDS;
    state.counts.invoiced++;
    const closing = !mask.includes("U");
    if (closing) close(q, now);
    return pay(id, q, paid, penalty, closing, mask);
  },
  rebill(me, [qid, lines], _v, now) {
    const [id, q] = find(qid);
    if (me !== q.garage) fail(`only the garage that wrote ${id} may re-bill it`);
    if (q.status !== "invoiced") fail(`${id} is ${q.status}; only an invoice with an unclear line, not yet settled, is re-billed`);
    if (q.rebilled) fail(`${id} was re-billed once already`);
    if (now >= q.rebill_by) fail(`the re-bill window of ${id} closed; settle() pays it out`);
    const rows = list(lines, 10, "the re-bill").map((r) => {
      const n = Number(r.line);
      const b = q.billed[n - 1];
      if (!b) fail(`${id} has no invoice line ${n}`);
      if (b.verdict !== "unclear") fail(`invoice line ${n} of ${id} is ${b.verdict}; only an unclear line is re-billed`);
      const t = text(r.text, `re-billed line ${n}`);
      const p = price(r.price, `re-billed line ${n}`);
      if (p > b.price) fail(`re-billed line ${n} may not cost more than its first price, ${b.price} atto`);
      if (wording(t) === b.wording) fail(`re-billed line ${n} says the same words as the line that was unclear; a re-bill must say what the work or part was`);
      return { n, t, p, b };
    });
    const mask = rows.map((r) => mockJudge(q.lines[r.b.bills - 1].text, r.t)).join("");
    let paid = 0n, penalty = 0n;
    rows.forEach((r, k) => {
      const [got, fine] = applyLine(q, r.b.bills, r.p, mask[k]);
      paid += got;
      penalty += fine;
      Object.assign(r.b, { rebill_text: r.t, rebill_price: r.p, rebill_verdict: mask[k] === "C" ? "covered" : mask[k] === "N" ? "not_covered" : "unclear", rebill_paid: got, rebill_penalty: fine });
    });
    q.lock -= penalty;
    q.rebilled = rows.map((r) => r.n).join(",");
    q.rebill_mask = mask;
    state.counts.rebills++;
    close(q, now);
    return pay(id, q, paid, penalty, true, mask);
  },
  settle(me, [qid], _v, now) {
    const [id, q] = find(qid);
    const isGarage = me === q.garage;
    if (!isGarage && me !== q.customer) fail(`only the garage or the customer of ${id} may settle it`);
    if (q.status !== "invoiced") fail(`${id} is ${q.status}; settle() pays out an invoice that is waiting on an unclear line`);
    if (!isGarage && now < q.rebill_by) fail(`the garage may re-bill ${id} for another ${q.rebill_by - now} seconds; the customer settles it once that window has closed`);
    close(q, now);
    return pay(id, q, 0n, 0n, true, "");
  },
  reclaim(me, [qid], _v, now) {
    const [id, q] = find(qid);
    if (me !== q.customer) fail(`only the customer of ${id} may reclaim its escrow`);
    if (q.status !== "accepted") fail(`${id} is ${q.status}; the escrow is reclaimed only from an accepted quote never invoiced`);
    if (now < q.invoice_by) fail(`the garage may invoice ${id} for another ${q.invoice_by - now} seconds; the escrow comes back only once that deadline has passed`);
    const amount = q.held;
    q.held = 0n;
    q.refunded += amount;
    q.status = "reclaimed";
    q.closed_at = now;
    state.counts.reclaimed++;
    move(null, q.customer, amount);
    return { ok: true, quote: id, status: "reclaimed", returned: amount.toString() };
  },
};

let txCount = 0;
function run(sender: string, call: Call): string {
  const value = call.value ?? 0n;
  const hash = "0x" + (++txCount).toString(16).padStart(8, "0") + "6d6f636b".repeat(7);
  if (value > bal(sender)) throw new Error("insufficient funds for this payment");
  move(sender, null, value);
  let result: Record<string, unknown> | null = null;
  let error = "";
  try {
    result = WRITES[call.fn](sender, call.args, value, mockNow());
  } catch (e) {
    move(null, sender, value);
    error = e instanceof Expected ? "[EXPECTED] " + e.message : String(e);
  }
  state.txs.set(hash, { at: Date.now(), result, error, judged: call.fn === "invoice" || call.fn === "rebill" });
  notify();
  return hash;
}

export async function write(call: Call): Promise<string> {
  await new Promise((r) => setTimeout(r, 400));
  return run(state.persona, call);
}

const STAGES = ["PENDING", "PROPOSING", "COMMITTING", "REVEALING", "ACCEPTED", "FINALIZED"];

export async function txStatus(hash: string): Promise<TxStatus> {
  const t = state.txs.get(hash);
  if (!t) return { status: "UNKNOWN", votes: { agree: 0, disagree: 0, idle: 0 }, applied: null, undetermined: false, exec: null, result: null, message: "" };
  const step = t.judged ? 1300 : 600;
  const i = Math.min(STAGES.length - 1, Math.floor((Date.now() - t.at) / step));
  const status = STAGES[i];
  const voted = i >= 3;
  const message = t.error || JSON.stringify(t.result);
  return { status, votes: voted ? { agree: 5, disagree: 0, idle: 0 } : { agree: 0, disagree: 0, idle: 0 }, applied: voted ? true : null, undetermined: false, exec: t.error ? "ERROR" : "SUCCESS", result: t.error ? null : t.result, message };
}

export async function balanceOf(a: string): Promise<bigint> {
  return bal(a.toLowerCase());
}

export async function faucet(a: string): Promise<bigint> {
  move(null, a.toLowerCase(), 10n * GEN);
  notify();
  return bal(a.toLowerCase());
}

// ---- views, in the contract's JSON ----

const s = (v: bigint) => v.toString();
function quoteJson(id: string, q: Q, now: number) {
  return {
    quote: id, garage: q.garage, customer: q.customer, title: q.title, car: q.car, status: q.status, total: s(q.total), escrow: s(q.escrow), held: s(q.held), paid: s(q.paid), penalties: s(q.penalties),
    refunded: s(q.refunded), lock: s(q.lock), job_seconds: q.job_seconds, created_at: q.created_at, accept_by: q.accept_by, accepted_at: q.accepted_at, invoice_by: q.invoice_by, invoiced_at: q.invoiced_at,
    rebill_by: q.rebill_by, mask: q.mask, fingerprint: q.mask ? "mock" : "", rebilled: q.rebilled, rebill_mask: q.rebill_mask, rebill_fingerprint: q.rebill_mask ? "mock" : "", closed_at: q.closed_at,
    approved: q.lines.map((l, k) => ({
      line: k + 1, kind: l.kind, text: l.text, price: s(l.price), paid: s(l.paid), asked_at: l.asked_at, approved_at: l.approved_at,
      status: l.kind === "quote" ? (q.status === "quoted" ? "quoted" : "approved") : l.status === "pending" && q.status !== "accepted" ? "lapsed" : l.status,
    })),
    invoice: q.billed.map((b, k) => ({ line: k + 1, bills: b.bills, text: b.text, price: s(b.price), verdict: b.verdict, paid: s(b.paid), penalty: s(b.penalty), why: "", rebill_text: b.rebill_text, rebill_price: s(b.rebill_price), rebill_verdict: b.rebill_verdict, rebill_paid: s(b.rebill_paid), rebill_penalty: s(b.rebill_penalty) })),
    now,
    acceptable: q.status === "quoted" && now < q.accept_by,
    invoiceable: q.status === "accepted" && now < q.invoice_by,
    reclaimable: q.status === "accepted" && now >= q.invoice_by,
    rebillable: q.status === "invoiced" && !q.rebilled && now < q.rebill_by,
    customer_may_settle: q.status === "invoiced" && now >= q.rebill_by,
  };
}
const rowJson = (id: string, q: Q) => ({ quote: id, garage: q.garage, customer: q.customer, title: q.title, car: q.car, status: q.status, total: s(q.total), held: s(q.held), paid: s(q.paid), mask: q.mask, invoice_by: q.invoice_by });

export async function view(fn: string, args: Arg[]): Promise<string> {
  const now = mockNow();
  if (fn === "get_quote") {
    const id = String(args[0]).toUpperCase();
    const q = state.quotes.get(id);
    return JSON.stringify(q ? quoteJson(id, q, now) : { error: "no quote " + id });
  }
  if (fn === "quotes" || fn === "quotes_of") {
    const ids = fn === "quotes" ? [...state.quotes.keys()] : state.party.get(String(args[0]).toLowerCase()) ?? [];
    const [offset, limit] = fn === "quotes" ? [Number(args[0]), Number(args[1])] : [Number(args[1]), Number(args[2])];
    const who = fn === "quotes_of" ? String(args[0]).toLowerCase() : "";
    const rows = ids.slice(offset, offset + Math.min(limit, 20)).map((id) => ({ ...rowJson(id, state.quotes.get(id)!), ...(who ? { role: state.quotes.get(id)!.garage === who ? "garage" : "customer" } : {}) }));
    return JSON.stringify({ who, total: ids.length, offset, limit, rows });
  }
  if (fn === "garage") {
    const who = String(args[0]).toLowerCase();
    const shop = state.shops.get(who);
    if (!shop) return JSON.stringify({ who, registered: false, bond: "0" });
    return JSON.stringify({ who, registered: true, name: shop.name, bond: s(bond(who)), registered_at: shop.registered_at, quotes: shop.quotes, paid: s(shop.paid), penalties: s(shop.penalties), may_quote: bond(who) >= MIN_STANDING });
  }
  if (fn === "stats") {
    const all = [...state.quotes.values()];
    const sum = (f: (q: Q) => bigint) => all.reduce((t, q) => t + f(q), 0n);
    const free = [...state.bonds.values()].reduce((t, v) => t + v, 0n);
    const c = state.counts;
    return JSON.stringify({
      garages: state.shops.size, quotes: all.length, invoiced: c.invoiced, rebills: c.rebills, settled: c.settled, reclaimed: c.reclaimed, refusals_refunded: c.refunds, covered: c.covered, not_covered: c.not_covered, unclear: c.unclear,
      bonds_free: s(free), bonds_locked: s(sum((q) => q.lock)), escrow_held: s(sum((q) => q.held)), paid_to_garages: s(sum((q) => q.paid)), penalties_to_customers: s(sum((q) => q.penalties)),
      refunded_to_customers: s(sum((q) => q.refunded)), balance_owed: s(free + sum((q) => q.lock) + sum((q) => q.held)), now,
    });
  }
  throw new Error("no view " + fn);
}

// ---- the demo garage, played in the browser ----

export async function demoStatus(): Promise<DemoStatus> {
  return { online: true, reason: "", bot: MOCK_BOT, name: DEMO_NAME, bondAtto: bond(MOCK_BOT).toString(), neededAtto: "0" };
}

export async function demoMove(move: DemoMove, target: string): Promise<DemoAnswer> {
  await new Promise((r) => setTimeout(r, 500));
  if (move === "quote") {
    const mine = mapPage(await view("quotes_of", [target, 0, 20])).rows;
    const open = openDemoQuote(mine, MOCK_BOT);
    if (open) return { ok: false, reason: `you already have a demo job in progress, ${open.id}; finish it first` };
    const hash = run(MOCK_BOT, { fn: "quote", args: quoteArgs(target) });
    return { ok: true, hash, quote: "Q" + state.quotes.size };
  }
  const q = mapQuote(await view("get_quote", [target]));
  const turn = demoTurn(q, MOCK_BOT, mockNow());
  if (!q || !turn.moves.includes(move)) return { ok: false, reason: turn.why || `it is not the garage's turn to ${move} on ${target}` };
  if (move === "extra") return { ok: true, hash: run(MOCK_BOT, { fn: "request_extra", args: [q.id, DEMO_EXTRA.text, DEMO_EXTRA.price.toString()] }) };
  if (move === "invoice") return { ok: true, hash: run(MOCK_BOT, { fn: "invoice", args: [q.id, invoiceJson(q)] }) };
  if (move === "rebill") return { ok: true, hash: run(MOCK_BOT, { fn: "rebill", args: [q.id, rebillJson(q)] }) };
  return { ok: true, hash: run(MOCK_BOT, { fn: "settle", args: [q.id] }) };
}
