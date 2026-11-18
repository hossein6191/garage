// Reading the contract's rows: every view's JSON onto the page shapes, with defaults for what is missing.

import test from "node:test";
import assert from "node:assert/strict";

import { madeQuote, mapGarage, mapPage, mapPayout, mapQuote, mapStats, refundOf } from "../../lib/parse.ts";
import { BOT, M, ME, row } from "./fixture.mjs";

test("get_quote(): a full row maps field by field, from a JSON string or an object", () => {
  for (const raw of [row(), JSON.stringify(row())]) {
    const q = mapQuote(raw);
    assert.equal(q.id, "Q7");
    assert.equal(q.garage, BOT);
    assert.equal(q.customer, ME);
    assert.equal(q.status, "invoiced");
    assert.equal(q.escrowAtto, String(235n * M));
    assert.equal(q.mask, "CCCCNU");
    assert.equal(q.approved.length, 4);
    assert.equal(q.approved[3].kind, "extra");
    assert.equal(q.invoice[4].verdict, "not_covered");
    assert.equal(q.invoice[4].penaltyAtto, String(5n * M));
    assert.equal(q.invoice[5].bills, 3);
    assert.equal(q.rebillable, true);
    assert.equal(q.customerMaySettle, false);
  }
});

test("get_quote(): an error answer, a row without parties, and junk are no quote", () => {
  assert.equal(mapQuote({ error: "no quote Q9" }), null);
  assert.equal(mapQuote(JSON.stringify({ error: "no quote Q9" })), null);
  assert.equal(mapQuote({ quote: "Q1" }), null);
  assert.equal(mapQuote("not json"), null);
  assert.equal(mapQuote(null), null);
});

test("get_quote(): missing and malformed fields get safe defaults", () => {
  const q = mapQuote({ quote: "Q2", garage: BOT.toUpperCase().replace("0X", "0x"), status: "weird", total: "-5", mask: "XYZ", now: -1, approved: [{ line: "2", status: "odd" }, null, 3], invoice: "no" });
  assert.equal(q.garage, BOT);
  assert.equal(q.status, "quoted");
  assert.equal(q.totalAtto, "0");
  assert.equal(q.mask, "");
  assert.equal(q.now, 0);
  assert.equal(q.approved.length, 1);
  assert.equal(q.approved[0].line, 2);
  assert.equal(q.approved[0].status, "quoted");
  assert.deepEqual(q.invoice, []);
  assert.equal(q.acceptable, false);
});

test("get_quote(): lines come back in their own order whatever order the JSON had", () => {
  const r = row();
  r.invoice.reverse();
  r.approved.reverse();
  const q = mapQuote(r);
  assert.deepEqual(q.invoice.map((l) => l.line), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(q.approved.map((l) => l.line), [1, 2, 3, 4]);
});

test("quotes() and quotes_of(): pages map, rows with a bad id are dropped, a page without rows is a failed read", () => {
  const p = mapPage(JSON.stringify({ total: 3, offset: 0, limit: 20, rows: [{ quote: "Q1", garage: BOT, customer: ME, status: "settled", role: "customer", total: "5" }, { quote: "nope" }] }));
  assert.equal(p.total, 3);
  assert.equal(p.rows.length, 1);
  assert.equal(p.rows[0].role, "customer");
  assert.equal(p.rows[0].status, "settled");
  assert.throws(() => mapPage({ total: 1 }));
});

test("garage() and stats()", () => {
  const g = mapGarage({ who: BOT, registered: true, name: "Demo Motors", bond: "995000000000000000", quotes: 4, paid: "1", penalties: "2", may_quote: true });
  assert.equal(g.name, "Demo Motors");
  assert.equal(g.bondAtto, "995000000000000000");
  assert.equal(g.mayQuote, true);
  assert.equal(mapGarage({ who: ME, registered: false, bond: "0" }).registered, false);
  const s = mapStats(JSON.stringify({ garages: 1, covered: 4, not_covered: 1, unclear: 1, balance_owed: "12", escrow_held: "007" }));
  assert.equal(s.notCovered, 1);
  assert.equal(s.balanceOwedAtto, "12");
  assert.equal(s.escrowHeldAtto, "7");
});

test("write returns: invoice payout, quote id, a refused payment", () => {
  const p = mapPayout({ ok: true, quote: "Q7", status: "invoiced", mask: "CCCCNU", paid: String(215n * M), penalty: String(5n * M), refunded: "0", held: String(20n * M), lock: String(2n * M) });
  assert.equal(p.mask, "CCCCNU");
  assert.equal(p.paidAtto, String(215n * M));
  assert.equal(mapPayout({ ok: true, quote: "Q7", status: "reclaimed", returned: "9" }).refundedAtto, "9");
  assert.equal(mapPayout({ ok: false }), null);
  assert.equal(madeQuote({ ok: true, quote: "Q12" }), "Q12");
  assert.equal(madeQuote({ ok: true, quote: "12" }), "");
  assert.deepEqual(refundOf({ ok: false, reason: "accept Q1 by sending its total", returned: "200" }), { reason: "accept Q1 by sending its total", returnedAtto: "200" });
  assert.equal(refundOf({ ok: true }), null);
});
