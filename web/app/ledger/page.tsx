import type { Metadata } from "next";

import { LedgerView } from "@/components/ledger-view";

export const metadata: Metadata = { title: "Ledger" };

export default function LedgerPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="head text-[44px] leading-none font-extrabold text-card-2 uppercase">Ledger</h1>
      <p className="max-w-[42rem] text-card-3">The register&apos;s own books, read from stats(): everything it holds adds up to what it owes.</p>
      <LedgerView />
    </div>
  );
}
