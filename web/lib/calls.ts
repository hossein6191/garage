// One builder per write method of contracts/garage.py: the method's name, its arguments in the
// contract's order, and the value sent. Pure, so tests/unit/interface.test.mjs checks every builder
// against the contract's signatures.

import type { Call } from "./types.ts";

export const calls = {
  /** accept(quote_id), payable: the quote total exactly, held in escrow. */
  accept: (quote: string, totalAtto: bigint): Call => ({ fn: "accept", args: [quote], value: totalAtto }),
  /** approve_extra(quote_id, line), payable: the extra's price exactly. */
  approveExtra: (quote: string, line: number, priceAtto: bigint): Call => ({ fn: "approve_extra", args: [quote, Math.trunc(line)], value: priceAtto }),
  /** settle(quote_id): the garage at any time after an unclear line; the customer once the re-bill window closed. */
  settle: (quote: string): Call => ({ fn: "settle", args: [quote] }),
  /** reclaim(quote_id): the customer, after the invoice deadline with no invoice. */
  reclaim: (quote: string): Call => ({ fn: "reclaim", args: [quote] }),
  /** The calls the demo garage signs on the server, for the rail's label. */
  quote: (args: [string, string, string, string, number]): Call => ({ fn: "quote", args }),
  requestExtra: (quote: string, text: string, priceAtto: bigint): Call => ({ fn: "request_extra", args: [quote, text, priceAtto.toString()] }),
  invoice: (quote: string, linesJson: string): Call => ({ fn: "invoice", args: [quote, linesJson] }),
  rebill: (quote: string, linesJson: string): Call => ({ fn: "rebill", args: [quote, linesJson] }),
};
