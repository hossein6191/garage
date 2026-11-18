// The money of the demonstration, worked out as the contract works it, against the smoke's receipts:
// the garage paid 0.215 GEN (the fluid capped at its approved 0.02), 0.005 GEN of penalty to the
// customer, 0.002 GEN of bond locked behind "Sundries", and the 0.02 still held coming back.

import test from "node:test";
import assert from "node:assert/strict";

import { DEMO_INVOICE, DEMO_QUOTE, DEMO_TOTAL, DEMO_EXTRA } from "../../lib/demo-script.ts";
import { escrowOf, judgeMoney, lineMoney, lockOf, penaltyOf, receiptOf } from "../../lib/money.ts";
import { gen, parseGen } from "../../lib/format.ts";
import { mapQuote } from "../../lib/parse.ts";
import { M, row } from "./fixture.mjs";

const approved = mapQuote(row()).approved.map((a) => ({ ...a, paidAtto: "0" }));
const billed = DEMO_INVOICE.map((l, k) => ({ line: k + 1, bills: l.bills, priceAtto: l.price.toString() }));

test("the quote and the escrow", () => {
  assert.equal(DEMO_TOTAL, 220n * M);
  assert.equal(escrowOf(approved), 220n * M + DEMO_EXTRA.price);
  assert.equal(escrowOf(approved.map((a) => (a.kind === "extra" ? { ...a, status: "pending" } : a))), 220n * M);
});

test("20 percent, rounded down as the contract rounds it; the invoice locks 0.052 GEN", () => {
  assert.equal(penaltyOf(25n * M), 5n * M);
  assert.equal(penaltyOf(7n), 1n);
  assert.equal(lockOf(DEMO_INVOICE.map((l) => l.price)), 52n * M);
});

test("CCCCNU: 0.215 to the garage, 0.005 to the customer, 0.002 locked", () => {
  const m = judgeMoney(approved, billed, "CCCCNU");
  const sum = (k) => m.reduce((s, x) => s + x[k], 0n);
  assert.equal(sum("paid"), 215n * M);
  assert.equal(sum("penalty"), 5n * M);
  assert.equal(sum("locked"), 2n * M);
  assert.equal(m[1].paid, 20n * M, "the fluid is capped at its approved price");
  assert.equal(m[1].capped, true);
  assert.equal(m[2].capped, false);
});

test("lines billed against one approved line share it, in invoice order", () => {
  const all = judgeMoney(approved, billed, "CCCCCC");
  assert.equal(all[2].paid, 60n * M);
  assert.equal(all[4].paid, 20n * M, "the cabin filter, if covered, gets only the 0.02 left of labour");
  assert.equal(all[5].paid, 0n, "and Sundries nothing");
});

test("a re-bill: what is left of the approved line is counted from what it was paid", () => {
  const paid = new Map([[3, 60n * M]]);
  const r = judgeMoney(approved, [{ line: 6, bills: 3, priceAtto: String(10n * M) }], "C", paid);
  assert.equal(r[0].paid, 10n * M);
  const full = judgeMoney(approved, [{ line: 6, bills: 3, priceAtto: String(30n * M) }], "C", paid);
  assert.equal(full[0].paid, 20n * M);
});

test("without the extra: five lines, CCCNU, 0.2 to the garage", () => {
  const five = billed.filter((l) => l.bills !== 4);
  const m = judgeMoney(approved, five, "CCCNU");
  assert.equal(m.reduce((s, x) => s + x.paid, 0n), 200n * M);
});

test("the receipt of a quote adds up, and the net cost", () => {
  const settled = mapQuote(row({ status: "settled", held: "0", refunded: String(20n * M), lock: "0" }));
  const r = receiptOf(settled);
  assert.equal(r.balanced, true);
  assert.equal(r.net, 235n * M - 20n * M - 5n * M);
  assert.equal(receiptOf(mapQuote(row({ paid: "1" }))).balanced, false);
  assert.deepEqual(lineMoney({ paidAtto: "3", rebillPaidAtto: "4", penaltyAtto: "1", rebillPenaltyAtto: "0" }), { paid: 7n, penalty: 1n });
});

test("amounts print and parse", () => {
  assert.equal(gen(215n * M), "0.215 GEN");
  assert.equal(gen(2n * M), "0.002 GEN");
  assert.equal(gen(0n), "0 GEN");
  assert.equal(gen("abc"), "0 GEN");
  assert.equal(parseGen("0.22"), 220n * M);
  assert.equal(parseGen("1."), 10n ** 18n);
  assert.equal(parseGen("x"), null);
  assert.equal(DEMO_QUOTE.length, 3);
});
