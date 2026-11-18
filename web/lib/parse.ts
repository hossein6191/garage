// Reading the contract's JSON: one mapper per view of contracts/garage.py (get_quote, quotes,
// quotes_of, garage, stats) and one per write's return. Every missing or malformed field gets a
// default, so a row from an older register never breaks a page. Pure, so tests/unit/parse.test.mjs
// runs it with no network.

import { QUOTE_STATUSES, type ApprovedLine, type GarageInfo, type InvoiceLine, type Paged, type Quote, type QuoteRow, type QuoteStatus, type Stats, type Verdict } from "./types.ts";

type Row = Record<string, unknown>;

export const num = (v: unknown, dflt = 0): number => {
  if (typeof v === "number") return Number.isFinite(v) ? v : dflt;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string" && /^-?\d+$/.test(v.trim())) return Number(v);
  return dflt;
};
export const str = (v: unknown, dflt = ""): string => (v === undefined || v === null ? dflt : String(v));
export const atto = (v: unknown): string => {
  if (typeof v === "bigint") return v >= 0n ? v.toString() : "0";
  if (typeof v === "number") return Number.isFinite(v) && v >= 0 ? BigInt(Math.trunc(v)).toString() : "0";
  const s = str(v, "0").trim();
  return /^\d+$/.test(s) ? s.replace(/^0+(?=\d)/, "") : "0";
};
const addr = (v: unknown): string => (/^0x[0-9a-fA-F]{40}$/.test(str(v)) ? str(v).toLowerCase() : "");
/** Seconds; the contract writes -1 when a call had no readable clock. */
const secs = (v: unknown): number => Math.max(0, num(v));
export const asRow = (v: unknown): Row => (v && typeof v === "object" && !Array.isArray(v) ? (v as Row) : {});
const rowsOf = (v: unknown): Row[] => (Array.isArray(v) ? v.filter((r): r is Row => !!r && typeof r === "object" && !Array.isArray(r)) : []);
const yes = (v: unknown): boolean => v === true;

/** A view answers a JSON string; anything else is passed on as it is. */
export function parseView(raw: unknown): unknown {
  if (typeof raw === "string") {
    try {
      return JSON.parse(raw);
    } catch {
      return raw;
    }
  }
  return raw;
}

export const quoteStatus = (v: unknown): QuoteStatus => (QUOTE_STATUSES.includes(str(v) as QuoteStatus) ? (str(v) as QuoteStatus) : "quoted");
export const verdictOf = (v: unknown): Verdict => {
  const s = str(v);
  return s === "covered" || s === "not_covered" || s === "unclear" ? s : "";
};
const quoteId = (v: unknown): string => (/^Q[1-9]\d{0,8}$/.test(str(v)) ? str(v) : "");

export function mapApproved(r: Row): ApprovedLine {
  const s = str(r.status);
  return {
    line: num(r.line),
    kind: str(r.kind) === "extra" ? "extra" : "quote",
    text: str(r.text),
    priceAtto: atto(r.price),
    status: s === "approved" || s === "pending" || s === "lapsed" ? s : "quoted",
    paidAtto: atto(r.paid),
    askedAt: secs(r.asked_at),
    approvedAt: secs(r.approved_at),
  };
}

export function mapInvoiceLine(r: Row): InvoiceLine {
  return {
    line: num(r.line),
    bills: num(r.bills),
    text: str(r.text),
    priceAtto: atto(r.price),
    verdict: verdictOf(r.verdict),
    paidAtto: atto(r.paid),
    penaltyAtto: atto(r.penalty),
    why: str(r.why),
    rebillText: str(r.rebill_text),
    rebillPriceAtto: atto(r.rebill_price),
    rebillVerdict: verdictOf(r.rebill_verdict),
    rebillPaidAtto: atto(r.rebill_paid),
    rebillPenaltyAtto: atto(r.rebill_penalty),
  };
}

