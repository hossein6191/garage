// How one invoice line's judgement is shown: the rubber stamp (COVERED green, NOT red, UNCLEAR
// amber), the money line beside it, and, for a line that was re-billed, which verdict is the final
// one. Pure, so tests/unit/verdict.test.mjs checks every case.

import { big, gen } from "./format.ts";
import type { InvoiceLine, Verdict } from "./types.ts";

export type StampTone = "covered" | "not" | "unclear" | "waiting";

export type Stamp = { word: string; tone: StampTone; hint: string };

export function stampOf(v: Verdict): Stamp {
  if (v === "covered") return { word: "COVERED", tone: "covered", hint: "The approved line covers this line." };
  if (v === "not_covered") return { word: "NOT", tone: "not", hint: "Different work or a different part from the approved line." };
  if (v === "unclear") return { word: "UNCLEAR", tone: "unclear", hint: "The line does not say what work or part it is, or the two askings split." };
  return { word: "NOT YET", tone: "waiting", hint: "Not judged yet." };
}

/** C, N, U as the stored mask writes them. */
export const letterVerdict = (letter: string): Verdict => (letter === "C" ? "covered" : letter === "N" ? "not_covered" : letter === "U" ? "unclear" : "");

/** "CCCCNU" → ["covered", ..., "unclear"]; unknown letters are not judged. */
export const maskVerdicts = (mask: string): Verdict[] => Array.from(mask).map(letterVerdict);

export type LineView = {
  /** the stamp of the first judging */
  first: Stamp;
  /** the stamp of the re-bill, when the line was re-billed */
  rebill: Stamp | null;
  /** the one that decides the money */
  final: Stamp;
  /** what was paid to the garage for this line, in words */
  money: string;
  /** true when a covered line was paid less than billed: the approved line had less left */
  capped: boolean;
};

/** One stored invoice line as the job card shows it. */
export function lineView(l: InvoiceLine): LineView {
  const first = stampOf(l.verdict);
  const rebill = l.rebillVerdict ? stampOf(l.rebillVerdict) : null;
  const final = rebill ?? first;
  const deciding: { verdict: Verdict; price: string; paid: string; penalty: string } = rebill
    ? { verdict: l.rebillVerdict, price: l.rebillPriceAtto, paid: l.rebillPaidAtto, penalty: l.rebillPenaltyAtto }
    : { verdict: l.verdict, price: l.priceAtto, paid: l.paidAtto, penalty: l.penaltyAtto };
  const capped = deciding.verdict === "covered" && big(deciding.paid) < big(deciding.price);
  let money = "";
  if (deciding.verdict === "covered")
    money = capped ? `Paid ${gen(deciding.paid)} of ${gen(deciding.price)} billed: only that was left of approved line ${l.bills}.` : `Paid ${gen(deciding.paid)} to the garage.`;
  else if (deciding.verdict === "not_covered") money = `Unpaid. ${gen(deciding.penalty)} (20 percent) moved from the garage's bond to the customer.`;
  else if (deciding.verdict === "unclear")
    money = rebill ? "Unpaid, no penalty. It was re-billed once already; its share went back to the customer." : "Unpaid, no penalty. The garage may re-bill it once, in other words.";
  else money = "Waiting for the validators.";
  return { first, rebill, final, money, capped };
}

/** "4 covered · 1 not · 1 unclear" for a mask. */
export function maskSummary(mask: string): string {
  const v = maskVerdicts(mask);
  const n = (x: Verdict) => v.filter((y) => y === x).length;
  const parts = [`${n("covered")} covered`, `${n("not_covered")} not`, `${n("unclear")} unclear`];
  return v.length ? parts.join(" · ") : "not invoiced";
}
