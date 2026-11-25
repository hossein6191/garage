// The demo garage, server side only (imported by app/api/demo/*). It holds a throwaway Studio test key
// from the DEMO_GARAGE_KEY environment variable and signs exactly five kinds of call with it, each one
// only when the chain says it is the garage's turn (lib/demo-script.ts):
//
//   quote()          the demonstration quote, naming the visitor's address as customer, when that
//                    visitor has no demo job in progress (and a client address has not asked too often);
//   request_extra()  the wiper blades, once, on its own accepted demo quote;
//   invoice()        the scripted invoice, six lines, or five when the extra was not approved;
//   rebill()         "Sundries" in new words, once, while the re-bill window is open;
//   settle()         its own invoiced demo quote, waiving the re-bill.
//
// Nothing a visitor types is ever signed: the routes take an address or a quote id. The key is never
// logged, never returned and never written anywhere; an answer names the bot's public address at most.

import { createAccount, createClient } from "genlayer-js";
import { getAddress, type Address } from "viem";

import { balanceOf, contractAddress, isMock, readGarage, readQuote, readQuotesOfWindow, studio } from "./chain";
import { cleanKey, keyProblem } from "./demo-key";
import { quoteFees } from "./fees";
import { DEMO_LIMITS, createLimiter } from "./demo-limit";
import { DEMO_EXTRA, DEMO_NAME, DEMO_NEEDED, demoTurn, invoiceJson, openDemoQuote, quoteArgs, rebillJson } from "./demo-script";
import { big } from "./format";
import { decodeTx, isDone, rpc, sleep, type RawTx } from "./rpc";
import type { DemoMove, DemoStatus, Quote } from "./types";

type Account = ReturnType<typeof createAccount>;
let account: { key: string; value: Account } | null = null;

const KEY_VAR = "DEMO_GARAGE_KEY";

function demoAccount(): Account | null {
  const raw = process.env[KEY_VAR];
  if (keyProblem(raw)) return null;
  const key = cleanKey(raw);
  if (!account || account.key !== key) account = { key, value: createAccount(key as `0x${string}`) };
  return account.value;
}

export const MOCK_REASON = "in the demo build the demo garage answers in the browser";
export const NO_CONTRACT_REASON = "the contract is not deployed yet";
export const RPC_DOWN = "Studio's RPC did not answer; try again in a minute";
export const NO_BALANCE = "the demo garage's account holds no GEN and Studio's faucet did not top it up";
export const NOT_REGISTERED = "the demo garage is not registered on this contract yet (tools/open-demo.mjs registers it)";
export const LOW_BOND = "the demo garage's free bond is below what it keeps for a few invoices (tools/open-demo.mjs tops it up)";

/** The bot signs from its own balance; Studio's faucet refills it when it holds less than a GEN. */
async function ensureBalance(bot: string): Promise<boolean> {
  const have = await balanceOf(bot);
  if (have >= 10n ** 18n) return true;
  try {
    await rpc("sim_fundAccount", { account_address: getAddress(bot), amount: 20e18 });
  } catch {
    return have > 0n;
  }
  for (let i = 0; i < 6; i++) {
    await sleep(2000);
    try {
      if ((await balanceOf(bot)) > have) return true;
    } catch {
      /* one dropped read; ask again */
    }
  }
  return have > 0n;
}

/** Whether the demo garage can act now, and exactly why not. */
export async function demoStatusNow(): Promise<DemoStatus> {
  const off = (reason: string, bot = "", extra: Partial<DemoStatus> = {}): DemoStatus => ({ online: false, reason, bot, name: "", bondAtto: "0", neededAtto: DEMO_NEEDED.toString(), ...extra });
  if (isMock) return off(MOCK_REASON);
  const problem = keyProblem(process.env[KEY_VAR]);
  if (problem) return off(problem);
  const bot = demoAccount()!.address.toLowerCase();
  if (!contractAddress()) return off(NO_CONTRACT_REASON, bot);
  try {
    if (!(await ensureBalance(bot))) return off(NO_BALANCE, bot);
    const g = (await readGarage(bot, { fresh: true })).data;
    if (!g.registered) return off(NOT_REGISTERED, bot);
    const extra = { name: g.name, bondAtto: g.bondAtto };
    if (big(g.bondAtto) < DEMO_NEEDED) return off(LOW_BOND, bot, extra);
    return { online: true, reason: "", bot, name: g.name || DEMO_NAME, bondAtto: g.bondAtto, neededAtto: DEMO_NEEDED.toString() };
  } catch {
    return off(RPC_DOWN, bot);
  }
}

const limiter = createLimiter(DEMO_LIMITS);
/** Quotes per client address per day: a few, so one visitor cannot spend the bot's bond. */
const QUOTES_PER_DAY = 4;
const quotesBy = new Map<string, number[]>();

