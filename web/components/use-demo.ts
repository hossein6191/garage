"use client";

import { useRead } from "@/components/use-read";
import { readDemoStatus } from "@/lib/chain";

/** The demo garage's status: whether it can act now, its address and why not. */
export function useDemoStatus() {
  return useRead(async () => ({ data: await readDemoStatus(), source: "chain" as const }), ["demo"]);
}
