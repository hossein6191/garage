// The money of one job, worked out the way contracts/garage.py works it, in integers: what the
// customer pays to accept, what the invoice locks from the garage's bond, what each judged line pays,
// what moves from the bond to the customer, and what comes back. The pages use it to preview a
// payment and to check a receipt adds up; the contract itself is always the one that moves money.
// Pure, so tests/unit/money.test.mjs runs it.

import { big } from "./format.ts";
import type { ApprovedLine, InvoiceLine, Quote } from "./types.ts";

export const PENALTY_PERCENT = 20n;
export const MIN_STANDING = 10n ** 17n; // 0.1 GEN of free bond to write a quote

/** 20 percent of a line's invoice price, rounded down as the contract rounds it. */
export const penaltyOf = (priceAtto: string | bigint): bigint => (big(priceAtto) * PENALTY_PERCENT) / 100n;

/** The bond an invoice locks until its verdict: 20 percent of every line, each rounded down. */
export const lockOf = (prices: (string | bigint)[]): bigint => prices.reduce<bigint>((s, p) => s + penaltyOf(p), 0n);

/** The sum of a list of prices. */
export const sumOf = (prices: (string | bigint)[]): bigint => prices.reduce<bigint>((s, p) => s + big(p), 0n);

/** Everything the customer has paid in: the quote total and every approved extra. */
export function escrowOf(approved: ApprovedLine[]): bigint {
  return approved.filter((l) => l.kind === "quote" || l.status === "approved").reduce((s, l) => s + big(l.priceAtto), 0n);
}

export type LineMoney = { line: number; paid: bigint; penalty: bigint; locked: bigint; capped: boolean };

/**
 * One round of judging, as the contract applies it: a covered line is paid its invoice price, but
 * never more than what is left of the approved line it bills against (several lines against one
 * approved line share it, in invoice order); a not-covered line is unpaid and 20 percent of it moves
 * to the customer; an unclear line is unpaid and its 20 percent stays locked.
 * `alreadyPaid` is what each approved line has been paid before this round (by number).
 */
export function judgeMoney(approved: ApprovedLine[], lines: { line: number; bills: number; priceAtto: string }[], mask: string, alreadyPaid: Map<number, bigint> = new Map()): LineMoney[] {
  const paidSoFar = new Map(alreadyPaid);
  const priceOf = new Map(approved.map((a) => [a.line, big(a.priceAtto)]));
  return lines.map((l, k) => {
    const letter = mask.charAt(k);
    const price = big(l.priceAtto);
    if (letter === "C") {
      const room = (priceOf.get(l.bills) ?? 0n) - (paidSoFar.get(l.bills) ?? 0n);
      const got = price < room ? price : room > 0n ? room : 0n;
      paidSoFar.set(l.bills, (paidSoFar.get(l.bills) ?? 0n) + got);
      return { line: l.line, paid: got, penalty: 0n, locked: 0n, capped: got < price };
    }
    if (letter === "N") return { line: l.line, paid: 0n, penalty: penaltyOf(price), locked: 0n, capped: false };
    return { line: l.line, paid: 0n, penalty: 0n, locked: penaltyOf(price), capped: false };
  });
}

export type Receipt = {
  /** paid into escrow by the customer */
  escrow: bigint;
  /** paid to the garage for covered lines, the invoice and any re-bill */
  toGarage: bigint;
  /** moved from the garage's bond to the customer */
  penalties: bigint;
  /** escrow back to the customer: everything not paid to the garage */
  refund: bigint;
  /** still held by the contract */
  held: bigint;
  /** what the job cost the customer in the end: escrow less refund less penalties */
  net: bigint;
};

/** The receipt of a quote as the contract reports it, and whether it adds up. */
export function receiptOf(q: Quote): Receipt & { balanced: boolean } {
  const escrow = big(q.escrowAtto);
  const toGarage = big(q.paidAtto);
  const penalties = big(q.penaltiesAtto);
  const refund = big(q.refundedAtto);
  const held = big(q.heldAtto);
  return { escrow, toGarage, penalties, refund, held, net: escrow - refund - penalties, balanced: escrow === toGarage + refund + held };
}

/** The per-line money of an invoice as stored, with the re-bill folded in when there was one. */
export function lineMoney(l: InvoiceLine): { paid: bigint; penalty: bigint } {
  return { paid: big(l.paidAtto) + big(l.rebillPaidAtto), penalty: big(l.penaltyAtto) + big(l.rebillPenaltyAtto) };
}
