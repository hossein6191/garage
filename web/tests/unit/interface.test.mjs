// Every call the site builds names a write method of contracts/garage.py with its arguments in order,
// and sends value only to a payable one.

import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { calls } from "../../lib/calls.ts";
import { quoteArgs } from "../../lib/demo-script.ts";

const source = readFileSync(new URL("../../../contracts/garage.py", import.meta.url), "utf8");
const methods = new Map();
for (const m of source.matchAll(/@gl\.public\.write(\.payable)?\n\s+def (\w+)\(self(?:, ([^)]*))?\)/g)) methods.set(m[2], { payable: !!m[1], args: m[3] ? m[3].split(",").length : 0 });

test("every builder matches a write method", () => {
  const built = [
    calls.accept("Q1", 5n),
    calls.approveExtra("Q1", 4, 5n),
    calls.settle("Q1"),
    calls.reclaim("Q1"),
    calls.quote(quoteArgs("0x" + "1".repeat(40))),
    calls.requestExtra("Q1", "Front wiper blades", 5n),
    calls.invoice("Q1", "[]"),
    calls.rebill("Q1", "[]"),
  ];
  for (const c of built) {
    const m = methods.get(c.fn);
    assert.ok(m, c.fn);
    assert.equal(c.args.length, m.args, c.fn);
    assert.equal((c.value ?? 0n) > 0n, m.payable, c.fn);
  }
  assert.deepEqual([...methods.keys()].sort(), ["accept", "approve_extra", "deposit", "invoice", "quote", "rebill", "reclaim", "register", "request_extra", "settle", "withdraw"]);
});
