/* Garage against GenLayer Studio (chain 61999), with throwaway accounts. Deploys its own copy.
 *
 *   npm ci                                                  # genlayer-js 1.1.8 and viem 2.56.8
 *   node tests/on_chain/smoke.mjs                           # the whole run, from a fresh state
 *   RESUME=1 node tests/on_chain/smoke.mjs                  # continue a run that was cut off
 *   STATE=/some/dir/run.json RESUME=1 node tests/on_chain/smoke.mjs   # the same, with the state kept elsewhere
 *
 * Three generated accounts play the story, known only by their roles: GARAGE fixes the car, CUSTOMER owns
 * it, STRANGER holds nothing and tries what it may not.
 *
 *   1  deploy Garage.
 *   2  GARAGE registers as Northgate Motors and deposits a 0.2 GEN standing bond.
 *   3  GARAGE quotes CUSTOMER a front brake overhaul on a 2016 Skoda Octavia, three lines: front brake pads and
 *      discs 0.12 GEN, a brake fluid change 0.02 GEN, two hours of labour 0.08 GEN, 0.22 GEN in all. GARAGE
 *      invoices at once: refused, nothing has been accepted. CUSTOMER accepts paying 0.2 GEN: refused, and
 *      every atto comes back in the same transaction. CUSTOMER accepts paying exactly 0.22 GEN, held in escrow.
 *   4  GARAGE asks for an extra line, front wiper blades 0.015 GEN; CUSTOMER approves it by paying 0.015 GEN.
 *   5  CUSTOMER tries to invoice the job: refused, only the garage invoices. GARAGE invoices six lines: the pads
 *      and discs, the fluid and the labour in other words (the fluid billed at 0.03 GEN, above its approved
 *      0.02), the wiper blades, a "Replaced cabin filter" line nobody approved, and "Sundries". One consensus
 *      round, two askings: covered, covered, covered, covered, not covered, unclear. In the same transaction
 *      GARAGE is paid 0.215 GEN (the fluid capped at 0.02) and 0.005 GEN, 20 percent of the cabin filter,
 *      moves from its bond to CUSTOMER.
 *   6  GARAGE sends a second invoice: refused. GARAGE re-bills "Sundries" as "SUNDRIES.": refused, the same
 *      words. STRANGER tries to settle: refused. GARAGE settles, waiving its re-bill: the 0.02 GEN of labour
 *      never billed goes back to CUSTOMER and the bond locked behind "Sundries" back to GARAGE.
 *   7  GARAGE withdraws its free bond.
 *   8  the views read back, the code deployed compared with the file byte for byte, the contract's balance
 *      read, and every account's net movement checked against what the receipts say.
 *
 * Every refusal is a signed transaction. Balances are read after finalisation, because a transfer lands at
 * FINALIZED, not at ACCEPTED. Transactions are polled with eth_getTransactionByHash, never with views. An
 * invoice no majority carried stores nothing and, since invoice() carries no value, strands nothing; it is
 * sent again before the deadline and both transactions are kept. Every step is saved as it is made, so a run
 * cut off part way continues without sending anything twice. Every id is read from the receipt that created
 * it, never assumed. A whole run is one deployment and 15 transactions, one of them a consensus round of two
 * askings. A state file remembers the sha256 of the contract it deployed, and a RESUME against a state made
 * from another file stops before sending anything.
 */
import { createClient, createAccount } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { generatePrivateKey } from "viem/accounts";
import { getAddress } from "viem";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RPC = "https://studio.genlayer.com/api";
const STATE = process.env.STATE || join(tmpdir(), "garage-smoke-state.json");
const RECORD = process.env.RECORD || STATE.replace(/\.json$/, "") + "-record.json";
const FILE = new URL("../../contracts/garage.py", import.meta.url);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const stamp = () => new Date().toISOString().slice(11, 19);
const rpc = async (m, p) => {
  let last;
  for (let i = 0; i < 90; i++) {
    try {
      const r = await fetch(RPC, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: m, params: p }) });
      const j = await r.json();
      if (j.error && (j.error.code === -32029 || r.status === 429)) { await sleep(((j.error.data?.retry_after_seconds) || 20) * 1000); continue; }
      if (j.error) { last = new Error(m + ": " + JSON.stringify(j.error).slice(0, 200)); await sleep(6000); continue; }
      return j.result;
    } catch (e) { last = e; await sleep(4000); }
  }
  throw last;
};
let pass = 0, fail = 0;
const ok = (n, c, d = "") => { c ? pass++ : fail++; console.log(`${c ? "PASS" : "FAIL"}  ${n}${d ? "  - " + d : ""}`); return !!c; };
const GEN = 10n ** 18n, MILLI = GEN / 1000n;
const tally = (v) => `${v.agree} agree, ${v.disagree} disagree, ${v.idle} idle`;
const sha = (b) => createHash("sha256").update(b).digest("hex");
const need = (v, what) => { if (!v) { console.log(`stopping: ${what} was not in the receipt; nothing is assumed`); process.exit(2); } return v; };

