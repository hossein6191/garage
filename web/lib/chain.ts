// Chain access for Garage: the one file that knows how the site talks to the register. Method names
// and argument orders are in lib/calls.ts, the JSON shapes in lib/parse.ts; lib/chain-mock.ts stands in
// for the contract in mock mode and answers in the contract's own JSON.
//
// Reads go through readContract (gen_call) with the retry policy in lib/rpc.ts: Studio answers
// "Contract not found" for a healthy contract for about a minute after a deploy. A failed read is never
// "no data" and never proof that a write failed. Studio allows 30 gen_call a minute from one browser,
// so every view answer is cached for 30 s and invalidateReads() drops the cache once a transaction is
// final.

import * as mock from "./chain-mock";
import { createClient } from "genlayer-js";
import { studionet } from "genlayer-js/chains";
import { getAddress, type Address } from "viem";
import { notify } from "./browser-store";
import { quoteFees } from "./fees";
import { contractAddress } from "./config";
import { sentence } from "./format";
import { mapGarage, mapPage, mapQuote, mapStats, num, parseView, str, asRow } from "./parse";
import { RATE_LIMITED, createReadCache, decodeTx, isMissingMethodError, noteFailure, rpc, sleep, waitForCooldown, withRetry, type RawTx } from "./rpc";
import type { Arg, Call, DemoAnswer, DemoMove, DemoStatus, GarageInfo, Paged, Quote, QuoteRow, ReadResult, Rules, Stats, TxStatus } from "./types";
import { chainName, getChainId, getSigner } from "./wallet";
import { RULES_COPY } from "./contract-rules";

export { RATE_LIMITED, cooldownRemainingMs } from "./rpc";
export { contractAddress };

export const CHAIN_ID = 61999;
export const RPC_URL = "https://studio.genlayer.com/api";
export const EXPLORER_URL = "https://explorer-studio.genlayer.com";

export const isMock = process.env.NEXT_PUBLIC_MOCK === "1";

export const NETWORK_ERROR = "could not reach the network";
export const NO_CONTRACT = "the contract is not deployed yet";
export const FAUCET_REFUSED = "Studio refused the faucet request (it allows 30 requests a minute from one browser). Try again in a minute.";

export const hasContract = (): boolean => isMock || !!contractAddress();
export const contractInUse = (): string => (isMock ? mock.MOCK_CONTRACT : contractAddress());

export const studio = {
  ...studionet,
  rpcUrls: { ...studionet.rpcUrls, default: { http: [RPC_URL] } },
  blockExplorers: { default: { name: "GenLayer Studio Explorer", url: EXPLORER_URL } },
};

const reader = () => createClient({ chain: studio });

export const READ_TTL_MS = 30_000;
const onServer = typeof window === "undefined";
const views = createReadCache<unknown>(onServer ? 0 : READ_TTL_MS);

let moved = 0;
export const chainVersion = (): number => moved;

export const invalidateReads = () => {
  views.clear();
  moved++;
  notify();
};

async function view(fn: string, args: Arg[] = [], opts: { fresh?: boolean } = {}): Promise<unknown> {
  if (isMock) return parseView(await mock.view(fn, args));
  const address = contractAddress();
  if (!address) throw new Error(NO_CONTRACT);
  const key = `${address.toLowerCase()}|${fn}|${JSON.stringify(args, (_k, v) => (typeof v === "bigint" ? v.toString() : v))}`;
  if (opts.fresh) views.forget(key);
  try {
    const raw = await views.get(key, () =>
      withRetry(() => reader().readContract({ address: address as Address, functionName: fn, args: args as never }), { bucket: "gen", giveUp: isMissingMethodError }),
    );
    return parseView(raw);
  } catch (e) {
    if (e instanceof Error && e.message === RATE_LIMITED) throw e;
    throw new Error(NETWORK_ERROR);
  }
}

const SOURCE: ReadResult<unknown>["source"] = isMock ? "mock" : "chain";
const result = <T>(data: T): ReadResult<T> => ({ data, source: SOURCE });
type Fresh = { fresh?: boolean };

export const PAGE = 20;
const pageArgs = (offset: number, limit: number): [number, number] => [Math.max(0, Math.trunc(offset)), Math.max(1, Math.min(PAGE, Math.trunc(limit)))];

export async function readQuote(id: string, opts: Fresh = {}): Promise<ReadResult<Quote | null>> {
  return result(mapQuote(await view("get_quote", [id], opts)));
}

