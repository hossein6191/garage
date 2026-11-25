// Every waiting state, for every role, answers the five questions; the customer is told to act exactly
// when the contract waits on them.

import test from "node:test";
import assert from "node:assert/strict";

import { JOB_STATES, ROLES, demoGuide, jobGuide, jobState, roleOf, sendingGuide, signGuide } from "../../lib/guide.ts";
import { mapQuote } from "../../lib/parse.ts";
import { decodeTx, isDone } from "../../lib/rpc.ts";
import { BOT, ME, row } from "./fixture.mjs";

const pending = row().approved.map((a) => (a.kind === "extra" ? { ...a, status: "pending" } : a));
const CASES = {
  quoted: [{ status: "quoted", held: "0" }, 2000],
  lapsed: [{ status: "quoted" }, 1000 + 7 * 86400],
  working: [{ status: "accepted", invoice: [] }, 1500],
  extra_pending: [{ status: "accepted", approved: pending, invoice: [] }, 1500],
  overdue: [{ status: "accepted", invoice: [] }, 1100 + 86400],
  rebill_open: [{}, 2500],
  rebill_closed: [{}, 2000 + 86400],
  settled: [{ status: "settled", closed_at: 3000 }, 3000],
  reclaimed: [{ status: "reclaimed", closed_at: 3000 }, 3000],
};

const full = (g) => ["now", "time", "need", "leave", "money", "kicker"].every((k) => typeof g[k] === "string" && g[k].length > 3);

test("every state is reached, and every role gets all five lines", () => {
  for (const s of JOB_STATES) {
    const [over, now] = CASES[s];
    const q = mapQuote(row(over));
    assert.equal(jobState(q, now), s, s);
    for (const role of ROLES) {
      const g = jobGuide(q, role, now, { demo: true });
      assert.ok(full(g), `${s}:${role}`);
      assert.ok(g.canLeave, `${s}:${role} may be left`);
    }
  }
});

test("the customer must act exactly when the contract waits on them", () => {
  const acts = ["quoted", "extra_pending", "overdue", "rebill_closed"];
  for (const s of JOB_STATES) {
    const [over, now] = CASES[s];
    const g = jobGuide(mapQuote(row(over)), "customer", now);
    assert.equal(g.mustAct, acts.includes(s), s);
    assert.equal(jobGuide(mapQuote(row(over)), "visitor", now).mustAct, false, `${s}: a visitor never must`);
  }
});

test("the money line names where the money is", () => {
  const [over, now] = CASES.working;
  assert.match(jobGuide(mapQuote(row({ ...over, held: "220000000000000000" })), "customer", now).money, /0\.22 GEN is held by the contract, not by the garage/);
  assert.match(jobGuide(mapQuote(row({ status: "settled" })), "customer", 3000).money, /0\.215 GEN went to the garage/);
  const open = jobGuide(mapQuote(row()), "customer", 2500);
  assert.equal(open.left, 2000 + 86400 - 2500);
  assert.match(open.now, /4 covered · 1 not · 1 unclear/);
});

test("the waits the site causes: the wallet holds you, a transaction does not", () => {
  const s = signGuide("accept", 220n * 10n ** 15n);
  assert.equal(s.mustAct, true);
  assert.equal(s.canLeave, false);
  assert.match(s.need, /0\.22 GEN/);
  assert.match(sendingGuide("invoice").now, /Validators are reading each invoice line/);
  assert.match(sendingGuide("invoice").time, /1 to 5 minutes/);
  assert.match(sendingGuide("accept", 220n * 10n ** 15n).money, /not to the garage/);
  for (const m of ["asking", "quote", "extra", "invoice", "rebill", "settle"]) assert.ok(full(demoGuide(m)), m);
  assert.match(demoGuide("quote").money, /No money has moved/);
});

test("roles", () => {
  const q = mapQuote(row());
  assert.equal(roleOf(q, ME.toUpperCase().replace("0X", "0x")), "customer");
  assert.equal(roleOf(q, BOT), "garage");
  assert.equal(roleOf(q, ""), "visitor");
});

test("where the wallet asks for a signature, the small network fee is named, and a write is done only with its execution result", () => {
  for (const s of [signGuide("accept", 220n * 10n ** 15n), signGuide("invoice")]) {
    assert.match(s.money, /small network fee, a deposit of about 0\.1 GEN/);
    assert.match(s.money, /comes back once it is final/);
  }
  assert.match(signGuide("accept", 220n * 10n ** 15n).need, /plus the small network fee/);
  const votes = { "0xa": "agree", "0xb": "agree", "0xc": "agree" };
  assert.equal(isDone(decodeTx({ status: "ACCEPTED", consensus_data: { votes } })), false);
  assert.equal(isDone(decodeTx({ status: "FINALIZED", consensus_data: { votes } })), false);
  const done = decodeTx({ status: "FINALIZED", txExecutionResultName: "FINISHED_WITH_ERROR", consensus_data: { votes } });
  assert.equal(isDone(done), true);
  assert.equal(done.exec, "ERROR");
  assert.equal(decodeTx({ status: "FINALIZED", txExecutionResultName: "FINISHED_WITH_RETURN", consensus_data: { votes } }).exec, "SUCCESS");
});
