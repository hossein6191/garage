// POST /api/demo/settle {quote}: the demo garage's "settle" move on one of its own demo quotes, made only when
// the chain says it is the garage's turn (lib/demo-script.ts demoTurn). Only a quote id goes in.

import { demoRoute } from "@/lib/demo-route";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = demoRoute("settle");