export async function readQuotes(offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<QuoteRow>>> {
  return result(mapPage(await view("quotes", pageArgs(offset, limit), opts)));
}

export async function readQuotesOf(address: string, offset = 0, limit = PAGE, opts: Fresh = {}): Promise<ReadResult<Paged<QuoteRow>>> {
  return result(mapPage(await view("quotes_of", [address.toLowerCase(), ...pageArgs(offset, limit)], opts)));
}

/** The newest rows first: the last page, then the pages before it, up to `maxPages`. */
async function newestFirst(read: (offset: number) => Promise<Paged<QuoteRow>>, maxPages: number): Promise<{ total: number; rows: QuoteRow[]; partial: boolean }> {
  const first = await read(0);
  const pages = Math.ceil(first.total / PAGE);
  const rows = [...first.rows];
  for (let p = pages - 1, k = 1; p >= 1 && k < maxPages; p--, k++) rows.push(...(await read(p * PAGE)).rows);
  const unique = new Map(rows.map((r) => [r.id, r]));
  return { total: first.total, rows: [...unique.values()].sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1))), partial: pages > maxPages };
}

export async function readQuotesWindow(maxPages = 3, opts: Fresh = {}) {
  return result(await newestFirst(async (o) => (await readQuotes(o, PAGE, opts)).data, maxPages));
}

export async function readQuotesOfWindow(address: string, maxPages = 3, opts: Fresh = {}) {
  return result(await newestFirst(async (o) => (await readQuotesOf(address, o, PAGE, opts)).data, maxPages));
}

export async function readGarage(address: string, opts: Fresh = {}): Promise<ReadResult<GarageInfo>> {
  return result(mapGarage(await view("garage", [address.toLowerCase()], opts)));
}

export async function readStats(opts: Fresh = {}): Promise<ReadResult<Stats>> {
  return result(mapStats(await view("stats", [], opts)));
}

/** rules() from the register; in mock mode, the copy in lib/contract-rules.ts. */
export async function readRules(): Promise<ReadResult<Rules>> {
  if (isMock) return result(RULES_COPY);
  return result(asRow(await view("rules", [])));
}

// ---- writes ----------------------------------------------------------------------------------------

const WRONG_CHAIN = (chainId: number | null) => `Your wallet is on ${chainName(chainId)}. Switch it to GenLayer Studio (chain 61999) before signing.`;

export async function write(call: Call): Promise<string> {
  if (isMock) return mock.write(call);
  const address = contractAddress();
  if (!address) throw new Error("The contract is not deployed yet, so there is nothing to sign.");
  const signer = getSigner();
  if (!signer) throw new Error("Connect a wallet first.");
  const chainId = await getChainId(signer.provider);
  if (chainId !== CHAIN_ID) throw new Error(WRONG_CHAIN(chainId));
  const client = createClient({ chain: studio, account: signer.address as Address, provider: signer.provider });
  // Studio v0.123: the fee quote goes with the call (lib/fees.ts); the wallet shows it on top of any value.
  const fees = await quoteFees(client);
  const hash = await client.writeContract({ address: address as Address, functionName: call.fn, args: call.args as never, value: call.value ?? 0n, fees });
  if (typeof hash !== "string" || !hash.startsWith("0x")) throw new Error("The wallet returned no transaction hash.");
  return hash;
}

// ---- outcomes ------------------------------------------------------------------------------------

export const stored = (s: TxStatus | null): s is TxStatus => !!s && !s.undetermined && s.applied !== false && s.status !== "CANCELED";

