// A get_quote() row in the contract's own JSON: the demonstration after its invoice, judged CCCCNU.
export const M = 10n ** 15n;
export const BOT = "0x000000000000000000000000000000000000de70";
export const ME = "0x00000000000000000000000000000000000c0571";

export function row(over = {}) {
  return {
    quote: "Q7", garage: BOT, customer: ME, title: "Front brake overhaul", car: "2016 Skoda Octavia 1.6 TDI estate", status: "invoiced",
    total: String(220n * M), escrow: String(235n * M), held: String(20n * M), paid: String(215n * M), penalties: String(5n * M), refunded: "0", lock: String(2n * M),
    job_seconds: 86400, created_at: 1000, accept_by: 1000 + 7 * 86400, accepted_at: 1100, invoice_by: 1100 + 86400, invoiced_at: 2000, rebill_by: 2000 + 86400,
    mask: "CCCCNU", fingerprint: "ab".repeat(32), rebilled: "", rebill_mask: "", rebill_fingerprint: "", closed_at: 0,
    approved: [
      { line: 1, kind: "quote", text: "Front brake pads and discs, supply and fit", price: String(120n * M), status: "approved", paid: String(120n * M), asked_at: 1000, approved_at: 0 },
      { line: 2, kind: "quote", text: "Brake fluid change, DOT 4", price: String(20n * M), status: "approved", paid: String(20n * M), asked_at: 1000, approved_at: 0 },
      { line: 3, kind: "quote", text: "Labour: fit front pads and discs and bleed the brakes, 2 hours", price: String(80n * M), status: "approved", paid: String(60n * M), asked_at: 1000, approved_at: 0 },
      { line: 4, kind: "extra", text: "Front wiper blades, pair, supply and fit", price: String(15n * M), status: "approved", paid: String(15n * M), asked_at: 1200, approved_at: 1300 },
    ],
    invoice: [
      ["covered", 1, "Replaced front brake discs and pads", 120n, 120n, 0n],
      ["covered", 2, "Brake fluid flush and refill, DOT 4", 30n, 20n, 0n],
      ["covered", 3, "Labour fitting the front pads and discs and bleeding the brakes, 1.5 hours", 60n, 60n, 0n],
      ["covered", 4, "Fitted new front wiper blades", 15n, 15n, 0n],
      ["not_covered", 3, "Replaced cabin filter", 25n, 0n, 5n],
      ["unclear", 3, "Sundries", 10n, 0n, 0n],
    ].map(([verdict, bills, text, price, paid, penalty], k) => ({
      line: k + 1, bills, text, price: String(price * M), verdict, paid: String(paid * M), penalty: String(penalty * M), why: "",
      rebill_text: "", rebill_price: "0", rebill_verdict: "", rebill_paid: "0", rebill_penalty: "0",
    })),
    now: 2500, acceptable: false, invoiceable: false, reclaimable: false, rebillable: true, customer_may_settle: false,
    ...over,
  };
}
