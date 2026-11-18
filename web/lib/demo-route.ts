// The body of the four per-quote demo routes: read {quote}, ask the demo garage, answer its reply.

import { sendMove } from "./demo-server";
import { parseQuoteId } from "./format";
import type { DemoMove } from "./types";

const noStore = { "cache-control": "no-store" };

export function demoRoute(move: Exclude<DemoMove, "quote">) {
  return async function POST(request: Request) {
    let id = "";
    try {
      const text = await request.text();
      if (text.length > 200) throw new Error("too long");
      const body = JSON.parse(text) as { quote?: unknown };
      id = typeof body.quote === "string" ? parseQuoteId(body.quote) : "";
    } catch {
      id = "";
    }
    if (!id) return Response.json({ ok: false, reason: 'send {"quote": "Q1"}' }, { status: 400, headers: noStore });
    const answer = await sendMove(move, id);
    return Response.json(answer.body, { status: answer.status, headers: noStore });
  };
}