// ---------- state: keys, addresses and every step already made survive a cut-off run ----------
const st = existsSync(STATE) && process.env.RESUME ? JSON.parse(readFileSync(STATE, "utf8")) : {};
st.keys = st.keys || {}; st.steps = st.steps || {}; st.views = st.views || {}; st.order = st.order || []; st.ids = st.ids || {}; st.when = st.when || {};
const SOURCE_SHA = sha(readFileSync(FILE));
if (st.source_sha256 && st.source_sha256 !== SOURCE_SHA) {
  console.log(`the state file ${STATE} belongs to a run of another contract file; start a fresh run without RESUME, or name another STATE`);
  process.exit(2);
}
st.source_sha256 = SOURCE_SHA;
const save = () => {
  writeFileSync(STATE, JSON.stringify(st, null, 1));
  const { keys, ...shown } = st;     // the record carries no key
  writeFileSync(RECORD, JSON.stringify(shown, null, 1));
};
const ROLES = {
  garage: "fixes the car; registers, keeps a bond, quotes, asks for an extra, invoices, settles",
  customer: "owns the car; accepts the quote, approves the extra, tries to invoice it",
  stranger: "holds nothing; tries to settle somebody else's job",
};
for (const k of Object.keys(ROLES)) st.keys[k] = st.keys[k] || generatePrivateKey();
const acct = {}, client = {};
for (const k of Object.keys(ROLES)) { acct[k] = createAccount(st.keys[k]); client[k] = createClient({ chain: studionet, account: acct[k] }); }
const rd = createClient({ chain: studionet });
st.accounts = Object.fromEntries(Object.keys(ROLES).map((k) => [k, getAddress(acct[k].address)]));
const low = (a) => String(a).toLowerCase();
save();

const balance = async (a) => BigInt(await rpc("eth_getBalance", [a, "latest"]) || "0x0");
const nonceOf = async (a) => Number(BigInt(await rpc("eth_getTransactionCount", [a, "latest"]) || "0x0"));
const fundOnce = async (k, whole) => {
  st.funded = st.funded || {};
  if (st.funded[k]) return;
  await rpc("sim_fundAccount", { account_address: getAddress(acct[k].address), amount: whole * 1e18 });   // checksummed; amount in atto, as a number
  for (let i = 0; i < 20 && (await balance(acct[k].address)) === 0n; i++) await sleep(3000);
  st.funded[k] = String(await balance(acct[k].address)); save();
};

