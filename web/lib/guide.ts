// What a visitor is told whenever they wait, in five plain lines: what is happening and who it waits
// for, how long (or a countdown), whether anything is needed from them now, whether they can leave and
// where things will be, and where the money is. One set of words per state of a job, for each of the
// three people who can be looking at it (the customer, the garage, anyone else), and for every wait the
// site itself causes: a wallet prompt, a transaction on its way, the validators judging, the demo garage
// at work.
//
// Pure, with no React: the quote, the viewer's role and the clock in, the words out. The waiting panel
// (components/wait-panel.tsx) renders a guide; tests/unit/guide.test.mjs runs every state for every
// role. Nothing here may promise what contracts/garage.py does not do.

import { big, gen, span, when } from "./format.ts";
import { FEE_NOTE } from "./fees.ts";
import { maskSummary } from "./verdict.ts";
import type { DemoMove, Quote, WriteFn } from "./types.ts";

export type Role = "customer" | "garage" | "visitor";
export const ROLES: Role[] = ["customer", "garage", "visitor"];

export type JobState = "quoted" | "lapsed" | "working" | "extra_pending" | "overdue" | "rebill_open" | "rebill_closed" | "settled" | "reclaimed";
export const JOB_STATES: JobState[] = ["quoted", "lapsed", "working", "extra_pending", "overdue", "rebill_open", "rebill_closed", "settled", "reclaimed"];

export type GuideTone = "busy" | "clock" | "act" | "done";

export type Guide = {
  id: string;
  tone: GuideTone;
  kicker: string;
  /** 1. what is happening and who it waits for */
  now: string;
  /** 2. how long, or the exact time */
  time: string;
  /** 3. what is needed from the viewer now */
  need: string;
  mustAct: boolean;
  /** 4. whether the viewer can leave, and where things will be */
  leave: string;
  canLeave: boolean;
  /** 5. where the money is right now */
  money: string;
  /** seconds until the next thing happens on the contract's clock */
  left?: number;
  leftLabel?: string;
};

export const roleOf = (q: Pick<Quote, "garage" | "customer">, me: string): Role => {
  const m = me.toLowerCase();
  if (m && m === q.customer) return "customer";
  if (m && m === q.garage) return "garage";
  return "visitor";
};

/** The state a job is in, as somebody waiting on it sees it. `now` is the contract's clock. */
export function jobState(q: Quote, now: number): JobState {
  if (q.status === "quoted") return q.acceptBy && now >= q.acceptBy ? "lapsed" : "quoted";
  if (q.status === "accepted") {
    if (q.invoiceBy && now >= q.invoiceBy) return "overdue";
    return q.approved.some((a) => a.kind === "extra" && a.status === "pending") ? "extra_pending" : "working";
  }
  if (q.status === "invoiced") return q.rebillBy && now >= q.rebillBy ? "rebill_closed" : "rebill_open";
  return q.status;
}

const LEAVE_OK = "Yes. The job card is kept on chain; it is under My jobs when you come back.";

function heldLine(q: Quote): string {
  return big(q.heldAtto) > 0n ? `${gen(q.heldAtto)} is held by the contract, not by the garage.` : "The contract holds nothing for this job.";
}

