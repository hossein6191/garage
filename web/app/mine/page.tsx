import type { Metadata } from "next";

import { MineView } from "@/components/mine-view";

export const metadata: Metadata = { title: "My jobs" };

export default function MinePage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="head text-[44px] leading-none font-extrabold text-card-2 uppercase">My jobs</h1>
      <p className="max-w-[40rem] text-card-3">Every quote your address was written, or wrote as a garage, newest first. Each opens its job card.</p>
      <MineView />
    </div>
  );
}