// ---------- transactions ----------
const errText = (e) => String(e?.details || e?.shortMessage || e?.cause?.message || e?.message || e);
// A request the network refused or never received is made again. When the failure is ambiguous the
// sender's nonce says whether the transaction landed after all, and its hash is read back, so nothing is
// ever sent twice.
const sendRaw = async (who, what, make) => {
  const addr = acct[who].address;
  for (let i = 0; ; i++) {
    const n0 = await nonceOf(addr);
    try { return await make(); } catch (e) {
      if (i >= 8) throw e;
      console.log(`      ${what} was not taken (${errText(e).slice(0, 70)}); looking again in 20s`);
      await sleep(20000);
      if ((await nonceOf(addr)) > n0) {
        const list = await rpc("sim_getTransactionsForAddress", [addr]);
        const hit = (list || []).find((t) => low(t.from_address) === low(addr) && Number(t.nonce) === n0);
        if (hit?.hash) return hit.hash;
        throw new Error(what + " landed but its hash could not be read back");
      }
    }
  }
};
const countVotes = (t) => { let a = 0, d = 0, idl = 0; for (const k in (t.consensus_data?.votes || {})) { const v = t.consensus_data.votes[k]; if (v === "agree") a++; else if (v === "disagree") d++; else idl++; } return { agree: a, disagree: d, idle: idl }; };
const wait = async (tx) => {
  let stuck = 0;
  for (let i = 0; i < 900; i++) {
    await sleep(4000);
    const t = await rpc("eth_getTransactionByHash", [tx]);
    if (t?.status === "FINALIZED") {
      const lr = t.consensus_data?.leader_receipt, one = Array.isArray(lr) ? lr[0] : lr;
      let msg = "";
      try { msg = Buffer.from(one.result, "base64").toString("utf8").replace(/[^\x20-\x7e]/g, " ").trim(); } catch (e) {}
      const v = countVotes(t);
      return { tx, msg, exec: one?.execution_result || "", votes: v, applied: v.agree * 2 > v.agree + v.disagree + v.idle, address: t.data?.contract_address || t.to_address || "" };
    }
    // a round no majority carried is final as it stands once it has been left alone for ten minutes
    if (t?.status === "UNDETERMINED" && (stuck = stuck + 1) > 150) return { tx, msg: "UNDETERMINED", exec: "", votes: countVotes(t), applied: false, address: "" };
    if (t?.status === "CANCELED") return { tx, msg: "CANCELED", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
    if (i > 0 && i % 75 === 0) console.log(`      [${stamp()}] still ${t?.status || "unknown"} after ${Math.round(i * 4 / 60)} minutes: ${tx}`);
  }
  return { tx, msg: "TIMEOUT", exec: "", votes: { agree: 0, disagree: 0, idle: 0 }, applied: false, address: "" };
};
const jsonOf = (msg) => { const b = String(msg).indexOf("{"); if (b === -1) return null; try { return JSON.parse(String(msg).slice(b)); } catch (e) { return null; } };
const settle = async (a, before, want) => { for (let i = 0; i < 45; i++) { const b = await balance(a); if (b - before === want) return b; await sleep(4000); } return await balance(a); };

// One step: a signed transaction, its tally, what it returned, and the balances it moved. opt.watch names
// the roles whose balances are read before and after, opt.expect the change each should show (a table, or
// a function of what the call returned), and opt.again how long to wait before sending a refused step again.
const call = async (id, who, fn, args = [], opt = {}) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn, args: args.map(String), value: String(opt.value || 0n), tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    if (!rec.before) { rec.before = {}; for (const k of opt.watch || []) rec.before[k] = String(await balance(acct[k].address)); save(); }
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, fn, () => client[who].writeContract({ address: need(st.contract, "the contract address"), functionName: fn, args, ...(opt.value ? { value: opt.value } : {}) })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg });
      rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} ${fn}(${args.map((x) => String(x).slice(0, 22)).join(", ")})${opt.value ? " +" + Number(opt.value) / 1e18 + " GEN" : ""}  ${r.tx}  ${tally(r.votes)}  ${r.exec}`);
      if (r.msg === "TIMEOUT" || rec.tries.length >= 4) break;
      if (!r.applied) { console.log("      the validators did not carry that round (" + tally(r.votes) + "), so nothing was stored; sending it again"); continue; }
      const again = opt.again ? opt.again(r) : 0;
      if (again > 0) { console.log(`      not yet; waiting ${Math.round(again / 1000)} s and sending it again`); await sleep(again); continue; }
      break;
    }
    const last = rec.tries[rec.tries.length - 1];
    const expect = typeof opt.expect === "function" ? opt.expect(jsonOf(last.msg)) : opt.expect;
    rec.after = {}; rec.delta = {};
    for (const k of opt.watch || []) {
      const before = BigInt(rec.before[k]);
      const want = expect && expect[k] !== undefined ? BigInt(expect[k]) : null;
      const now = want === null ? await balance(acct[k].address) : await settle(acct[k].address, before, want);
      rec.after[k] = String(now); rec.delta[k] = String(now - before);
    }
    rec.done = true; save();
  }
  const last = rec.tries[rec.tries.length - 1];
  return { ...last, j: jsonOf(last.msg), tries: rec.tries, delta: rec.delta || {} };
};
const refused = (r, words) => r.exec === "ERROR" && r.msg.includes(words);
const moved = (r, k, want) => r.delta[k] === String(want);
const votes = (r) => r.tries.map((t) => tally(t.votes)).join(", then ");

const deploy = async (id, who) => {
  if (!st.steps[id]) { st.steps[id] = { id, who, fn: "deploy contracts/garage.py", args: [], value: "0", tries: [] }; st.order.push(id); }
  const rec = st.steps[id];
  if (!rec.done) {
    const code = readFileSync(FILE);
    for (;;) {
      if (!rec.pending) { rec.pending = await sendRaw(who, "deploy", () => client[who].deployContract({ code, args: [], leaderOnly: false })); save(); }
      const r = await wait(rec.pending);
      rec.tries.push({ tx: r.tx, votes: r.votes, exec: r.exec, applied: r.applied, msg: r.msg.slice(0, 300) });
      rec.address = r.address; rec.pending = null; save();
      console.log(`      [${stamp()}] ${who.toUpperCase()} deploy  ${r.tx}  ${tally(r.votes)}  ${r.exec}  ${r.address}`);
      if (r.applied || r.msg === "TIMEOUT" || rec.tries.length >= 3) break;
    }
    rec.done = true; save();
  }
  return need(rec.address, "the address of the deployed contract");
};

// ---------- reads: paced, and made again on a 429 instead of failing ----------
let lastRead = 0;
const read = async (fn, args = []) => {
  for (let i = 0; i < 30; i++) {
    const gap = 3500 - (Date.now() - lastRead);
    if (gap > 0) await sleep(gap);
    lastRead = Date.now();
    try { return JSON.parse(String(await rd.readContract({ address: st.contract, functionName: fn, args }))); } catch (e) {
      if (i === 29) return { error: "VIEW ERROR " + fn + ": " + errText(e).slice(0, 100) };
      await sleep(/rate|429|limit/i.test(errText(e)) ? 25000 : 10000);
    }
  }
};
// a view read once for a check is kept with the run, so a continued run checks what was seen then
const seen = async (id, fn, args = []) => { if (!st.views[id]) { st.views[id] = { fn, args, when: stamp(), out: await read(fn, args) }; save(); } return st.views[id].out; };
// the chain's own clock: the stats view reports the message clock as `now`, and this machine's clock stands in
// only when a read carries none
const chainNow = async () => { const s = await read("stats", []); return Number(s.now > 0 ? s.now : Math.floor(Date.now() / 1000)); };
// an instant fixed once, the first time a step needs it, so a continued run sends the same arguments
const fixed = async (id, ahead) => { if (!st.when[id]) { st.when[id] = (await chainNow()) + ahead; save(); } return st.when[id]; };
// wait, by the chain's own clock, until an instant has passed
const untilPast = async (instant, what) => {
  for (let i = 0; i < 40; i++) {
    const left = Number(instant) - (await chainNow());
    if (left < -10) return;
    console.log(`      [${stamp()}] waiting ${left + 20} s, by the chain clock, for ${what}`);
    await sleep((left + 20) * 1000);
  }
};
const notYet = (r) => { const m = /open for another (\d+) seconds/.exec(r.msg); return r.exec === "ERROR" && m ? (Number(m[1]) + 15) * 1000 : 0; };

// ---------- the demonstration ----------
// The suite reads these out of this file and checks they are the texts it judges.
const TITLE = "Front brake overhaul";
const CAR = "2016 Skoda Octavia 1.6 TDI estate";
const QUOTE = [
  ["Front brake pads and discs, supply and fit", 120n * MILLI],
  ["Brake fluid change, DOT 4", 20n * MILLI],
  ["Labour: fit front pads and discs and bleed the brakes, 2 hours", 80n * MILLI],
];
const TOTAL = QUOTE.reduce((s, [, p]) => s + p, 0n);
const EXTRA = ["Front wiper blades, pair, supply and fit", 15n * MILLI];
const INVOICE = [
  [1, "Replaced front brake discs and pads", 120n * MILLI],
  [2, "Brake fluid flush and refill, DOT 4", 30n * MILLI],
  [3, "Labour fitting the front pads and discs and bleeding the brakes, 1.5 hours", 60n * MILLI],
  [4, "Fitted new front wiper blades", 15n * MILLI],
  [3, "Replaced cabin filter", 25n * MILLI],
  [3, "Sundries", 10n * MILLI],
];
const REBILL_SAME = "SUNDRIES.";
const BOND = 200n * MILLI, JOB = 3 * 86400;
const lines = (rows) => JSON.stringify(rows.map(([text, price]) => ({ text, price: String(price) })));
const bill = (rows) => JSON.stringify(rows.map(([bills, text, price]) => ({ bills, text, price: String(price) })));

await fundOnce("garage", 1); await fundOnce("customer", 1); await fundOnce("stranger", 1);
if (!st.start) { st.start = {}; for (const k of Object.keys(ROLES)) st.start[k] = String(await balance(acct[k].address)); st.started = new Date().toISOString(); save(); }
console.log(`[${stamp()}] ${Object.keys(ROLES).map((k) => k.toUpperCase().padEnd(9) + " " + st.accounts[k] + "  " + ROLES[k]).join("\n           ")}\n           state ${STATE}`);

// ================================================================ 1
console.log(`\n[${stamp()}] ---- 1: deploy`);
st.contract = st.contract || await deploy("deploy", "garage");
save();
console.log(`      Garage at ${st.contract}`);
{
  const s = await seen("statsEmpty", "stats", []);
  ok("Garage is deployed and holds nothing yet", s.quotes === 0 && s.balance_owed === "0", JSON.stringify(s));
}

// ================================================================ 2
console.log(`\n[${stamp()}] ---- 2: the garage and its bond`);
{
  const r = await call("register", "garage", "register", ["Northgate Motors"]);
  ok("GARAGE registers as Northgate Motors; no value, no model", r.j?.ok === true, `${votes(r)}  ${r.msg.slice(0, 120)}`);
  const d = await call("deposit", "garage", "deposit", [], { value: BOND, watch: ["garage"], expect: { garage: -BOND } });
  ok("GARAGE deposits a 0.2 GEN standing bond; no model runs", d.j?.ok === true && d.j?.bond === String(BOND) && moved(d, "garage", -BOND), votes(d));
}

// ================================================================ 3
console.log(`\n[${stamp()}] ---- 3: the quote, an invoice before acceptance, a short payment, and the acceptance`);
{
  const q = await call("quote", "garage", "quote", [st.accounts.customer, TITLE, CAR, lines(QUOTE), JOB]);
  ok("GARAGE quotes CUSTOMER three lines, 0.22 GEN in all", q.j?.ok === true && q.j?.total === String(TOTAL) && q.j?.lines === 3, `${votes(q)}  ${q.msg.slice(0, 140)}`);
  st.ids.Q = need(q.j?.quote, "the quote id"); save();
  const early = await call("invoiceEarly", "garage", "invoice", [st.ids.Q, bill(INVOICE)]);
  ok(`GARAGE invoices ${st.ids.Q} before it is accepted: refused, no model runs`, refused(early, "has not been accepted"), `${votes(early)}  ${early.msg.slice(0, 120)}`);
  const short = await call("acceptShort", "customer", "accept", [st.ids.Q], { value: 200n * MILLI, watch: ["customer"], expect: { customer: 0n } });
  ok("CUSTOMER accepts paying 0.2 GEN, not the total: refused, and every atto comes back in the same transaction", short.exec !== "ERROR" && short.j?.ok === false && String(short.j?.reason).includes("exactly") && moved(short, "customer", 0n), `${votes(short)}  ${short.msg.slice(0, 140)}`);
  const a = await call("accept", "customer", "accept", [st.ids.Q], { value: TOTAL, watch: ["customer"], expect: { customer: -TOTAL } });
  ok("CUSTOMER accepts paying exactly 0.22 GEN, held in escrow", a.j?.ok === true && a.j?.held === String(TOTAL) && moved(a, "customer", -TOTAL), `${votes(a)}  ${a.msg.slice(0, 140)}`);
}

// ================================================================ 4
console.log(`\n[${stamp()}] ---- 4: an extra line, approved by the customer's own payment`);
{
  const x = await call("requestExtra", "garage", "request_extra", [st.ids.Q, EXTRA[0], String(EXTRA[1])]);
  ok("GARAGE asks for front wiper blades, 0.015 GEN, as line 4", x.j?.ok === true && x.j?.line === 4, `${votes(x)}  ${x.msg.slice(0, 120)}`);
  const y = await call("approveExtra", "customer", "approve_extra", [st.ids.Q, 4], { value: EXTRA[1], watch: ["customer"], expect: { customer: -EXTRA[1] } });
  ok("CUSTOMER approves line 4 by paying 0.015 GEN", y.j?.ok === true && y.j?.held === String(TOTAL + EXTRA[1]) && moved(y, "customer", -EXTRA[1]), `${votes(y)}  ${y.msg.slice(0, 120)}`);
}

