"use client";

// Everything that can happen next on one job, for whoever is looking: the waiting panel of its state
// (lib/guide.ts), the customer's own buttons (accept and pay, approve the extra, reclaim, settle), and on
// a demo job the "next step" tags that ask the demo garage to make its move. One thing at a time: while
// a transaction is on its way, its panel and time-clock strip take the place of the buttons.

import * as React from "react";

import { Button } from "@/components/button";
import { DemoStage, useDemoCall } from "@/components/demo-call";
import { TxStage } from "@/components/tx-stage";
import { useNow } from "@/components/use-now";
import { useTx } from "@/components/use-tx";
import { WaitPanel } from "@/components/wait-panel";
import { useWallet } from "@/components/wallet";
import { calls } from "@/lib/calls";
import { isMock } from "@/lib/chain";
import { DEMO_EXTRA, MOVE_LABEL, demoTurn, invoiceJson, isDemoQuote, rebillJson } from "@/lib/demo-script";
import { big, gen } from "@/lib/format";
import { jobGuide, jobState, roleOf, sendingGuide, signGuide, isJudged } from "@/lib/guide";
import { rememberTx } from "@/lib/tx-memory";
import type { Call, DemoMove, DemoStatus, Quote, TxStatus } from "@/lib/types";

const TX_LABEL: Record<string, string> = {
  accept: "You · accept(), paying the quote",
  approve_extra: "You · approve_extra(), paying the extra",
  settle: "You · settle()",
  reclaim: "You · reclaim()",
};

export function JobActions({ q, me, demo, onMoved }: { q: Quote; me: string; demo: DemoStatus | null; onMoved: () => void }) {
  const wallet = useWallet();
  const clock = useNow();
  const now = clock || q.now;
  const done = React.useCallback(
    (s: TxStatus, hash: string, call: Call) => {
      void s;
      rememberTx(q.id, hash, TX_LABEL[call.fn] ?? `Demo Motors · ${call.fn}()`);
      onMoved();
    },
    [q.id, onMoved],
  );
  const tx = useTx(done);
  const bot = useDemoCall(done);
  const role = roleOf(q, me);
  const isDemo = !!demo?.bot && isDemoQuote(q, demo.bot);
  const state = jobState(q, now);
  const guide = jobGuide(q, role, now, { demo: isDemo });
  const busy = tx.sending || (!!tx.hash && !tx.final) || bot.asking || (!!bot.tx.hash && !bot.tx.final);
  const connected = isMock || (!!wallet.address && wallet.onStudio);

  const send = async (call: Call) => {
    bot.clear();
    const hash = await tx.start(call);
    if (hash) rememberTx(q.id, hash, TX_LABEL[call.fn] ?? call.fn);
  };

  const askBot = async (move: DemoMove) => {
    tx.reset();
    const call: Call =
      move === "extra"
        ? calls.requestExtra(q.id, DEMO_EXTRA.text, DEMO_EXTRA.price)
        : move === "invoice"
          ? calls.invoice(q.id, invoiceJson(q))
          : move === "rebill"
            ? calls.rebill(q.id, rebillJson(q))
            : calls.settle(q.id);
    await bot.ask(move, q.id, call);
  };

  const pendingExtra = q.approved.find((a) => a.kind === "extra" && a.status === "pending");
  const buttons: React.ReactNode[] = [];
  if (role === "customer" && !busy) {
    if (state === "quoted") buttons.push(<Button key="accept" onClick={() => void send(calls.accept(q.id, big(q.totalAtto)))} disabled={!connected}>Accept and pay {gen(q.totalAtto)}</Button>);
    if (state === "extra_pending" && pendingExtra)
      buttons.push(<Button key="extra" variant="ok" onClick={() => void send(calls.approveExtra(q.id, pendingExtra.line, big(pendingExtra.priceAtto)))} disabled={!connected}>Approve the extra, pay {gen(pendingExtra.priceAtto)}</Button>);
    if (state === "overdue") buttons.push(<Button key="reclaim" variant="ok" onClick={() => void send(calls.reclaim(q.id))} disabled={!connected}>Reclaim {gen(q.heldAtto)}</Button>);
    if (state === "rebill_closed") buttons.push(<Button key="settle" variant="ok" onClick={() => void send(calls.settle(q.id))} disabled={!connected}>Settle the job</Button>);
  }

  const turn = isDemo && demo?.bot ? demoTurn(q, demo.bot, now) : { moves: [], why: "" };
  const chips = !busy && isDemo && (role === "customer" || isMock) && demo?.online ? turn.moves : [];

  return (
    <div className="flex flex-col gap-3">
      <TxStage tx={tx} sign={signGuide(tx.call?.fn ?? "accept", tx.call?.value ?? 0n)} sending={sendingGuide(tx.call?.fn ?? "accept", tx.call?.value ?? 0n)} label={tx.call ? TX_LABEL[tx.call.fn] ?? tx.call.fn : ""} judged={!!tx.call && isJudged(tx.call.fn)} hideFinal />
      <DemoStage call={bot} hideFinal />
      {!busy && (
        <WaitPanel
          guide={guide}
          action={
            buttons.length || chips.length ? (
              <>
                {buttons}
                {chips.map((m) => (
                  <button key={m} type="button" className="chip" onClick={() => void askBot(m)}>
                    Next step · {MOVE_LABEL[m]}
                  </button>
                ))}
              </>
            ) : undefined
          }
        />
      )}
      {role === "customer" && !connected && !isMock && <p className="text-sm text-card-2">Connect the wallet that is this job&apos;s customer, on GenLayer Studio, to act on it.</p>}
      {isDemo && demo && !demo.online && !busy && (q.status === "accepted" || q.status === "invoiced") && (
        <p className="sheet-plain border-l-4 !border-l-amber px-3 py-2 text-sm">
          The demo garage is offline right now ({demo.reason}). Your money stays held by the contract: {q.status === "accepted" ? "if no invoice comes by the deadline, you reclaim all of it here." : "once the re-bill window closes you settle here and get back what is held."}
        </p>
      )}
    </div>
  );
}
