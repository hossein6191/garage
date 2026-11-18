// The copy of rules() kept with the site is the contract's own words: the question and every prompt
// paragraph, read out of contracts/garage.py.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { PROMPT, QUESTION, RULES_COPY } from "../../lib/contract-rules.ts";

const source = readFileSync(new URL("../../../contracts/garage.py", import.meta.url), "utf8");

/** A module-level constant of the contract, its implicitly concatenated string pieces joined. */
function constant(name) {
  const m = new RegExp(`^${name} = \\(([\\s\\S]*?)\\)\\n\\n`, "m").exec(source);
  assert.ok(m, name);
  const pieces = [...m[1].matchAll(/"((?:[^"\\]|\\.)*)"|'((?:[^'\\]|\\.)*)'/g)].map((p) => (p[1] ?? p[2]).replace(/\\"/g, '"').replace(/\\'/g, "'"));
  return pieces.join("");
}

test("the question, word for word", () => {
  assert.equal(QUESTION, constant("QUESTION"));
  assert.equal(RULES_COPY.question, QUESTION);
});

test("every prompt paragraph, word for word", () => {
  assert.equal(PROMPT.preamble, constant("PREAMBLE"));
  assert.equal(PROMPT.untrusted, constant("UNTRUSTED"));
  assert.equal(PROMPT.scope, constant("SCOPE"));
  assert.equal(PROMPT.order, constant("ORDER_NOTE"));
  assert.equal(PROMPT.return, constant("RETURN"));
});

test("the other rules() strings appear in the contract's source", () => {
  const flat = source.replace(/"\s*\n\s*"/g, "").replace(/" \+ str\(PENALTY_PERCENT\) \+ "/g, "20").replace(/" \+ str\(REBILL_SECONDS\) \+ "/g, "86400").replace(/" \+ str\(MIN_STANDING\) \+ "/g, "100000000000000000");
  for (const k of ["reading", "compared", "not_asked", "no_veto"]) assert.ok(flat.includes(String(RULES_COPY[k])), k);
  for (const v of Object.values(RULES_COPY.money)) assert.ok(flat.includes(v), v);
  for (const v of Object.values(RULES_COPY.who)) assert.ok(flat.includes(v), v);
  for (const v of RULES_COPY.limits) assert.ok(flat.includes(v), v);
});