// ================================================================ 5
console.log(`\n[${stamp()}] ---- 5: the invoice, judged line by line`);
let mask = "", held = 0n;
{
  const k = await call("invoiceByCustomer", "customer", "invoice", [st.ids.Q, bill(INVOICE)]);
  ok("CUSTOMER tries to invoice the job: refused, only the garage that wrote it invoices", refused(k, "only the garage"), `${votes(k)}  ${k.msg.slice(0, 120)}`);
  const r = await call("invoice", "garage", "invoice", [st.ids.Q, bill(INVOICE)], { watch: ["garage", "customer"], expect: (j) => ({ garage: BigInt(j?.paid || "0"), customer: BigInt(j?.penalty || "0") }) });
  mask = String(r.j?.mask || ""); held = BigInt(r.j?.held || "0");
  ok("GARAGE invoices six lines; one consensus round of two askings: covered x4, not covered, unclear", mask === "CCCCNU", `${votes(r)}  ${mask || r.msg.slice(0, 120)}`);
  ok("and in the same transaction GARAGE is paid 0.215 GEN, the fluid capped at its approved 0.02", r.j?.paid === String(215n * MILLI) && moved(r, "garage", 215n * MILLI), JSON.stringify(r.delta));
  ok("and 0.005 GEN, 20 percent of the cabin filter, moves from GARAGE's bond to CUSTOMER", r.j?.penalty === String(5n * MILLI) && moved(r, "customer", 5n * MILLI), JSON.stringify(r.delta));
}

