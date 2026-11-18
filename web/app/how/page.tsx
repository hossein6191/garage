import type { Metadata } from "next";

import { RulesView } from "@/components/rules-view";
import { Stamp } from "@/components/stamp";
import { stampOf } from "@/lib/verdict";

export const metadata: Metadata = { title: "How it works" };

const PLAIN: [string, string][] = [
  ["You approve words", "A quote is numbered lines, each a description and a price. You accept by paying the total, which the contract holds. An extra joins the job only when you pay for it too. Approving is a signature, never a judgement."],
  ["Each invoice line names the line it bills", "The garage sends one invoice: each line says which approved line it is billed against. The pair, approved words and invoice words, is the whole question. No price, address, car or name is ever shown to the model."],
  ["Every validator asks twice", "Each validator puts every pair to its own model in invoice order with the approved line first, then in reverse order with the invoice line first. A line is COVERED only if both askings say so, NOT only if both say not; anything else, a split included, is UNCLEAR."],
  ["They must agree exactly", "The leader's result is a string of letters, one per line (CCCCNU), and a fingerprint of the pairs judged. Every other validator computes its own and agrees only if both match character for character. There is no tolerance: a disagreement stores nothing and moves nothing."],
  ["The code does the money", "In the same transaction: a covered line is paid its invoice price, but never more than what is left of the approved line. A NOT line is unpaid and 20 percent of its price moves from the garage's bond to you. An UNCLEAR line is unpaid with no penalty; the garage may re-bill it once, in new words, at no higher price. Whatever is not earned comes back to you."],
  ["Nobody waits forever", "A garage that never invoices by its own deadline loses the job: you reclaim everything. An unclear line is re-billed within a day or settled. The customer has no veto over a covered line: the judgement is the network's."],
];

export default function HowPage() {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="head text-[44px] leading-none font-extrabold text-card-2 uppercase">How it works</h1>
        <p className="mt-2 max-w-[44rem] text-card-3">Consensus in plain words first, then the contract&apos;s own rules, word for word.</p>
      </div>
      <ol className="grid gap-4 md:grid-cols-2">
        {PLAIN.map(([h, t], i) => (
          <li key={h} className="sheet px-4 py-4">
            <p className="punch text-[13px]">STEP {String(i + 1).padStart(2, "0")}</p>
            <h2 className="head text-[24px] leading-tight font-extrabold uppercase">{h}</h2>
            <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{t}</p>
          </li>
        ))}
      </ol>
      <div className="sheet flex flex-wrap items-center justify-center gap-x-10 gap-y-4 px-4 py-5">
        <span className="flex items-center gap-3">
          <Stamp stamp={stampOf("covered")} /> <span className="text-[14px]">both askings: COVERED</span>
        </span>
        <span className="flex items-center gap-3">
          <Stamp stamp={stampOf("not_covered")} /> <span className="text-[14px]">both askings: NOT</span>
        </span>
        <span className="flex items-center gap-3">
          <Stamp stamp={stampOf("unclear")} /> <span className="text-[14px]">anything else</span>
        </span>
      </div>
      <section className="flex flex-col gap-3">
        <h2 className="head text-[30px] font-extrabold text-card-2 uppercase">rules(), word for word</h2>
        <RulesView />
      </section>
    </div>
  );
}