/** get_quote(id): null when the contract answers {"error": ...} or a row with no parties. */
export function mapQuote(raw: unknown): Quote | null {
  const r = asRow(parseView(raw));
  if ("error" in r || !quoteId(r.quote) || !addr(r.garage)) return null;
  return {
    id: quoteId(r.quote),
    garage: addr(r.garage),
    customer: addr(r.customer),
    title: str(r.title),
    car: str(r.car),
    status: quoteStatus(r.status),
    totalAtto: atto(r.total),
    escrowAtto: atto(r.escrow),
    heldAtto: atto(r.held),
    paidAtto: atto(r.paid),
    penaltiesAtto: atto(r.penalties),
    refundedAtto: atto(r.refunded),
    lockAtto: atto(r.lock),
    jobSeconds: num(r.job_seconds),
    createdAt: secs(r.created_at),
    acceptBy: secs(r.accept_by),
    acceptedAt: secs(r.accepted_at),
    invoiceBy: secs(r.invoice_by),
    invoicedAt: secs(r.invoiced_at),
    rebillBy: secs(r.rebill_by),
    mask: /^[CNU]{0,10}$/.test(str(r.mask)) ? str(r.mask) : "",
    fingerprint: str(r.fingerprint),
    rebilled: str(r.rebilled),
    rebillMask: /^[CNU]{0,10}$/.test(str(r.rebill_mask)) ? str(r.rebill_mask) : "",
    rebillFingerprint: str(r.rebill_fingerprint),
    closedAt: secs(r.closed_at),
    approved: rowsOf(r.approved).map(mapApproved).sort((a, b) => a.line - b.line),
    invoice: rowsOf(r.invoice).map(mapInvoiceLine).sort((a, b) => a.line - b.line),
    now: secs(r.now),
    acceptable: yes(r.acceptable),
    invoiceable: yes(r.invoiceable),
    reclaimable: yes(r.reclaimable),
    rebillable: yes(r.rebillable),
    customerMaySettle: yes(r.customer_may_settle),
  };
}

export function mapQuoteRow(r: Row): QuoteRow {
  const role = str(r.role);
  return {
    id: quoteId(r.quote),
    garage: addr(r.garage),
    customer: addr(r.customer),
    title: str(r.title),
    car: str(r.car),
    status: quoteStatus(r.status),
    totalAtto: atto(r.total),
    heldAtto: atto(r.held),
    paidAtto: atto(r.paid),
    mask: /^[CNU]{0,10}$/.test(str(r.mask)) ? str(r.mask) : "",
    invoiceBy: secs(r.invoice_by),
    role: role === "garage" || role === "customer" ? role : "",
  };
}

/** quotes() and quotes_of(): a page with no rows array is not an answer (a failed read), so it throws. */
export function mapPage(raw: unknown): Paged<QuoteRow> {
  const r = asRow(parseView(raw));
  if (!Array.isArray(r.rows)) throw new Error("could not reach the network");
  return { total: num(r.total), offset: num(r.offset), limit: num(r.limit, 20), rows: rowsOf(r.rows).map(mapQuoteRow).filter((q) => q.id) };
}

export function mapGarage(raw: unknown): GarageInfo {
  const r = asRow(parseView(raw));
  return {
    who: addr(r.who),
    registered: yes(r.registered),
    name: str(r.name),
    bondAtto: atto(r.bond),
    registeredAt: secs(r.registered_at),
    quotes: num(r.quotes),
    paidAtto: atto(r.paid),
    penaltiesAtto: atto(r.penalties),
    mayQuote: yes(r.may_quote),
  };
}

export function mapStats(raw: unknown): Stats {
  const r = asRow(parseView(raw));
  return {
    garages: num(r.garages),
    quotes: num(r.quotes),
    invoiced: num(r.invoiced),
    rebills: num(r.rebills),
    settled: num(r.settled),
    reclaimed: num(r.reclaimed),
    refusalsRefunded: num(r.refusals_refunded),
    covered: num(r.covered),
    notCovered: num(r.not_covered),
    unclear: num(r.unclear),
    bondsFreeAtto: atto(r.bonds_free),
    bondsLockedAtto: atto(r.bonds_locked),
    escrowHeldAtto: atto(r.escrow_held),
    paidToGaragesAtto: atto(r.paid_to_garages),
    penaltiesToCustomersAtto: atto(r.penalties_to_customers),
    refundedToCustomersAtto: atto(r.refunded_to_customers),
    balanceOwedAtto: atto(r.balance_owed),
    now: secs(r.now),
  };
}

/** What an invoice(), rebill(), settle() or reclaim() returned: the mask and where the money went. */
export type Payout = { quote: string; status: QuoteStatus; mask: string; paidAtto: string; penaltyAtto: string; refundedAtto: string; heldAtto: string; lockAtto: string };

export function mapPayout(raw: unknown): Payout | null {
  const r = asRow(raw);
  if (r.ok !== true || !quoteId(r.quote)) return null;
  return {
    quote: quoteId(r.quote),
    status: quoteStatus(r.status),
    mask: /^[CNU]{0,10}$/.test(str(r.mask)) ? str(r.mask) : "",
    paidAtto: atto(r.paid),
    penaltyAtto: atto(r.penalty),
    refundedAtto: atto(r.refunded ?? r.returned),
    heldAtto: atto(r.held),
    lockAtto: atto(r.lock),
  };
}

/** quote()'s return: the new quote's id, or "". */
export const madeQuote = (raw: unknown): string => {
  const r = asRow(raw);
  return r.ok === true ? quoteId(r.quote) : "";
};

/** A refused payable call: why, and what came back in the same transaction. */
export function refundOf(raw: unknown): { reason: string; returnedAtto: string } | null {
  const r = asRow(raw);
  if (r.ok !== false) return null;
  return { reason: str(r.reason), returnedAtto: atto(r.returned) };
}
