// The demo garage's script: the only words it ever signs, and the choice of its next move on a
// visitor's quote. The texts are the demonstration of tests/on_chain/smoke.mjs word for word: three
// quote lines, the wiper blades as an extra, and the six-line invoice with the fluid billed above its
// price, an unquoted cabin filter and a vague "Sundries". The visitor chooses only whether to approve
// the extra; when they do not, the wiper line is left out of the invoice, so the bot never bills a
// line that was not approved. Pure, so tests/unit/demo.test.mjs runs it.

import { MILLI } from "./format.ts";
import { lockOf, MIN_STANDING } from "./money.ts";
import type { DemoMove, Quote, QuoteRow } from "./types.ts";

export const DEMO_NAME = "Demo Motors";
export const DEMO_TITLE = "Front brake overhaul";
export const DEMO_CAR = "2016 Skoda Octavia 1.6 TDI estate";
/** From acceptance to the invoice deadline: a day. */
export const DEMO_JOB_SECONDS = 86400;

export type ScriptLine = { text: string; price: bigint };
export type ScriptBill = ScriptLine & { bills: number; extra?: boolean };

export const DEMO_QUOTE: ScriptLine[] = [
  { text: "Front brake pads and discs, supply and fit", price: 120n * MILLI },
  { text: "Brake fluid change, DOT 4", price: 20n * MILLI },
  { text: "Labour: fit front pads and discs and bleed the brakes, 2 hours", price: 80n * MILLI },
];
export const DEMO_TOTAL = DEMO_QUOTE.reduce((s, l) => s + l.price, 0n);

export const DEMO_EXTRA: ScriptLine = { text: "Front wiper blades, pair, supply and fit", price: 15n * MILLI };
/** The extra's line number on the demo quote: after the three quote lines. */
export const DEMO_EXTRA_LINE = DEMO_QUOTE.length + 1;

export const DEMO_INVOICE: ScriptBill[] = [
  { bills: 1, text: "Replaced front brake discs and pads", price: 120n * MILLI },
  { bills: 2, text: "Brake fluid flush and refill, DOT 4", price: 30n * MILLI },
  { bills: 3, text: "Labour fitting the front pads and discs and bleeding the brakes, 1.5 hours", price: 60n * MILLI },
  { bills: DEMO_EXTRA_LINE, text: "Fitted new front wiper blades", price: 15n * MILLI, extra: true },
  { bills: 3, text: "Replaced cabin filter", price: 25n * MILLI },
  { bills: 3, text: "Sundries", price: 10n * MILLI },
];

/** The one line the bot re-bills, and how: new words, no higher price. */
export const DEMO_REBILL = { from: "Sundries", text: "Brake cleaner spray used bleeding the brakes", price: 10n * MILLI };

/** The standing bond open-demo deposits, and the free bond below which the bot calls itself offline. */
export const DEMO_BOND = 10n ** 18n;
export const DEMO_NEEDED = MIN_STANDING + 3n * lockOf(DEMO_INVOICE.map((l) => l.price));

export const quoteLinesJson = (): string => JSON.stringify(DEMO_QUOTE.map((l) => ({ text: l.text, price: l.price.toString() })));

/** quote()'s arguments for one visitor. */
export const quoteArgs = (customer: string): [string, string, string, string, number] => [customer.toLowerCase(), DEMO_TITLE, DEMO_CAR, quoteLinesJson(), DEMO_JOB_SECONDS];

/** True when the quote is one the demo garage wrote with its script. */
export const isDemoQuote = (q: Pick<Quote, "garage" | "title"> | null, bot: string): boolean => !!q && !!bot && q.garage === bot.toLowerCase() && q.title === DEMO_TITLE;

const extraApproved = (q: Quote): boolean => q.approved.some((a) => a.line === DEMO_EXTRA_LINE && a.kind === "extra" && a.status === "approved");
const extraAsked = (q: Quote): boolean => q.approved.some((a) => a.kind === "extra");

/** The invoice the bot sends on this quote: all six lines, or five when the wiper blades were not approved. */
export function invoiceLines(q: Quote): ScriptBill[] {
  const ok = extraApproved(q);
  return DEMO_INVOICE.filter((l) => !l.extra || ok);
}

export const invoiceJson = (q: Quote): string => JSON.stringify(invoiceLines(q).map((l) => ({ bills: l.bills, text: l.text, price: l.price.toString() })));

/** The lines the bot re-bills: each unclear invoice line it has new words for, at no higher price. */
export function rebillLines(q: Quote): { line: number; text: string; price: bigint }[] {
  return q.invoice
    .filter((l) => l.verdict === "unclear" && l.text === DEMO_REBILL.from)
    .map((l) => ({ line: l.line, text: DEMO_REBILL.text, price: BigInt(l.priceAtto) < DEMO_REBILL.price ? BigInt(l.priceAtto) : DEMO_REBILL.price }));
}

export const rebillJson = (q: Quote): string => JSON.stringify(rebillLines(q).map((l) => ({ line: l.line, text: l.text, price: l.price.toString() })));

export type Turn = { moves: DemoMove[]; why: string };

/**
 * What the demo garage may be asked to do on this quote now, first the move the script makes next,
 * and why when there is none. `now` is the contract's clock (the quote's own `now` when it has one).
 */
export function demoTurn(q: Quote | null, bot: string, now: number = q?.now ?? 0): Turn {
  if (!q) return { moves: [], why: "there is no such quote" };
  if (!isDemoQuote(q, bot)) return { moves: [], why: `${q.id} is not one of the demo garage's quotes` };
  if (q.status === "quoted") return { moves: [], why: `${q.id} waits for the customer to accept it by paying` };
  if (q.status === "accepted") {
    if (q.invoiceBy && now >= q.invoiceBy) return { moves: [], why: `the invoice deadline of ${q.id} has passed; the customer may reclaim the escrow` };
    if (!extraAsked(q)) return { moves: ["extra"], why: "" };
    return { moves: ["invoice"], why: "" };
  }
  if (q.status === "invoiced") {
    const open = q.rebillable && !q.rebilled && (!q.rebillBy || now < q.rebillBy);
    if (open && rebillLines(q).length) return { moves: ["rebill", "settle"], why: "" };
    return { moves: ["settle"], why: "" };
  }
  return { moves: [], why: `${q.id} is ${q.status}; nothing is left for the garage to do` };
}

/** The visitor's demo quote still in progress, newest first, or null. */
export function openDemoQuote(rows: QuoteRow[], bot: string): QuoteRow | null {
  const open = rows.filter((r) => r.garage === bot.toLowerCase() && r.title === DEMO_TITLE && (r.status === "quoted" || r.status === "accepted" || r.status === "invoiced"));
  return open.sort((a, b) => Number(b.id.slice(1)) - Number(a.id.slice(1)))[0] ?? null;
}

/** The label of each move on its "next step" button. */
export const MOVE_LABEL: Record<DemoMove, string> = {
  quote: "Ask Demo Motors for the quote",
  extra: "Garage: carry on with the job",
  invoice: "Garage: send the invoice",
  rebill: "Garage: re-bill the unclear line",
  settle: "Garage: settle now",
};
