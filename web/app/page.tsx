import { StartDemo } from "@/components/start-demo";
import { Stamp } from "@/components/stamp";
import { IconSpanner } from "@/components/icons";
import { DEMO_EXTRA, DEMO_INVOICE, DEMO_QUOTE } from "@/lib/demo-script";
import { gen } from "@/lib/format";
import { stampOf } from "@/lib/verdict";

const EXAMPLE = [
  { text: DEMO_INVOICE[0].text, against: DEMO_QUOTE[0].text, v: "covered" as const },
  { text: DEMO_INVOICE[4].text, against: DEMO_QUOTE[2].text, v: "not_covered" as const },
  { text: DEMO_INVOICE[5].text, against: DEMO_QUOTE[2].text, v: "unclear" as const },
];

const STEPS = [
  ["Ask", "Demo Motors writes a brake quote to your address. Free."],
  ["Accept", `You pay ${gen(DEMO_QUOTE.reduce((s, l) => s + l.price, 0n))}. The contract holds it, not the garage.`],
  ["Extra", `The garage asks for wiper blades, ${gen(DEMO_EXTRA.price)}. Approve it or not.`],
  ["Invoice", "Six lines in the garage's own words. The validators judge each one."],
  ["Stamps", "Covered lines are paid. NOT lines cost the garage 20% of their price, to you."],
  ["Settle", "Whatever was not earned comes back to your wallet."],
];

export default function Home() {
  return (
    <div className="flex flex-col gap-10">
      <section className="grid items-start gap-8 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
        <div className="text-card-2">
          <p className="head text-[15px] font-bold tracking-[0.2em] text-safety uppercase">The problem</p>
          <h1 className="head mt-1 text-[44px] leading-[0.95] font-extrabold uppercase sm:text-[62px]">You approved brakes. The invoice says cabin filter.</h1>
          <p className="mt-4 max-w-[38rem] text-[17px] leading-relaxed text-card-3">
            An invoice never repeats the quote word for word, so &ldquo;is this line covered by what I approved?&rdquo; is a judgement, and today the garage makes it. A string match does no better: &ldquo;Replaced front brake discs and pads&rdquo; is the approved line in other words, and &ldquo;Replaced cabin filter&rdquo; is a different job.
          </p>
          <p className="mt-3 max-w-[38rem] text-[17px] leading-relaxed text-card-3">
            Here the money waits in escrow and GenLayer&apos;s validators read every invoice line against the line you approved. Covered lines are paid. Lines that are not cost the garage 20 percent of their price, from its bond, to you. Lines that say nothing are not paid at all.
          </p>
        </div>

        <div className="sheet hook px-4 pt-6 pb-4 sm:px-5" aria-label="Three invoice lines, judged">
          <p className="form-label border-b-2 border-ink pb-1">Invoice, as the validators stamped it</p>
          <ul>
            {EXAMPLE.map((e) => (
              <li key={e.text} className="flex items-center justify-between gap-3 border-b border-rule/70 py-2.5">
                <span className="min-w-0">
                  <span className="hand block text-[20px]">{e.text}</span>
                  <span className="block text-[12.5px] text-ink-3">against: {e.against}</span>
                </span>
                <Stamp stamp={stampOf(e.v)} className="shrink-0" />
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
        <div className="sheet px-4 py-5 sm:px-6">
          <h2 className="head flex items-center gap-2 text-[30px] leading-none font-extrabold uppercase">
            <IconSpanner size={26} /> Play the customer
          </h2>
          <p className="mt-2 text-[15px] text-ink-2">A demo garage, Demo Motors, plays the other side from the site&apos;s server with its own key and its own bond. Every step is a real transaction on GenLayer Studio, in test GEN.</p>
          <div className="mt-4">
            <StartDemo />
          </div>
        </div>
        <ol className="clock-strip grid gap-0 py-2 pr-3 sm:grid-cols-2" aria-label="The demo in six steps">
          {STEPS.map(([k, v], i) => (
            <li key={k} className="border-b border-dashed border-rule py-2 sm:odd:border-r sm:odd:pr-3 sm:even:pl-3">
              <span className="punch text-[13px]">{String(i + 1).padStart(2, "0")}</span> <span className="head text-[18px] font-bold uppercase">{k}</span>
              <p className="text-[14px] text-ink-2">{v}</p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
