// How a line's verdict is shown: the stamp, the money line, and which verdict counts after a re-bill.

import test from "node:test";
import assert from "node:assert/strict";

import { mapQuote } from "../../lib/parse.ts";
import { lineView, maskSummary, maskVerdicts, stampOf } from "../../lib/verdict.ts";
import { M, row } from "./fixture.mjs";

const lines = () => mapQuote(row()).invoice;

test("one stamp per verdict, in its colour", () => {
  assert.deepEqual([stampOf("covered").word, stampOf("covered").tone], ["COVERED", "covered"]);
  assert.deepEqual([stampOf("not_covered").word, stampOf("not_covered").tone], ["NOT", "not"]);
  assert.deepEqual([stampOf("unclear").word, stampOf("unclear").tone], ["UNCLEAR", "unclear"]);
  assert.equal(stampOf("").tone, "waiting");
});

test("covered: paid in full, or capped at what was left of the approved line", () => {
  const [discs, fluid] = lines();
  const a = lineView(discs);
  assert.equal(a.final.word, "COVERED");
  assert.equal(a.capped, false);
  assert.match(a.money, /^Paid 0\.12 GEN to the garage\.$/);
  const b = lineView(fluid);
  assert.equal(b.capped, true);
  assert.match(b.money, /Paid 0\.02 GEN of 0\.03 GEN billed: only that was left of approved line 2\./);
});

test("not covered: unpaid, and the 20 percent named", () => {
  const v = lineView(lines()[4]);
  assert.equal(v.final.word, "NOT");
  assert.match(v.money, /0\.005 GEN \(20 percent\) moved from the garage's bond to the customer/);
});

test("unclear: unpaid with no penalty, and the re-bill offered", () => {
  const v = lineView(lines()[5]);
  assert.equal(v.final.word, "UNCLEAR");
  assert.equal(v.rebill, null);
  assert.match(v.money, /no penalty.*re-bill it once/);
});

test("a re-billed line shows both stamps, and the re-bill's verdict decides the money", () => {
  const l = { ...lines()[5], rebillText: "Brake cleaner spray used bleeding the brakes", rebillPriceAtto: String(10n * M), rebillVerdict: "covered", rebillPaidAtto: String(10n * M) };
  const v = lineView(l);
  assert.equal(v.first.word, "UNCLEAR");
  assert.equal(v.rebill.word, "COVERED");
  assert.equal(v.final.word, "COVERED");
  assert.match(v.money, /Paid 0\.01 GEN/);
  const again = lineView({ ...l, rebillVerdict: "unclear", rebillPaidAtto: "0" });
  assert.equal(again.final.word, "UNCLEAR");
  assert.match(again.money, /re-billed once already/);
});

test("the mask reads as verdicts and as a summary", () => {
  assert.deepEqual(maskVerdicts("CNU?"), ["covered", "not_covered", "unclear", ""]);
  assert.equal(maskSummary("CCCCNU"), "4 covered · 1 not · 1 unclear");
  assert.equal(maskSummary(""), "not invoiced");
});