// ================================================================ 6
console.log(`\n[${stamp()}] ---- 6: a second invoice, the same words re-billed, a stranger, and the settlement`);
{
  const again = await call("invoiceAgain", "garage", "invoice", [st.ids.Q, bill(INVOICE)]);
  ok("GARAGE sends a second invoice: refused", refused(again, "takes no second invoice"), `${votes(again)}  ${again.msg.slice(0, 120)}`);
  const same = await call("rebillSame", "garage", "rebill", [st.ids.Q, JSON.stringify([{ line: 6, text: REBILL_SAME, price: String(10n * MILLI) }])]);
  ok("GARAGE re-bills Sundries as SUNDRIES.: refused by fingerprint, the same words, no model runs", refused(same, "same words"), `${votes(same)}  ${same.msg.slice(0, 120)}`);
  const s = await call("settleByStranger", "stranger", "settle", [st.ids.Q]);
  ok("STRANGER tries to settle the job: refused", refused(s, "only the garage or the customer"), `${votes(s)}  ${s.msg.slice(0, 120)}`);
  const done = await call("settle", "garage", "settle", [st.ids.Q], { watch: ["customer"], expect: (j) => ({ customer: BigInt(j?.refunded || "0") }) });
  ok("GARAGE settles, waiving its re-bill: what was never paid out goes back to CUSTOMER", done.j?.status === "settled" && done.j?.refunded === String(held) && moved(done, "customer", held), `${votes(done)}  ${done.msg.slice(0, 140)}`);
}

