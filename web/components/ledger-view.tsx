"use client";

// The register's own books: what it holds and for whom, what it has paid and to whom, the verdict
// count, and every job newest first.

import { JobList } from "@/components/job-list";
import { ReadProblem } from "@/components/read-state";
import { useAfterTx, useRead } from "@/components/use-read";
import { hasContract, readQuotesWindow, readStats } from "@/lib/chain";
import { gen } from "@/lib/format";

export function LedgerView() {
  const stats = useRead(() => readStats({ fresh: true }), ["stats"], { enabled: hasContract() });
  const jobs = useRead(() => readQuotesWindow(3), ["all"], { enabled: hasContract() });
  useAfterTx(stats.refresh);
  useAfterTx(jobs.refresh);
  if (!hasContract()) return <p className="sheet-plain px-4 py-3">The register is not deployed yet.</p>;
  const s = stats.data;
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
      {s ? (
        <section className="sheet px-4 py-4 sm:px-5">
          <h2 className="form-label border-b-2 border-ink pb-1">Held now</h2>
          <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[14.5px]">
            <dt className="text-ink-2">Customers&apos; escrow</dt>
            <dd className="mono text-right">{gen(s.escrowHeldAtto)}</dd>
            <dt className="text-ink-2">Garages&apos; free bonds</dt>
            <dd className="mono text-right">{gen(s.bondsFreeAtto)}</dd>
            <dt className="text-ink-2">Bonds locked behind unclear lines</dt>
            <dd className="mono text-right">{gen(s.bondsLockedAtto)}</dd>
            <dt className="font-semibold">Owed in all</dt>
            <dd className="mono text-right font-semibold">{gen(s.balanceOwedAtto)}</dd>
          </dl>
          <h2 className="form-label mt-4 border-b-2 border-ink pb-1">Paid out</h2>
          <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[14.5px]">
            <dt className="text-ink-2">To garages, covered lines</dt>
            <dd className="mono text-right">{gen(s.paidToGaragesAtto)}</dd>
            <dt className="text-ink-2">To customers, penalties</dt>
            <dd className="mono text-right">{gen(s.penaltiesToCustomersAtto)}</dd>
            <dt className="text-ink-2">To customers, escrow back</dt>
            <dd className="mono text-right">{gen(s.refundedToCustomersAtto)}</dd>
          </dl>
          <h2 className="form-label mt-4 border-b-2 border-ink pb-1">Lines judged</h2>
          <div className="mt-2 flex flex-wrap items-center gap-4">
            <span className="stamp stamp-covered text-[17px]">{s.covered} covered</span>
            <span className="stamp stamp-not text-[17px]">{s.notCovered} not</span>
            <span className="stamp stamp-unclear text-[17px]">{s.unclear} unclear</span>
          </div>
          <p className="mt-3 text-[13.5px] text-ink-2">
            {s.garages} garages · {s.quotes} quotes · {s.invoiced} invoices · {s.rebills} re-bills · {s.settled} settled · {s.reclaimed} reclaimed · {s.refusalsRefunded} refused payments returned
          </p>
        </section>
      ) : (
        <ReadProblem state={stats} what="the books" />
      )}
      <section className="flex flex-col gap-3">
        <h2 className="head text-[26px] font-extrabold text-card-2 uppercase">Every job</h2>
        {jobs.data ? <JobList rows={jobs.data.rows} empty="No quotes written yet." /> : <ReadProblem state={jobs} what="the jobs" />}
      </section>
    </div>
  );
}
