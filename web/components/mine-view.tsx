"use client";

import { ButtonLink } from "@/components/button";
import { JobList } from "@/components/job-list";
import { ReadProblem } from "@/components/read-state";
import { useMe } from "@/components/use-me";
import { useAfterTx, useRead } from "@/components/use-read";
import { useWallet } from "@/components/wallet";
import { Button } from "@/components/button";
import { hasContract, readQuotesOfWindow } from "@/lib/chain";

export function MineView() {
  const me = useMe();
  const wallet = useWallet();
  const jobs = useRead(() => readQuotesOfWindow(me, 3), [me], { enabled: !!me && hasContract() });
  useAfterTx(jobs.refresh);
  if (!me)
    return (
      <div className="sheet-plain flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <span>Connect a wallet to see the jobs it is part of, as customer or garage.</span>
        <Button size="sm" onClick={() => void wallet.connect()}>
          Connect
        </Button>
      </div>
    );
  if (!jobs.data) return <ReadProblem state={jobs} what="your jobs" />;
  return (
    <div className="flex flex-col gap-3">
      <JobList rows={jobs.data.rows} showRole empty="No jobs for this address yet. Start the demo to get your first quote." />
      {jobs.data.partial && <p className="text-sm text-steel">Showing the newest {jobs.data.rows.length} of {jobs.data.total}.</p>}
      {jobs.data.rows.length === 0 && (
        <div>
          <ButtonLink href="/">Start the demo</ButtonLink>
        </div>
      )}
    </div>
  );
}