// ================================================================ 7
console.log(`\n[${stamp()}] ---- 7: the garage takes its free bond back`);
{
  const free = BigInt((await seen("garageBond", "garage", [st.accounts.garage])).bond || "0");
  const w = await call("withdraw", "garage", "withdraw", [String(free)], { watch: ["garage"], expect: { garage: free } });
  ok("GARAGE withdraws its free bond, 0.2 GEN less the 0.005 penalty", w.j?.ok === true && free === BOND - 5n * MILLI && moved(w, "garage", free), `${votes(w)}  ${w.msg.slice(0, 80)}`);
}

// ================================================================ 8
console.log(`\n[${stamp()}] ---- 8: the views, the code, and the money`);
{
  const q = await seen("quote", "get_quote", [st.ids.Q]);
  ok(`get_quote(${st.ids.Q}): settled, four approved lines, six invoice lines with their verdicts`, q.status === "settled" && q.approved?.length === 4 && q.invoice?.length === 6 && q.held === "0" && q.lock === "0" && q.invoice?.[4]?.verdict === "not_covered", JSON.stringify(q.invoice?.map((b) => b.verdict)));
  ok("the fluid line was paid 0.02 GEN, its approved price, not the 0.03 billed", q.invoice?.[1]?.paid === String(20n * MILLI) && q.invoice?.[1]?.price === String(30n * MILLI), JSON.stringify(q.invoice?.[1]));
  const mine = await seen("quotesOf", "quotes_of", [st.accounts.customer, 0, 20]);
  ok("quotes_of(CUSTOMER): the one job, as customer", mine.total === 1 && mine.rows?.[0]?.role === "customer", JSON.stringify(mine.rows));
  const stats = await seen("stats", "stats", []);
  ok("stats(): one quote, one invoice, four covered, one not covered, one unclear, nothing held", stats.quotes === 1 && stats.invoiced === 1 && stats.covered === 4 && stats.not_covered === 1 && stats.unclear === 1 && stats.balance_owed === "0", JSON.stringify(stats));
  const rules = await seen("rules", "rules", []);
  ok("rules(): the question word for word, two askings, the combine table", String(rules.question).includes("does its APPROVED_LINE cover its INVOICE_LINE") && rules.askings?.length === 2 && String(rules.compared).includes("exact string equality"), Object.keys(rules).join(","));
  ok("the contract's own balance is zero", (await balance(st.contract)) === 0n, String(await balance(st.contract)));

  const bytes = readFileSync(FILE);
  const chain = Buffer.from(String(await rpc("gen_getContractCode", [st.contract])), "base64");
  st.code = { address: st.contract, bytes: chain.length, sha256: sha(chain), file_bytes: bytes.length, file_sha256: sha(bytes), identical: Buffer.compare(chain, bytes) === 0 };
  save();
  ok(`the code deployed at ${st.contract} is byte for byte contracts/garage.py`, st.code.identical, `${chain.length} bytes, sha256 ${st.code.sha256}`);

  st.end = {}; for (const k of Object.keys(ROLES)) st.end[k] = String(await balance(acct[k].address));
  st.ended = new Date().toISOString(); save();
  // what each account should have gained or lost, read off the receipts
  const want = Object.fromEntries(Object.keys(ROLES).map((k) => [k, 0n]));
  for (const id of st.order) {
    const s = st.steps[id], j = jsonOf(s.tries.at(-1)?.msg || "");
    if (!j?.ok) continue;
    if (s.fn === "deposit") want[s.who] -= BigInt(j.deposited);
    if (s.fn === "withdraw") want[s.who] += BigInt(j.returned);
    if (s.fn === "accept") want[s.who] -= BigInt(j.held);
    if (s.fn === "approve_extra") want[s.who] -= EXTRA[1];
    if (s.fn === "invoice" || s.fn === "settle") { want.garage += BigInt(j.paid); want.customer += BigInt(j.penalty) + BigInt(j.refunded); }
  }
  const net = (k) => BigInt(st.end[k]) - BigInt(st.start[k]);
  ok("over the run every account ends exactly where the receipts say: GARAGE 0.21 GEN up, CUSTOMER 0.21 GEN down", Object.keys(want).every((k) => net(k) === want[k]) && want.garage === 210n * MILLI && want.customer === -210n * MILLI && want.stranger === 0n, Object.keys(want).map((k) => k.toUpperCase() + " " + Number(net(k)) / 1e18 + " (receipts " + Number(want[k]) / 1e18 + ")").join("  "));
}

st.checks = { pass, fail }; save();
console.log(`\n${pass} passed, ${fail} failed`);
console.log("Garage:", st.contract);
console.log("transactions:", st.order.reduce((n, id) => n + st.steps[id].tries.length, 0), "in", st.order.length, "steps; sent a second time:", st.order.filter((id) => st.steps[id].tries.length > 1).join(", ") || "none");
console.log("record:", RECORD);
process.exit(fail ? 1 : 0);
