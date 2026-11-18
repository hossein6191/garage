// POST /api/demo/quote {customer}: the demo garage writes the demonstration quote (front brake pads
// and discs, brake fluid, labour) naming that address as its customer. Only an address goes in; no text
// from the visitor is ever signed. One demo job in progress per address, a few quotes a day per client.

import { sendQuote } from "@/lib/demo-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const noStore = { "cache-control": "no-store" };

export async function POST(request: Request) {
  let customer = "";
  try {
    const text = await request.text();
    if (text.length > 200) throw new Error("too long");
    const body = JSON.parse(text) as { customer?: unknown };
    customer = typeof body.customer === "string" && /^0x[0-9a-fA-F]{40}$/.test(body.customer.trim()) ? body.customer.trim().toLowerCase() : "";
  } catch {
    customer = "";
  }
  if (!customer) return Response.json({ ok: false, reason: 'send {"customer": "0x..."}, your wallet address' }, { status: 400, headers: noStore });
  const client = (request.headers.get("x-forwarded-for") || "").split(",")[0].trim() || "local";
  const answer = await sendQuote(customer, client);
  return Response.json(answer.body, { status: answer.status, headers: noStore });
}
