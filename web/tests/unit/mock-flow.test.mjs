// The whole demonstration on the in-memory contract of mock mode, as a visitor plays it: the demo
// garage quotes, the customer accepts and approves the extra, the garage invoices (judged CCCCNU by the
// mock's word rule), re-bills Sundries (covered) and the job settles, every balance where the receipts
// say. Then the same walk without the extra, settled by the garage, and a customer who reclaims.

import test from "node:test";
import assert from "node:assert/strict";

import * as mock from "../../lib/chain-mock.ts";
import { calls } from "../../lib/calls.ts";
import { DEMO_EXTRA_LINE, DEMO_TOTAL, DEMO_EXTRA } from "../../lib/demo-script.ts";
import { mapQuote } from "../../lib/parse.ts";

const M = 10n ** 15n;
const ME = mock.PERSONAS[0].address;
const OTHER = mock.PERSONAS[1].address;
const read = async (id) => mapQuote(await mock.view("get_quote", [id]));
const last = async (hash) => mock.txStatus(hash);

async function newQuote(who) {
  const a = await mock.demoMove("quote", who);
  assert.equal(a.ok, true, a.reason);
  return a.quote;
}

test("the six steps, with the extra and the re-bill", async () => {
  mock.setMockPersona(ME);
  const start = await mock.balanceOf(ME);
  const id = await newQuote(ME);
  assert.equal((await mock.demoMove("quote", ME)).ok, false, "one demo job at a time");
  assert.equal((await read(id)).status, "quoted");
  assert.equal((await mock.demoMove("invoice", id)).ok, false, "not the garage's turn");

  const short = await mock.write(calls.accept(id, DEMO_TOTAL - 1n));
  assert.equal((await last(short)).result.ok, false);
  assert.equal(await mock.balanceOf(ME), start, "a short payment comes back whole");
  await mock.write(calls.accept(id, DEMO_TOTAL));
  assert.equal((await read(id)).heldAtto, String(DEMO_TOTAL));

  assert.equal((await mock.demoMove("extra", id)).ok, true);
  assert.deepEqual((await read(id)).approved.map((a) => a.status), ["approved", "approved", "approved", "pending"]);
  await mock.write(calls.approveExtra(id, DEMO_EXTRA_LINE, DEMO_EXTRA.price));

  assert.equal((await mock.demoMove("invoice", id)).ok, true);
  let q = await read(id);
  assert.equal(q.mask, "CCCCNU");
  assert.equal(q.paidAtto, String(215n * M));
  assert.equal(q.penaltiesAtto, String(5n * M));
  assert.equal(q.heldAtto, String(20n * M));
  assert.equal(q.lockAtto, String(2n * M));

  assert.equal((await mock.demoMove("rebill", id)).ok, true);
  q = await read(id);
  assert.equal(q.status, "settled");
  assert.equal(q.invoice[5].rebillVerdict, "covered");
  assert.equal(q.paidAtto, String(225n * M));
  assert.equal(q.refundedAtto, String(10n * M));
  assert.equal(q.heldAtto, "0");
  assert.equal(await mock.balanceOf(ME), start - 235n * M + 10n * M + 5n * M);
  const s = JSON.parse(await mock.view("stats", []));
  assert.equal(s.escrow_held, "0");
  assert.equal(s.bonds_locked, "0");
});

test("without the extra: five lines, and the garage settles", async () => {
  mock.setMockPersona(OTHER);
  const id = await newQuote(OTHER);
  await mock.write(calls.accept(id, DEMO_TOTAL));
  await mock.demoMove("extra", id);
  await mock.demoMove("invoice", id);
  let q = await read(id);
  assert.equal(q.invoice.length, 5);
  assert.equal(q.mask, "CCCNU");
  assert.equal(q.approved[3].status, "lapsed");
  assert.equal((await mock.demoMove("settle", id)).ok, true);
  q = await read(id);
  assert.equal(q.status, "settled");
  assert.equal(q.refundedAtto, String(20n * M));
});

test("a garage that never invoices: the customer reclaims after the deadline, not before", async () => {
  mock.setMockPersona(ME);
  const id = await newQuote(ME);
  await mock.write(calls.accept(id, DEMO_TOTAL));
  const early = await last(await mock.write(calls.reclaim(id)));
  assert.equal(early.exec, "ERROR");
  assert.match(early.message, /\[EXPECTED\] the garage may invoice/);
  mock.advanceClock(86400 + 1);
  assert.match((await mock.demoMove("extra", id)).reason, /deadline/);
  await mock.write(calls.reclaim(id));
  assert.equal((await read(id)).status, "reclaimed");
});