const inflight = new Map<string, { hash: string; at: number }>();

async function stillMoving(slot: string): Promise<boolean> {
  const last = inflight.get(slot);
  if (!last) return false;
  if (Date.now() - last.at > DEMO_LIMITS.sentHoldMs) {
    inflight.delete(slot);
    return false;
  }
  try {
    const tx = await rpc<RawTx | null>("eth_getTransactionByHash", [last.hash]);
    if (tx && isDone(decodeTx(tx))) {
      inflight.delete(slot);
      return false;
    }
  } catch {
    /* unreadable now: still moving, as far as anyone can tell */
  }
  return true;
}

// One signature at a time: two calls signed at once would ask for the same nonce.
let queue: Promise<unknown> = Promise.resolve();
function serial<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job, job);
  queue = run.catch(() => undefined);
  return run;
}

export type ServerAnswer = { status: number; body: { ok: true; hash: string } | { ok: false; reason: string; retryAfter?: number } };

const no = (status: number, reason: string, retryAfter?: number): ServerAnswer => ({ status, body: retryAfter ? { ok: false, reason, retryAfter } : { ok: false, reason } });

async function sign(slot: string, functionName: string, args: (string | number)[]): Promise<ServerAnswer> {
  const a = demoAccount()!;
  try {
    const hash = await serial(async () => {
      const client = createClient({ chain: studio, account: a });
      // Studio v0.123: every write carries the fees quoted for it (lib/fees.ts), paid from the bot's balance.
      const fees = await quoteFees(client);
      return client.writeContract({ address: contractAddress() as Address, functionName, args, value: 0n, fees });
    });
    if (typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) throw new Error("no hash");
    inflight.set(slot, { hash, at: Date.now() });
    return { status: 200, body: { ok: true, hash } };
  } catch {
    // Nothing of the error goes out: it is the network's, and it is not the visitor's business.
    return no(502, "Studio did not take the demo garage's call; try again in a minute");
  }
}

async function ready(slot: string): Promise<{ bot: string } | ServerAnswer> {
  const s = await demoStatusNow();
  if (!s.online) return no(503, "the demo garage is offline: " + s.reason);
  const turn = limiter.attempt(slot, Date.now());
  if (!turn.ok) return no(429, `the demo garage was asked about this a moment ago; try again in ${turn.retryAfter} s`, turn.retryAfter);
  if (await stillMoving(slot)) return no(409, "the demo garage is still waiting for its last call on this job to be final; try again once it is");
  return { bot: s.bot };
}

/** POST /api/demo/quote: the demonstration quote for one visitor's address. */
export async function sendQuote(customer: string, client: string): Promise<ServerAnswer> {
  const r = await ready("quote:" + customer);
  if ("status" in r) return r;
  if (customer === r.bot) return no(409, "the demo garage does not quote itself; connect another wallet");
  const day = Date.now() - 86_400_000;
  const mine = (quotesBy.get(client) ?? []).filter((t) => t > day);
  if (mine.length >= QUOTES_PER_DAY) return no(429, `this connection has asked for ${QUOTES_PER_DAY} demo quotes today, the most it may; try again tomorrow`);
  try {
    const rows = (await readQuotesOfWindow(customer, 1, { fresh: true })).data.rows;
    const open = openDemoQuote(rows, r.bot);
    if (open) return no(409, `you already have a demo job in progress, ${open.id}; finish it first`);
  } catch {
    return no(502, "could not read your jobs from Studio; try again in a minute");
  }
  quotesBy.set(client, [...mine, Date.now()]);
  if (quotesBy.size > 5000) for (const [k, v] of quotesBy) if (!v.some((t) => t > day)) quotesBy.delete(k);
  return sign("quote:" + customer, "quote", quoteArgs(customer));
}

/** POST /api/demo/{extra,invoice,rebill,settle}: the garage's next move on one of its demo quotes. */
export async function sendMove(move: Exclude<DemoMove, "quote">, id: string): Promise<ServerAnswer> {
  const r = await ready(id);
  if ("status" in r) return r;
  let q: Quote | null;
  try {
    q = (await readQuote(id, { fresh: true })).data;
  } catch {
    return no(502, "could not read the job from Studio; try again in a minute");
  }
  const turn = demoTurn(q, r.bot);
  if (!q || !turn.moves.includes(move)) return no(409, turn.why || `it is not the demo garage's turn to ${move} on ${id}`);
  if (move === "extra") return sign(id, "request_extra", [id, DEMO_EXTRA.text, DEMO_EXTRA.price.toString()]);
  if (move === "invoice") return sign(id, "invoice", [id, invoiceJson(q)]);
  if (move === "rebill") return sign(id, "rebill", [id, rebillJson(q)]);
  return sign(id, "settle", [id]);
}