/** The waiting panel of a job at rest, for one viewer. */
export function jobGuide(q: Quote, role: Role, now: number, opts: { demo?: boolean } = {}): Guide {
  const s = jobState(q, now);
  const base = { id: `${s}:${role}`, canLeave: true, leave: LEAVE_OK };
  const left = (t: number) => (t > now ? t - now : 0);
  const pendingExtra = q.approved.find((a) => a.kind === "extra" && a.status === "pending");
  switch (s) {
    case "quoted":
      return {
        ...base,
        tone: role === "customer" ? "act" : "clock",
        kicker: "Quote written",
        now: role === "customer" ? "The garage has written you a quote. It waits for you." : "The quote waits for the customer to accept it.",
        time: `It can be accepted until ${when(q.acceptBy)}, ${span(left(q.acceptBy))} from now.`,
        need: role === "customer" ? `Read the lines. Accept by paying exactly ${gen(q.totalAtto)}, or do nothing and it lapses.` : "Nothing. Only the customer named on the quote can accept it.",
        mustAct: role === "customer",
        money: "Nothing has moved. The customer pays only by accepting.",
        left: left(q.acceptBy),
        leftLabel: "to accept",
      };
    case "lapsed":
      return { ...base, tone: "done", kicker: "Lapsed", now: "Nobody accepted this quote in its seven days. It can no longer be accepted.", time: "It is over.", need: "Nothing.", mustAct: false, money: "Nothing was ever paid." };
    case "working":
    case "extra_pending": {
      const extraText = pendingExtra ? `"${pendingExtra.text}" for ${gen(pendingExtra.priceAtto)}` : "";
      const customerNeed = pendingExtra
        ? `The garage asks for an extra line, ${extraText}. Approve it by paying exactly that, or leave it: an extra you do not approve is never billed.`
        : opts.demo
          ? "Nothing. In the demo, press the next step to have the garage carry on."
          : "Nothing. The garage invoices when the work is done.";
      return {
        ...base,
        tone: role === "customer" && pendingExtra ? "act" : "clock",
        kicker: pendingExtra ? "Extra asked for" : "Job on",
        now: pendingExtra ? (role === "customer" ? "The garage asks you to approve an extra line." : "The extra waits for the customer's approval.") : "The job is on. The garage invoices next.",
        time: `The invoice is due by ${when(q.invoiceBy)}, ${span(left(q.invoiceBy))} from now. If none comes, the customer takes everything back.`,
        need: role === "customer" ? customerNeed : role === "garage" ? "Invoice before the deadline. Every line is judged against the line it bills." : "Nothing; this is between the garage and its customer.",
        mustAct: role === "customer" && !!pendingExtra,
        money: `${heldLine(q)} It moves only when the validators judge the invoice.`,
        left: left(q.invoiceBy),
        leftLabel: "to invoice",
      };
    }
    case "overdue":
      return {
        ...base,
        tone: role === "customer" ? "act" : "clock",
        kicker: "No invoice",
        now: "The garage did not invoice by the deadline.",
        time: `The deadline passed at ${when(q.invoiceBy)}.`,
        need: role === "customer" ? `Reclaim the escrow: all ${gen(q.heldAtto)} comes back to you in one transaction.` : "Nothing. Only the customer can reclaim.",
        mustAct: role === "customer",
        money: heldLine(q),
      };
    case "rebill_open":
      return {
        ...base,
        tone: "clock",
        kicker: "Judged, one line open",
        now: `The validators judged the invoice: ${maskSummary(q.mask)}. An unclear line waits.`,
        time: `The garage may re-bill it once until ${when(q.rebillBy)}, ${span(left(q.rebillBy))} from now. Then the customer may settle.`,
        need:
          role === "customer"
            ? opts.demo
              ? "Nothing yet. In the demo you may ask the garage to re-bill the unclear line or to settle now."
              : "Nothing yet. Settle once the window closes, or wait for the garage."
            : role === "garage"
              ? "Re-bill the unclear line once, in other words and at no higher price, or settle now."
              : "Nothing.",
        mustAct: false,
        money: `Paid already: ${gen(q.paidAtto)} to the garage, ${gen(q.penaltiesAtto)} from its bond to the customer. ${heldLine(q)} It goes to the customer at settlement, less whatever a covered re-bill earns.`,
        left: left(q.rebillBy),
        leftLabel: "re-bill window",
      };
    case "rebill_closed":
      return {
        ...base,
        tone: role === "customer" ? "act" : "clock",
        kicker: "Ready to settle",
        now: "The re-bill window has closed. The job waits to be settled.",
        time: `It closed at ${when(q.rebillBy)}.`,
        need: role === "customer" ? `Settle: the ${gen(q.heldAtto)} still held comes back to you.` : role === "garage" ? "Settle; the bond locked behind the unclear line comes back to you." : "Nothing.",
        mustAct: role !== "visitor",
        money: heldLine(q),
      };
    case "settled":
      return {
        ...base,
        id: `settled:${role}`,
        tone: "done",
        kicker: "Settled",
        now: q.mask ? `Settled. The invoice was judged ${maskSummary(q.mask)}.` : "Settled.",
        time: `Closed ${when(q.closedAt)}.`,
        need: "Nothing. Every transfer is made.",
        mustAct: false,
        leave: "Yes. This job card stays as it is, on chain and under My jobs.",
        money: `${gen(q.paidAtto)} went to the garage; ${gen(q.penaltiesAtto)} from the garage's bond and ${gen(q.refundedAtto)} of escrow went back to the customer. The contract holds nothing for it.`,
      };
    case "reclaimed":
      return { ...base, tone: "done", kicker: "Reclaimed", now: "No invoice came, so the customer took the escrow back.", time: `Closed ${when(q.closedAt)}.`, need: "Nothing.", mustAct: false, money: `${gen(q.refundedAtto)} went back to the customer. The garage was paid nothing.` };
  }
}

const JUDGED: WriteFn[] = ["invoice", "rebill"];
export const isJudged = (fn: WriteFn): boolean => JUDGED.includes(fn);

