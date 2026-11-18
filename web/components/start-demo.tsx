"use client";

// The start of the demo on the home page: connect, then ask Demo Motors for the demonstration quote.
// The demo garage writes it to the visitor's address; once that is final the page goes to the job card.
// A visitor with a demo job already in progress is sent to it instead.

import { useRouter } from "next/navigation";
import * as React from "react";

import { Button, ButtonLink } from "@/components/button";
import { DemoStage, useDemoCall } from "@/components/demo-call";
import { useDemoStatus } from "@/components/use-demo";
import { useMe } from "@/components/use-me";
import { useRead } from "@/components/use-read";
import { useWallet } from "@/components/wallet";
import { calls } from "@/lib/calls";
import { hasContract, isMock, readQuotesOfWindow } from "@/lib/chain";
import { DEMO_TOTAL, DEMO_EXTRA, openDemoQuote, quoteArgs } from "@/lib/demo-script";
import { gen } from "@/lib/format";
import { madeQuote } from "@/lib/parse";
import { rememberTx } from "@/lib/tx-memory";
import type { TxStatus } from "@/lib/types";

export function StartDemo() {
  const router = useRouter();
  const wallet = useWallet();
  const me = useMe();
  const demo = useDemoStatus();
  const mine = useRead(() => readQuotesOfWindow(me, 1), [me], { enabled: !!me && hasContract() });
  const onFinal = React.useCallback(
    (s: TxStatus, hash: string) => {
      const id = madeQuote(s.result);
      if (id) {
        rememberTx(id, hash, "Demo Motors · quote()");
        router.push(`/job/${id}`);
      }
    },
    [router],
  );
  const call = useDemoCall(onFinal);
  const bot = demo.data?.bot ?? "";
  const open = bot && mine.data ? openDemoQuote(mine.data.rows, bot) : null;
  const busy = call.asking || (!!call.tx.hash && !call.tx.final);

  let body: React.ReactNode;
  if (!hasContract()) body = <p className="text-[14.5px] text-ink-2">The Garage register is not deployed yet. The demo opens here once it is.</p>;
  else if (!me)
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-[14.5px] text-ink-2">Connect a wallet on GenLayer Studio. You will be the customer; the wallet menu gives free test GEN.</p>
        <Button onClick={() => void wallet.connect()} disabled={wallet.connecting}>
          {wallet.connecting ? "Connecting…" : "Connect a wallet"}
        </Button>
      </div>
    );
  else if (open)
    body = (
      <div className="flex flex-col gap-2">
        <p className="text-[14.5px] text-ink-2">You have a demo job in progress.</p>
        <ButtonLink href={`/job/${open.id}`}>Open job card {open.id}</ButtonLink>
      </div>
    );
  else if (demo.data && !demo.data.online)
    body = <p className="text-[14.5px] text-ink-2">The demo garage is offline right now: {demo.data.reason}. No money has moved; try again later.</p>;
  else
    body = (
      <div className="flex flex-col gap-2">
        {!busy && (
          <Button onClick={() => void call.ask("quote", me, calls.quote(quoteArgs(me)))} disabled={!demo.data || (!isMock && !wallet.onStudio)}>
            Ask Demo Motors for the quote
          </Button>
        )}
        <p className="text-[13px] text-ink-3">Asking costs nothing. You pay only if you accept: {gen(DEMO_TOTAL)}, plus {gen(DEMO_EXTRA.price)} if you approve the extra.</p>
      </div>
    );

  return (
    <div className="flex flex-col gap-3">
      {body}
      <DemoStage call={call} />
    </div>
  );
}
