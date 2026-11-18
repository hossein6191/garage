"use client";

// One garage's board: its name, its free bond (what penalties are paid from), what it has been paid and
// what it has paid in penalties, and its record of jobs with their stamps. The demo garage by default;
// any address with ?a=0x...

import { JobList } from "@/components/job-list";
import { ReadProblem } from "@/components/read-state";
import { useDemoStatus } from "@/components/use-demo";
import { useAfterTx, useRead, useSearchString } from "@/components/use-read";
import { addressUrl, hasContract, readGarage, readQuotesOfWindow } from "@/lib/chain";
import { DEMO_NEEDED } from "@/lib/demo-script";
import { big, gen, when } from "@/lib/format";
import { MIN_STANDING } from "@/lib/money";
import { maskVerdicts } from "@/lib/verdict";

export function GarageView() {
  const search = useSearchString();
  const asked = /^0x[0-9a-fA-F]{40}$/.test(new URLSearchParams(search).get("a") ?? "") ? new URLSearchParams(search).get("a")!.toLowerCase() : "";
  const demo = useDemoStatus();
  const who = asked || demo.data?.bot || "";
  const g = useRead(() => readGarage(who, { fresh: true }), [who], { enabled: !!who && hasContract() });
  const jobs = useRead(() => readQuotesOfWindow(who, 3), [who], { enabled: !!who && hasContract() });
  useAfterTx(g.refresh);
  useAfterTx(jobs.refresh);

  if (!who) return demo.loading ? <p className="sheet-plain px-4 py-3 text-sm">Finding the demo garage…</p> : <p className="sheet-plain px-4 py-3">The demo garage has no key on this site yet ({demo.data?.reason || "no answer"}). Open a garage with ?a=0x… in the address.</p>;
  if (!g.data) return <ReadProblem state={g} what="the garage" />;
  const d = g.data;
  const rows = (jobs.data?.rows ?? []).filter((r) => r.role === "garage");
  const verdicts = rows.flatMap((r) => maskVerdicts(r.mask));
  const n = (v: string) => verdicts.filter((x) => x === v).length;
  const isDemo = who === demo.data?.bot;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      <section className="sheet hook px-4 pt-6 pb-4 sm:px-5">
        <p className="form-label">Garage</p>
        <h2 className="head text-[36px] leading-none font-extrabold uppercase">{d.registered ? d.name : "Not registered"}</h2>
        <a href={addressUrl(who)} target="_blank" rel="noreferrer" className="mono link mt-1 block text-[12.5px] break-all text-ink-2">
          {who}
        </a>
        <dl className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1.5 border-t-2 border-ink pt-2 text-[14.5px]">
          <dt className="text-ink-2">Free bond, where penalties come from</dt>
          <dd className="mono text-right font-semibold">{gen(d.bondAtto)}</dd>
          <dt className="text-ink-2">May write quotes (needs {gen(MIN_STANDING)})</dt>
          <dd className="head text-right font-bold uppercase">{d.mayQuote ? "Yes" : "No"}</dd>
          <dt className="text-ink-2">Paid for covered lines</dt>
          <dd className="mono text-right">{gen(d.paidAtto)}</dd>
          <dt className="text-ink-2">Paid out in penalties</dt>
          <dd className="mono text-right text-no">{gen(d.penaltiesAtto)}</dd>
          <dt className="text-ink-2">Quotes written</dt>
          <dd className="mono text-right">{d.quotes}</dd>
          <dt className="text-ink-2">Registered</dt>
          <dd className="text-right">{when(d.registeredAt) || "—"}</dd>
        </dl>
        {isDemo && (
          <p className="mt-3 border-t border-dashed border-rule pt-2 text-[13.5px] text-ink-2">
            The demo garage calls itself online only while its free bond is at least {gen(DEMO_NEEDED)}: the standing minimum plus the 20 percent three invoices lock. It is{" "}
            <strong>{demo.data?.online ? "online" : `offline (${demo.data?.reason})`}</strong>.
            {big(d.bondAtto) < DEMO_NEEDED ? " Its bond is below that now." : ""}
          </p>
        )}
      </section>
      <section className="flex flex-col gap-3">
        <h2 className="head text-[26px] font-extrabold text-card-2 uppercase">Record</h2>
        {verdicts.length > 0 && (
          <p className="text-card-3">
            Over {rows.filter((r) => r.mask).length} judged invoices: {n("covered")} lines covered, {n("not_covered")} not, {n("unclear")} unclear.
          </p>
        )}
        {jobs.data ? <JobList rows={rows} empty="No jobs written yet." /> : <ReadProblem state={jobs} what="the garage's jobs" />}
      </section>
    </div>
  );
}