function raisedSentence(s: TxStatus): string {
  const m = /\[(?:EXPECTED|TRANSIENT|LLM_ERROR)\]\s*([^"}\n]+)/.exec(s.message || "");
  return m ? sentence(m[1]) : "";
}

export function refusalReason(s: TxStatus | null): string {
  if (!s) return "";
  const r = s.result;
  if (r && r.ok === false) return sentence(str(r.reason));
  if (s.exec === "ERROR" && !s.undetermined) return raisedSentence(s) || sentence(s.message || "");
  return "";
}

export function failureOf(s: TxStatus | null): string {
  if (!s) return "";
  if (s.undetermined) return "The validators did not reach a majority, so nothing was stored and no money moved. Sending the same call again is safe.";
  if (s.status === "CANCELED") return "The network cancelled the transaction. Nothing was stored.";
  const reason = refusalReason(s);
  if (reason) return reason;
  if (s.applied === false) return "The validators did not accept this transaction. Nothing was stored.";
  return "";
}

export function movesMoney(s: TxStatus): boolean {
  const r = s.result;
  if (!r) return false;
  if (r.ok === false) return str(r.returned, "0") !== "0";
  return ["paid", "penalty", "refunded", "returned"].some((k) => !["", "0"].includes(str(r[k], "0")));
}

// ---- the demo garage ------------------------------------------------------------------------------

let demoCache: { at: number; value: DemoStatus } | null = null;

export async function readDemoStatus(opts: Fresh = {}): Promise<DemoStatus> {
  if (isMock) return mock.demoStatus();
  if (!opts.fresh && demoCache && Date.now() - demoCache.at < 20_000) return demoCache.value;
  try {
    const res = await fetch("/api/demo/status", { cache: "no-store" });
    const b = (await res.json()) as Record<string, unknown>;
    const value: DemoStatus = {
      online: b.online === true,
      reason: str(b.reason),
      bot: /^0x[0-9a-f]{40}$/.test(str(b.bot).toLowerCase()) ? str(b.bot).toLowerCase() : "",
      name: str(b.name),
      bondAtto: /^\d+$/.test(str(b.bondAtto)) ? str(b.bondAtto) : "0",
      neededAtto: /^\d+$/.test(str(b.neededAtto)) ? str(b.neededAtto) : "0",
    };
    demoCache = { at: Date.now(), value };
    return value;
  } catch {
    return { online: false, reason: "the site's server did not answer", bot: "", name: "", bondAtto: "0", neededAtto: "0" };
  }
}

/** Asks the demo garage to make one move: on a quote, or (for "quote") for a customer address. */
export async function askDemo(move: DemoMove, target: string): Promise<DemoAnswer> {
  demoCache = null;
  if (isMock) {
    const a = await mock.demoMove(move, target);
    return a.ok ? a : { ok: false, reason: sentence(a.reason) };
  }
  try {
    const body = move === "quote" ? { customer: target } : { quote: target };
    const res = await fetch(`/api/demo/${move}`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const a = (await res.json()) as Record<string, unknown>;
    if (a.ok === true && typeof a.hash === "string" && /^0x[0-9a-fA-F]{64}$/.test(a.hash)) return { ok: true, hash: a.hash };
    return { ok: false, reason: sentence(str(a.reason, "the demo garage did not answer")), retryAfter: num(a.retryAfter) || undefined };
  } catch {
    return { ok: false, reason: "The site's server did not answer. Try again in a minute." };
  }
}

// ---- transactions, balances, the faucet -------------------------------------------------------------

export async function txStatus(hash: string): Promise<TxStatus> {
  if (isMock) return mock.txStatus(hash);
  const tx = await withRetry(() => rpc<RawTx | null>("eth_getTransactionByHash", [hash]), { tries: 2, bucket: "eth", ownBudget: true });
  return decodeTx(tx);
}

export async function balanceOf(address: string): Promise<bigint> {
  if (isMock) return mock.balanceOf(address);
  const hex = await withRetry(() => rpc<string>("eth_getBalance", [address, "latest"]), { tries: 3, bucket: "eth", ownBudget: true });
  return BigInt(hex || "0x0");
}

export async function faucet(address: string, opts: { stillWanted?: () => boolean } = {}): Promise<bigint> {
  if (isMock) return mock.faucet(address);
  let account: string;
  try {
    account = getAddress(address);
  } catch {
    throw new Error("That is not a valid 0x address, so the faucet was not asked.");
  }
  const before = await balanceOf(account).catch(() => {
    throw new Error("Could not read this wallet's balance from Studio, so the faucet was not asked. Try again in a few seconds.");
  });
  let sent = false;
  for (let i = 0; i < 3 && !sent; i++) {
    await waitForCooldown("gen");
    try {
      // `amount` is wei as a JS number; Studio credits only a checksummed address.
      await rpc("sim_fundAccount", { account_address: account, amount: 10e18 });
      sent = true;
    } catch (e) {
      noteFailure(e, Date.now(), "gen");
      if (i === 2) throw new Error(FAUCET_REFUSED);
      await sleep(10_000);
    }
  }
  const started = Date.now();
  while (Date.now() - started < 60_000) {
    await sleep(2000);
    if (opts.stillWanted && !opts.stillWanted()) throw new Error("The faucet wait ended: the wallet switched accounts.");
    try {
      const now = await balanceOf(account);
      if (now !== before) return now;
    } catch {
      /* a dropped poll is not a failed faucet */
    }
  }
  throw new Error("The faucet did not credit the account within 60 s. Try again.");
}

export const txUrl = (hash: string) => `${EXPLORER_URL}/tx/${hash}`;
export const addressUrl = (address: string) => `${EXPLORER_URL}/address/${address}`;
export const jobPath = (id: string) => `/job/${id}`;
