// The demo garage's plumbing, with no network: the forgiving key reader, the rate limiter, the script's
// words (the smoke's demonstration, word for word), and the choice of its next move in every state.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";

import { BAD_KEY, NO_KEY, cleanKey, keyProblem } from "../../lib/demo-key.ts";
import { createLimiter } from "../../lib/demo-limit.ts";
import { DEMO_CAR, DEMO_EXTRA, DEMO_INVOICE, DEMO_QUOTE, DEMO_REBILL, DEMO_TITLE, demoTurn, invoiceLines, openDemoQuote, quoteArgs, rebillLines } from "../../lib/demo-script.ts";
import { mapQuote } from "../../lib/parse.ts";
import { BOT, M, ME, row } from "./fixture.mjs";

const K = "ab".repeat(32);
const q = (over) => mapQuote(row(over));

test("the key reader forgives the ways a key gets pasted, and names what is wrong without repeating it", () => {
  for (const pasted of [K, "0x" + K, "0X" + K, `"0x${K}"`, `'${K}'`, `  0x${K}\n`]) {
    assert.equal(keyProblem(pasted), "");
    assert.equal(cleanKey(pasted), "0x" + K);
  }
  assert.equal(keyProblem(undefined), NO_KEY);
  assert.equal(keyProblem('""'), NO_KEY);
  assert.equal(keyProblem("0x1234"), BAD_KEY);
  assert.ok(!BAD_KEY.includes(K));
});

test("the limiter: one attempt per job every twenty seconds, twelve a minute in all", () => {
  const l = createLimiter({ perKeyMs: 20_000, globalMax: 12, globalWindowMs: 60_000 });
  assert.equal(l.attempt("Q1", 0).ok, true);
  assert.equal(l.attempt("Q1", 1000).ok, false);
  assert.equal(l.attempt("Q1", 20_000).ok, true);
  for (let i = 2; i <= 11; i++) assert.equal(l.attempt("Q" + i, 21_000).ok, true);
  assert.equal(l.attempt("Q99", 22_000).ok, false);
});

test("the script says exactly the smoke's words", () => {
  const smoke = readFileSync(new URL("../../../tests/on_chain/smoke.mjs", import.meta.url), "utf8");
  for (const t of [DEMO_TITLE, DEMO_CAR, DEMO_EXTRA.text, ...DEMO_QUOTE.map((l) => l.text), ...DEMO_INVOICE.map((l) => l.text)]) assert.ok(smoke.includes(JSON.stringify(t)), t);
  assert.equal(DEMO_INVOICE.map((l) => l.bills).join(""), "123433");
  assert.deepEqual(quoteArgs(ME.toUpperCase().replace("0X", "0x")).slice(0, 3), [ME, DEMO_TITLE, DEMO_CAR]);
});

test("the invoice: six lines with the extra approved, five without it, never an unapproved line", () => {
  assert.equal(invoiceLines(q({ status: "accepted" })).length, 6);
  const noExtra = q({ status: "accepted", approved: row().approved.map((a) => (a.kind === "extra" ? { ...a, status: "pending" } : a)) });
  const five = invoiceLines(noExtra);
  assert.equal(five.length, 5);
  assert.ok(five.every((l) => l.bills !== 4));
  assert.equal(invoiceLines(q({ status: "accepted", approved: row().approved.slice(0, 3) })).length, 5);
});

test("the re-bill: only the unclear Sundries, in new words, at no higher price", () => {
  const r = rebillLines(q());
  assert.deepEqual(r, [{ line: 6, text: DEMO_REBILL.text, price: 10n * M }]);
  const covered = row();
  covered.invoice[5].verdict = "covered";
  assert.deepEqual(rebillLines(mapQuote(covered)), []);
  const cheap = row();
  cheap.invoice[5].price = String(4n * M);
  assert.equal(rebillLines(mapQuote(cheap))[0].price, 4n * M);
});

test("the next move, state by state", () => {
  assert.deepEqual(demoTurn(null, BOT).moves, []);
  assert.match(demoTurn(q({ garage: ME }), BOT).why, /not one of the demo garage's quotes/);
  assert.match(demoTurn(q({ title: "Other job" }), BOT).why, /not one of the demo garage's quotes/);
  assert.deepEqual(demoTurn(q({ status: "quoted" }), BOT).moves, []);
  assert.match(demoTurn(q({ status: "quoted" }), BOT).why, /waits for the customer/);
  assert.deepEqual(demoTurn(q({ status: "accepted", approved: row().approved.slice(0, 3) }), BOT, 1500).moves, ["extra"]);
  assert.deepEqual(demoTurn(q({ status: "accepted" }), BOT, 1500).moves, ["invoice"]);
  assert.deepEqual(demoTurn(q({ status: "accepted", approved: row().approved.map((a) => (a.kind === "extra" ? { ...a, status: "pending" } : a)) }), BOT, 1500).moves, ["invoice"]);
  assert.match(demoTurn(q({ status: "accepted" }), BOT, 1100 + 86400).why, /deadline .* has passed/);
  assert.deepEqual(demoTurn(q(), BOT, 2500).moves, ["rebill", "settle"]);
  assert.deepEqual(demoTurn(q({ rebillable: false }), BOT, 2500).moves, ["settle"]);
  assert.deepEqual(demoTurn(q({ rebilled: "6" }), BOT, 2500).moves, ["settle"]);
  assert.deepEqual(demoTurn(q(), BOT, 2000 + 86400).moves, ["settle"]);
  assert.deepEqual(demoTurn(q({ status: "settled" }), BOT).moves, []);
  assert.deepEqual(demoTurn(q({ status: "reclaimed" }), BOT).moves, []);
});

test("one demo job in progress per visitor: the newest open one is found", () => {
  const r = (id, status, over = {}) => ({ id, garage: BOT, customer: ME, title: DEMO_TITLE, car: "", status, totalAtto: "0", heldAtto: "0", paidAtto: "0", mask: "", invoiceBy: 0, role: "customer", ...over });
  assert.equal(openDemoQuote([r("Q1", "settled"), r("Q3", "accepted"), r("Q2", "quoted")], BOT).id, "Q3");
  assert.equal(openDemoQuote([r("Q1", "settled"), r("Q4", "quoted", { garage: ME })], BOT), null);
});

test("the demo routes take an address or a quote id, never a text; nothing logs or returns the key", () => {
  const dir = new URL("../../app/api/demo/", import.meta.url);
  const sources = readdirSync(dir).filter((d) => !d.startsWith("._")).map((d) => readFileSync(new URL(`${d}/route.ts`, dir), "utf8"));
  sources.push(readFileSync(new URL("../../lib/demo-route.ts", import.meta.url), "utf8"));
  const server = readFileSync(new URL("../../lib/demo-server.ts", import.meta.url), "utf8");
  for (const s of [...sources, server]) {
    assert.ok(!/console\./.test(s), "no logging");
    assert.ok(!/body\.(text|lines|price|reason)/.test(s), "no visitor text is read");
  }
  // The key is read in demoAccount() alone, and only an account made from it leaves that function.
  const outside = server.replace(/function demoAccount\(\)[\s\S]*?\n}\n/, "").replace(/^\s*\/\/.*$/gm, "").replace(/^let account: .*$/m, "");
  assert.ok(!/process\.env\[KEY_VAR\]\)?[^;]*\b(body|json|return \{)/.test(outside));
  assert.ok(!/\bkey\b/.test(outside.replace(/keyProblem|KEY_VAR|key set|private key|demo-key/g, "")), "no other code touches the key");
});
