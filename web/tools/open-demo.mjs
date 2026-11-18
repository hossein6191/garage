// Opens the demo on a deployed Garage register, once: reads the demo garage's key from a JSON file,
// funds its account from Studio's faucet, registers it as "Demo Motors" and deposits its standing bond
// (1 GEN), so that GET /api/demo/status on the site says online. Run it by hand after the contract is
// deployed; nothing in the build runs it.
//
//   node tools/open-demo.mjs 0xREGISTER path/to/demo-garage-key.json
//   DRY=1 node tools/open-demo.mjs 0xREGISTER path/to/demo-garage-key.json   # check and print, send nothing
//
// The key file holds the same throwaway Studio test key the site's server holds in DEMO_GARAGE_KEY, as
// {"privateKey": "0x..."} (or "key", "private_key", "DEMO_GARAGE_KEY", keys.garage, or the bare key as a
// JSON string). It is never printed; only the bot's public address is. Each transaction is followed to
// a final status. Needs Node 22.18 or later (it reads lib/*.ts directly).

import { readFileSync } from "node:fs";
import { createAccount, createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress } from "viem";

import { cleanKey, keyProblem } from "../lib/demo-key.ts";
import { DEMO_BOND, DEMO_INVOICE, DEMO_NAME, DEMO_NEEDED, DEMO_QUOTE, DEMO_EXTRA, DEMO_REBILL, DEMO_TITLE, DEMO_CAR } from "../lib/demo-script.ts";

const RPC = "https://studio.genlayer.com/api";
const EXPLORER = "https://explorer-studio.genlayer.com";
const studio = { ...studionet, rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC] } } };
const DRY = process.env.DRY === "1";
const fail = (m) => {
  console.error(m);
  process.exit(2);
};

const [REGISTER = "", KEY_FILE = ""] = process.argv.slice(2).map((s) => s.trim());
if (!/^0x[0-9a-fA-F]{40}$/.test(REGISTER) || !KEY_FILE) fail("usage: node tools/open-demo.mjs 0xREGISTER path/to/key.json");

function keyFrom(file) {
  let data;
  try {
    data = JSON.parse(readFileSync(file, "utf8"));
  } catch {
    fail("the key file could not be read as JSON");
  }
  if (typeof data === "string") return data;
  const o = data && typeof data === "object" ? data : {};
  return o.privateKey ?? o.private_key ?? o.key ?? o.DEMO_GARAGE_KEY ?? o.keys?.garage ?? "";
}
const raw = keyFrom(KEY_FILE);
const problem = keyProblem(raw);
if (problem) fail(`the key file: ${problem}`);
const account = createAccount(cleanKey(raw));
const bot = account.address;

// Every text the bot will ever sign must fit the contract's doors.
const printable = (t) => /^[\x20-\x7e]+$/.test(t);
for (const t of [DEMO_NAME, DEMO_TITLE, DEMO_CAR]) if (!printable(t) || t.length < 3 || t.length > 80) fail(`not a valid title, car or name: ${t}`);
for (const l of [...DEMO_QUOTE, DEMO_EXTRA, ...DEMO_INVOICE, DEMO_REBILL]) if (!printable(l.text) || l.text.length < 3 || l.text.length > 120) fail(`not a valid line: ${l.text}`);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
async function rpc(method, params) {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(RPC, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }) });
      const body = await res.json();
      if (body.error) {
        await sleep(res.status === 429 || body.error.code === -32029 ? 20_000 : 5000);
        continue;
      }
      return body.result;
    } catch {
      await sleep(4000);
    }
  }
  throw new Error(`${method} did not answer`);
}

async function follow(hash) {
  for (let i = 0; i < 300; i++) {
    await sleep(4000);
    const tx = await rpc("eth_getTransactionByHash", [hash]);
    const status = String(tx?.status ?? "");
    if (["FINALIZED", "CANCELED", "UNDETERMINED"].includes(status)) {
      const lr = tx.consensus_data?.leader_receipt;
      const one = Array.isArray(lr) ? lr[0] : lr;
      const text = Buffer.from(one?.result ?? "", "base64").toString("utf8");
      const start = text.indexOf("{");
      try {
        return { status, json: start >= 0 ? JSON.parse(text.slice(start, text.lastIndexOf("}") + 1)) : null };
      } catch {
        return { status, json: null };
      }
    }
  }
  throw new Error(`${hash} was not final within twenty minutes`);
}

const reader = createClient({ chain: studio });
const view = async (fn, args) => {
  for (let i = 0; i < 8; i++) {
    try {
      return JSON.parse(String(await reader.readContract({ address: REGISTER, functionName: fn, args })));
    } catch {
      await sleep(5000);
    }
  }
  throw new Error(`the view ${fn} did not answer`);
};

console.log(`the demo garage is ${bot}, on register ${REGISTER}`);
const g = await view("garage", [bot.toLowerCase()]);
const bond = BigInt(g.bond || "0");
console.log(`registered: ${g.registered ? `yes, as ${g.name}` : "no"}; free bond ${bond} atto; online needs ${DEMO_NEEDED} atto`);
if (DRY) {
  if (!g.registered) console.log(`would register(${JSON.stringify(DEMO_NAME)})`);
  if (bond < DEMO_BOND) console.log(`would deposit() ${DEMO_BOND - bond} atto, bringing the bond to ${DEMO_BOND}`);
  process.exit(0);
}

const client = createClient({ chain: studio, account });
const balance = BigInt((await rpc("eth_getBalance", [bot, "latest"])) || "0x0");
if (balance < 3n * 10n ** 18n) {
  await rpc("sim_fundAccount", { account_address: getAddress(bot), amount: 20e18 });
  console.log("asked Studio's faucet for 20 GEN");
  await sleep(6000);
}
if (!g.registered) {
  const hash = await client.writeContract({ address: REGISTER, functionName: "register", args: [DEMO_NAME], value: 0n });
  const r = await follow(hash);
  if (!r.json?.ok) fail(`register was not taken: ${r.status} ${JSON.stringify(r.json)} ${EXPLORER}/tx/${hash}`);
  console.log(`registered as ${DEMO_NAME} ${EXPLORER}/tx/${hash}`);
}
if (bond < DEMO_BOND) {
  const hash = await client.writeContract({ address: REGISTER, functionName: "deposit", args: [], value: DEMO_BOND - bond });
  const r = await follow(hash);
  if (!r.json?.ok) fail(`deposit was not taken: ${r.status} ${JSON.stringify(r.json)} ${EXPLORER}/tx/${hash}`);
  console.log(`deposited ${DEMO_BOND - bond} atto; bond ${r.json.bond} ${EXPLORER}/tx/${hash}`);
} else console.log("bond already at the standing amount; no deposit");
console.log("done. Set DEMO_GARAGE_KEY on the site; GET /api/demo/status should then say online.");
