"use client";

// Asking the demo garage to make one move, and following what it signed: while the site's server asks,
// a short wait; if the garage says no, its reason in a sentence; once it signed, the demo's waiting
// panel over the time-clock strip of its transaction.

import * as React from "react";

import { TxRail } from "@/components/tx-rail";
import { useTx, type TxRun } from "@/components/use-tx";
import { WaitPanel } from "@/components/wait-panel";
import { askDemo } from "@/lib/chain";
import { demoGuide } from "@/lib/guide";
import type { Call, DemoMove, TxStatus } from "@/lib/types";

export type DemoCall = { tx: TxRun; asking: boolean; reason: string; move: DemoMove | null; ask: (move: DemoMove, target: string, call: Call) => Promise<boolean>; clear: () => void };

export function useDemoCall(onFinal?: (s: TxStatus, hash: string, call: Call) => void): DemoCall {
  const tx = useTx(onFinal);
  const [asking, setAsking] = React.useState(false);
  const [reason, setReason] = React.useState("");
  const [move, setMove] = React.useState<DemoMove | null>(null);
  const { track, reset } = tx;
  const ask = React.useCallback(
    async (m: DemoMove, target: string, call: Call) => {
      reset();
      setMove(m);
      setAsking(true);
      setReason("");
      const answer = await askDemo(m, target);
      setAsking(false);
      if (answer.ok) {
        track(answer.hash, call);
        return true;
      }
      setReason(answer.reason);
      return false;
    },
    [track, reset],
  );
  const clear = React.useCallback(() => {
    reset();
    setReason("");
    setMove(null);
  }, [reset]);
  return { tx, asking, reason, move, ask, clear };
}

const LABEL: Record<DemoMove, string> = {
  quote: "Demo Motors · quote()",
  extra: "Demo Motors · request_extra()",
  invoice: "Demo Motors · invoice(), judged",
  rebill: "Demo Motors · rebill(), judged",
  settle: "Demo Motors · settle()",
};

export function DemoStage({ call, hideFinal }: { call: DemoCall; hideFinal?: boolean }) {
  if (call.asking) return <WaitPanel guide={demoGuide("asking")} />;
  if (call.reason)
    return (
      <p role="alert" className="sheet-plain border-l-4 !border-l-amber px-3 py-2 text-sm text-ink">
        The demo garage did not act: {call.reason}
      </p>
    );
  if (!call.tx.hash || !call.move) return null;
  if (call.tx.final && hideFinal) return null;
  return (
    <div className="flex flex-col gap-2.5">
      {!call.tx.final && <WaitPanel guide={demoGuide(call.move)} since={call.tx.at || undefined} />}
      <TxRail hash={call.tx.hash} label={LABEL[call.move]} judged={call.move === "invoice" || call.move === "rebill"} onDone={call.tx.onDone} />
    </div>
  );
}
