"use client";

// The job page: the card on the left, what happens next on the right (on a phone, next first), and
// the transactions this browser saw for the job, each linked to the explorer.

import Link from "next/link";
import * as React from "react";

import { JobActions } from "@/components/job-actions";
import { JobCard } from "@/components/job-card";
import { ReadProblem } from "@/components/read-state";
import { useDemoStatus } from "@/components/use-demo";
import { useLocal } from "@/components/use-local";
import { useMe } from "@/components/use-me";
import { useAfterTx, useRead } from "@/components/use-read";
import { readGarage, readQuote, txUrl } from "@/lib/chain";
import { parseQuoteId, when } from "@/lib/format";
import { parseRemembered, rememberedRaw } from "@/lib/tx-memory";

export function JobView({ id: raw }: { id: string }) {
  const id = parseQuoteId(raw);
  const me = useMe();
  const demo = useDemoStatus();
  const quote = useRead(() => readQuote(id, { fresh: true }), [id], { enabled: !!id });
  const q = quote.data;
  const garage = useRead(() => readGarage(q?.garage ?? ""), [q?.garage ?? ""], { enabled: !!q });
  const remembered = parseRemembered(useLocal(() => rememberedRaw(id), ""));
  const { refresh } = quote;
  useAfterTx(refresh);
  const moved = React.useCallback(() => void refresh(), [refresh]);

  if (!id) return <p className="sheet-plain px-4 py-3">That is not a job number. Job numbers look like Q12.</p>;
  if (!q) {
    if (quote.loading || quote.error) return <ReadProblem state={quote} what={`job ${id}`} />;
    return (
      <p className="sheet-plain px-4 py-3">
        There is no job {id} on this register. <Link href="/ledger" className="link">See every job in the ledger.</Link>
      </p>
    );
  }
  return (
    <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
      <div className="order-2 lg:order-1">
        <JobCard q={q} garageName={garage.data?.name} fresh />
      </div>
      <aside className="order-1 flex flex-col gap-4 lg:sticky lg:top-4 lg:order-2" aria-label="What happens next">
        <JobActions q={q} me={me} demo={demo.data} onMoved={moved} />
        {remembered.length > 0 && (
          <section className="sheet-plain px-3 py-2.5 text-[13.5px]">
            <h2 className="form-label">Transactions seen from this browser</h2>
            <ul className="mt-1">
              {remembered.map((r) => (
                <li key={r.hash} className="flex flex-wrap justify-between gap-x-3 border-t border-dashed border-rule py-1">
                  <a href={txUrl(r.hash)} target="_blank" rel="noreferrer" className="link">
                    {r.label}
                  </a>
                  <span className="punch text-[12px]">{when(r.at)}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
      </aside>
    </div>
  );
}
