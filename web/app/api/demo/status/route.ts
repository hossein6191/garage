// GET /api/demo/status: whether the demo garage can act now, its public address, name and free bond,
// the bond it keeps before it calls itself online, and exactly why not when it cannot: "no key set",
// "the key set is not a 0x private key of 64 hex characters", the contract not deployed, Studio's RPC
// not answering, no GEN on its account, not registered, or its bond too low. The key is never echoed.

import { demoStatusNow } from "@/lib/demo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  return Response.json(await demoStatusNow(), { headers: { "cache-control": "no-store" } });
}
