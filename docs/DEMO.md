# Demo garage: a plan

The site lets a visitor play the customer and walk the whole flow alone. A demo
bot plays the garage from the server, with its own key, so no visitor ever
waits on the author.

## The bot

- **Key.** One server-side key (`DEMO_GARAGE_KEY`), never sent to the browser.
  The bot's address is registered once as "Demo Motors" and keeps a standing
  bond of about 1 GEN; `/api/demo/status` reports `online` only when the key is
  set, the address is registered and its free bond is at least the standing
  minimum plus a few invoices' penalty share.
- **Endpoints.** `POST /api/demo/quote` (the visitor's address; the bot writes
  the demonstration quote naming them as customer), `POST /api/demo/extra`
  (the bot asks for the wiper blades), `POST /api/demo/invoice` and
  `POST /api/demo/rebill`. Each one checks the chain state first and does
  nothing unless it is the bot's turn on that visitor's quote.
- **Limits.** One open quote per visitor address and per client IP at a time,
  a few per day; the visitor pays only for what they choose to accept, in
  Studio GEN.
- **Script.** The bot always says the same words, the demonstration of the
  smoke: three lines (front brake pads and discs, brake fluid, labour), the
  wiper blades as an extra, and the six-line invoice with the fluid billed
  above its price, the cabin filter and "Sundries". The visitor chooses only
  whether to approve the extra. If the extra is not approved, the bot leaves
  the wiper line out of the invoice, so every line it bills is approved.
  After an unclear "Sundries", the visitor may press "Ask the garage to
  re-bill"; the bot re-bills it once as "Brake cleaner spray used bleeding the
  brakes" (new words, no higher price), or the visitor waits for the window or
  the bot settles.

## The visitor's walk

1. Connect a wallet; the site asks the bot for a quote. Waiting panel: "Demo
   Motors is writing your quote on chain, about a minute. Nothing is needed from
   you and no money has moved; you can leave and it will be under My jobs."
2. Read the quote and accept it by paying 0.22 GEN. Wallet prompt, then: "Your
   0.22 GEN is held by the contract, not the garage."
3. The bot asks for the extra. Approve it (0.015 GEN) or ignore it.
4. The bot invoices. Waiting panel during the round: "Validators are reading
   each invoice line against the line you approved, 1 to 5 minutes. Nothing is
   needed from you; your money is still held by the contract and moves only
   when they agree."
5. The verdict: each line with covered / not covered / unclear, what was paid,
   the penalty paid to you, what is held, and the re-bill countdown.
6. The end: settled, with the refund in the visitor's wallet and links to every
   transaction in the explorer.

Every in-between state gets one panel answering what is happening and who it
waits for, how long, whether anything is needed now, whether the visitor can
leave and where things will be, and where the money is (a pure helper:
state + role + clock to those lines, unit-tested per state and role).

## Routes out, shown on the site

- The bot is offline: the site says so before any payment, and an accepted
  quote with no invoice shows the reclaim countdown and the button.
- An invoice round the network did not carry: the bot sends it again; the
  panel says so.