const WHAT: Record<WriteFn, string> = {
  register: "registering a garage",
  deposit: "a deposit to the garage's bond",
  withdraw: "a withdrawal of free bond",
  quote: "a quote",
  accept: "your acceptance of the quote",
  request_extra: "a request for an extra line",
  approve_extra: "your approval of the extra line",
  invoice: "the invoice",
  rebill: "the re-bill",
  settle: "the settlement",
  reclaim: "your reclaim of the escrow",
};

/** The wallet prompt: the visitor is the one being waited for. */
export function signGuide(fn: WriteFn, valueAtto: bigint = 0n): Guide {
  return {
    id: `sign:${fn}`,
    tone: "act",
    kicker: "Your wallet",
    now: `Your wallet is asking you to sign ${WHAT[fn]}.`,
    time: "Until you answer it.",
    need: valueAtto > 0n
      ? `Check that the wallet shows ${gen(valueAtto)} plus the small network fee, then sign. Rejecting sends nothing.`
      : "Sign or reject in the wallet. Rejecting sends nothing.",
    mustAct: true,
    leave: "Not yet: the request is open in your wallet.",
    canLeave: false,
    money:
      (valueAtto > 0n
        ? `${gen(valueAtto)} leaves your wallet only once you sign; a refused payment comes back in the same transaction. `
        : "Nothing but the fee moves by signing this. ") + FEE_NOTE,
  };
}

/** A transaction the visitor sent, on its way through consensus. */
export function sendingGuide(fn: WriteFn, valueAtto: bigint = 0n): Guide {
  if (isJudged(fn))
    return {
      id: `sending:${fn}`,
      tone: "busy",
      kicker: "Validators reading",
      now: "Validators are reading each invoice line against the line it bills.",
      time: "1 to 5 minutes. Each validator asks its model twice, in two orders, and they must agree exactly.",
      need: "Nothing.",
      mustAct: false,
      leave: "Yes. The verdict is written on the job card; come back under My jobs.",
      canLeave: true,
      money: "The escrow is still held by the contract and moves only when the validators agree.",
    };
  const moving =
    fn === "accept" || fn === "approve_extra"
      ? `${gen(valueAtto)} is on its way into the contract's escrow, not to the garage. If the call is refused, it comes back in the same transaction.`
      : fn === "settle" || fn === "reclaim"
        ? "The money still held moves the moment this is final; it lands a few seconds later."
        : fn === "deposit"
          ? `${gen(valueAtto)} is on its way into the garage's bond.`
          : "Nothing moves until the network takes this call.";
  return {
    id: `sending:${fn}`,
    tone: "busy",
    kicker: "On its way",
    now: `The network is taking ${WHAT[fn]}.`,
    time: "Usually under a minute; no model runs for this call.",
    need: "Nothing.",
    mustAct: false,
    leave: "Yes. The result is written on the job card.",
    canLeave: true,
    money: moving,
  };
}

/** The demo garage at work on the visitor's job. */
export function demoGuide(move: DemoMove | "asking"): Guide {
  const common = { mustAct: false, canLeave: true, need: "Nothing.", leave: LEAVE_OK };
  switch (move) {
    case "asking":
      return { ...common, id: "demo:asking", tone: "busy", kicker: "Demo Motors", now: "Asking the demo garage to make its move.", time: "A few seconds.", leave: "Better to wait these few seconds.", canLeave: false, money: "Nothing moves by asking." };
    case "quote":
      return { ...common, id: "demo:quote", tone: "busy", kicker: "Demo Motors", now: "Demo Motors is writing your quote on chain.", time: "About a minute.", money: "No money has moved. You pay only if you accept.", leave: "Yes. The quote will be under My jobs." };
    case "extra":
      return { ...common, id: "demo:extra", tone: "busy", kicker: "Demo Motors", now: "Demo Motors is asking for an extra line on chain: front wiper blades.", time: "About a minute.", money: "Your escrow is held by the contract. The extra costs you something only if you approve it." };
    case "invoice":
      return { ...common, id: "demo:invoice", tone: "busy", kicker: "Validators reading", now: "Demo Motors sent its invoice. Validators are reading each line against the line you approved.", time: "1 to 5 minutes.", money: "Your money is still held by the contract and moves only when they agree." };
    case "rebill":
      return { ...common, id: "demo:rebill", tone: "busy", kicker: "Validators reading", now: "Demo Motors re-billed the unclear line in other words. The validators judge it, and the job settles in the same call.", time: "1 to 5 minutes.", money: "What is still held comes back to you in that call, less whatever the re-billed line earns." };
    case "settle":
      return { ...common, id: "demo:settle", tone: "busy", kicker: "Settling", now: "Demo Motors is settling, waiving its re-bill.", time: "Usually under a minute; no model runs.", money: "What is still held comes back to your wallet in this call." };
  }
}
