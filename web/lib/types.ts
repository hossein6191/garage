// The shapes the pages work with. Amounts are atto, as decimal strings, exactly as the contract writes
// them; lib/parse.ts maps the contract's JSON onto these, giving every missing field a default.

import type { DecodedTx } from "./rpc.ts";

export type Arg = string | number | bigint | boolean;

export type WriteFn = "register" | "deposit" | "withdraw" | "quote" | "accept" | "request_extra" | "approve_extra" | "invoice" | "rebill" | "settle" | "reclaim";

export type Call = { fn: WriteFn; args: Arg[]; value?: bigint };

export type Votes = { agree: number; disagree: number; idle: number };

export type TxStatus = DecodedTx;

export type QuoteStatus = "quoted" | "accepted" | "invoiced" | "settled" | "reclaimed";
export const QUOTE_STATUSES: QuoteStatus[] = ["quoted", "accepted", "invoiced", "settled", "reclaimed"];

/** An invoice line's judgement, as the contract stores it; "" before it was judged. */
export type Verdict = "covered" | "not_covered" | "unclear" | "";

export type ApprovedLine = {
  line: number;
  kind: "quote" | "extra";
  text: string;
  priceAtto: string;
  /** quote lines: "quoted" until accepted, then "approved"; extras: "pending", "approved" or "lapsed" */
  status: "quoted" | "approved" | "pending" | "lapsed";
  paidAtto: string;
  askedAt: number;
  approvedAt: number;
};

export type InvoiceLine = {
  line: number;
  bills: number;
  text: string;
  priceAtto: string;
  verdict: Verdict;
  paidAtto: string;
  penaltyAtto: string;
  why: string;
  rebillText: string;
  rebillPriceAtto: string;
  rebillVerdict: Verdict;
  rebillPaidAtto: string;
  rebillPenaltyAtto: string;
};

export type Quote = {
  id: string;
  garage: string;
  customer: string;
  title: string;
  car: string;
  status: QuoteStatus;
  totalAtto: string;
  escrowAtto: string;
  heldAtto: string;
  paidAtto: string;
  penaltiesAtto: string;
  refundedAtto: string;
  lockAtto: string;
  jobSeconds: number;
  createdAt: number;
  acceptBy: number;
  acceptedAt: number;
  invoiceBy: number;
  invoicedAt: number;
  rebillBy: number;
  mask: string;
  fingerprint: string;
  rebilled: string;
  rebillMask: string;
  rebillFingerprint: string;
  closedAt: number;
  approved: ApprovedLine[];
  invoice: InvoiceLine[];
  /** the view's own clock, seconds */
  now: number;
  acceptable: boolean;
  invoiceable: boolean;
  reclaimable: boolean;
  rebillable: boolean;
  customerMaySettle: boolean;
};

export type QuoteRow = {
  id: string;
  garage: string;
  customer: string;
  title: string;
  car: string;
  status: QuoteStatus;
  totalAtto: string;
  heldAtto: string;
  paidAtto: string;
  mask: string;
  invoiceBy: number;
  /** only in quotes_of(): the address's part in it */
  role: "garage" | "customer" | "";
};

export type Paged<T> = { total: number; offset: number; limit: number; rows: T[] };

export type GarageInfo = {
  who: string;
  registered: boolean;
  name: string;
  bondAtto: string;
  registeredAt: number;
  quotes: number;
  paidAtto: string;
  penaltiesAtto: string;
  mayQuote: boolean;
};

export type Stats = {
  garages: number;
  quotes: number;
  invoiced: number;
  rebills: number;
  settled: number;
  reclaimed: number;
  refusalsRefunded: number;
  covered: number;
  notCovered: number;
  unclear: number;
  bondsFreeAtto: string;
  bondsLockedAtto: string;
  escrowHeldAtto: string;
  paidToGaragesAtto: string;
  penaltiesToCustomersAtto: string;
  refundedToCustomersAtto: string;
  balanceOwedAtto: string;
  now: number;
};

export type Rules = Record<string, unknown>;

export type ReadResult<T> = { data: T; source: "chain" | "mock" };

/** What GET /api/demo/status answers. */
export type DemoStatus = {
  online: boolean;
  reason: string;
  /** the demo garage's public address, "" while no key is set */
  bot: string;
  name: string;
  bondAtto: string;
  /** the free bond the bot keeps before it calls itself online */
  neededAtto: string;
};

export type DemoAnswer = { ok: true; hash: string; quote?: string } | { ok: false; reason: string; retryAfter?: number };

/** The moves the demo garage can be asked to make. */
export type DemoMove = "quote" | "extra" | "invoice" | "rebill" | "settle";
