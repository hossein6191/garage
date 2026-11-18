import type { Metadata } from "next";

import { GarageView } from "@/components/garage-view";

export const metadata: Metadata = { title: "The garage" };

export default function GaragePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="head text-[44px] leading-none font-extrabold text-card-2 uppercase">The garage</h1>
      <p className="max-w-[42rem] text-card-3">A garage keeps a standing bond here. Every invoice locks 20 percent of its total from that bond until the verdict, so a penalty is always payable.</p>
      <GarageView />
    </div>
  );
}
