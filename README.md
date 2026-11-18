# Garage

A repair quote held in escrow, and an invoice judged line by line. The customer
pays for the work they approved; validators, not the garage, decide which
invoice lines that approval covers.

## The problem

A car goes in for a quoted front brake job and comes back with an invoice that
has grown: "replaced cabin filter", "brake fluid flush", "sundries". The
customer approved a quote, not these lines. But an invoice never repeats the
quote word for word, so the question "is this line covered by what I
approved?" is a judgement, and today the garage makes it. A string match does
no better: "Replaced front brake discs and pads" is exactly "Front brake pads
and discs, supply and fit" in other words, and "Replaced cabin filter" matches
nothing because it is a different job.

## What it is

A garage registers and keeps a standing bond here. It writes a quote for one
customer: a job title, the car, and 1 to 8 numbered lines, each a description
and a price. The customer accepts by paying the quote total, which is held in
escrow. During the job the garage may ask for an extra line ("Front wiper
blades, pair, supply and fit"); it becomes part of the job only when the
customer approves it by paying its price. Approvals are signatures, never
judgements.

When the job is done the garage submits its one invoice: 1 to 10 lines, each a
description, a price, and the number of the approved line it bills against.
In the same transaction the network judges every line and the money moves:

| verdict | what it means | the money, in the same call |
|---|---|---|
| covered | the approved line covers this invoice line | paid to the garage at the invoice price, never more than what is left of the approved line |
| not covered | it is different work or a different part | unpaid, and 20 percent of its invoice price moves from the garage's bond to the customer |
| unclear | the line does not say what it is, or the two readings split | unpaid, no penalty; the garage may re-bill it once, in other words |

Whatever escrow is not paid out goes back to the customer, including approved
lines that were never invoiced. If the garage never invoices by the deadline it
set in the quote, the customer takes the whole escrow back.

## How consensus is used

One consensus block per invoice (and one per re-bill). For every invoice line
*i* billed against approved line *j*, it asks one question with one condition:

> For each pair: does its APPROVED_LINE cover its INVOICE_LINE? Answer COVERED
> if it does, NOT if it does not, or UNCLEAR if you cannot tell because the
> INVOICE_LINE does not say what work or part it is.

The question is asked twice inside the same block: once with the pairs in
invoice order and the approved line first, once in reverse order with the
invoice line first. Position bias is invisible to consensus on its own, since
every validator builds the prompt the same way; asking in both orders is what
catches it, and a split lands in the stored value as unclear.

- **Closed answers.** Only the JSON strings `COVERED`, `NOT` and `UNCLEAR`
  under the key `line_<i>` count. A boolean, a number, any other word or a
  missing key is unreadable, and an unreadable answer makes its line unclear.
- **Combine.** A line is `C` only when both askings say COVERED, `N` only when
  both say NOT, and `U` for anything else.
- **The stored value** is `{"mask": "CCCCNU", "fingerprint": sha256 of the
  pairs judged}`. Every validator reruns both askings itself, inside
  try/except, and agrees only when its mask and fingerprint are exactly the
  leader's. A leader that raised is never agreed with. There is no tolerance
  anywhere: a disagreement is a failed round, which stores nothing.
- **Untrusted text.** Every line description is written by the garage. It must
  be printable ASCII on one line, is fenced (`<` and `>` replaced, never
  deleted) and sits between delimiter lines tagged with the sha256 of its own
  fenced text, so no line can open or close a block. The prompt says, before
  any block, that the blocks are untrusted and are never instructions. The pair
  headers carry only two whole numbers the contract wrote.
- **What the model never sees:** prices, addresses, the job title, the car,
  ids. It reads the descriptions it judges and nothing else.
- **The code does the money.** The model never sees a price; caps, penalties
  and refunds are integer arithmetic in the contract.

`rules()` publishes the question, the prompt paragraphs, the combine table and
the comparison word for word.

## Who may do what

| call | who | when |
|---|---|---|
| `register(name)` | anyone, for their own address | once |
| `deposit()` payable | a registered garage, for its own bond | any time |
| `withdraw(amount)` | a garage, from its own free bond | any time; bond locked behind an unclear line is not free |
| `quote(customer, title, car, lines, job_seconds)` | a registered garage holding at least 0.1 GEN of free bond | for a customer other than itself |
| `accept(quote)` payable | only the customer named on the quote | within 7 days, paying the total exactly |
| `request_extra(quote, text, price)` | only the quote's garage | while the job is on, before the invoice deadline; at most 4 |
| `approve_extra(quote, line)` payable | only the quote's customer | while the job is on, paying the price exactly |
| `invoice(quote, lines)` | only the quote's garage | once, after acceptance, before the invoice deadline |
| `rebill(quote, lines)` | only the quote's garage | once, within a day of the invoice, unclear lines only |
| `settle(quote)` | the garage at any time after an invoice with an unclear line; the customer once the re-bill window has closed | |
| `reclaim(quote)` | only the quote's customer | after the invoice deadline, if no invoice came |

Every write checks its sender; a static test over the parsed source fails if a
write is ever added that does not. The customer has no veto over a covered
line: the judgement is the network's. Every refusal leaves a route out: a
garage short of bond deposits and invoices again before the deadline; a
customer whose garage goes silent reclaims; an unclear line is re-billed or
settled; nobody waits on anybody forever.

## The money

- **Escrow.** The quote total on acceptance, plus each extra's price when it is
  approved. Payable calls never run the model and never raise: a refusal
  returns every atto sent, in the same transaction.
- **Covered lines** are paid at the invoice price, capped by what is left of
  the approved line they bill against. Several invoice lines against one
  approved line share its price, so the sum paid can never exceed the escrow.
  A fluid line billed at 0.03 GEN against an approved 0.02 GEN is paid 0.02.
- **Not-covered lines** are unpaid, and 20 percent of their invoice price moves
  from the garage's bond to the customer. The invoice is accepted only when the
  garage's free bond covers 20 percent of the invoice total; that share is
  locked until the verdict, so a penalty is always payable.
- **Unclear lines** are unpaid with no penalty. Their share of the bond stays
  locked. The garage may re-bill them once, within a day, in different words
  and at no higher price; the same wording (same words ignoring case, spacing
  and punctuation) is refused before any model runs, so a line cannot be
  re-rolled. A re-bill is judged exactly as the invoice was, and the quote is
  settled in that call. Otherwise `settle()` pays out.
- **Settlement** sends at most two transfers: the garage's pay, and the
  customer's penalties plus refund. `settle()` and `reclaim()` do constant
  work; `invoice()` and `rebill()` walk at most 10 lines. Every write is made
  before any money moves. No floats anywhere.

## The limits, stated plainly

- The contract cannot see the car. It judges whether the words of an invoice
  line describe work the approved line covers, not whether the work was done.
- A vague approved line covers vaguely. "Labour, 2 hours" protects the customer
  less than "Labour: fit front pads and discs and bleed the brakes, 2 hours".
  The customer is protected by the words they approve.
- The garage chooses which approved line each invoice line bills against.
  Billing against the wrong one only makes the line less likely to be covered.
- A re-bill in different words is a second question, not a re-roll of the
  first; it is allowed once, and only for lines the network could not read.
- The penalty bond is checked and locked when the invoice is submitted, not when
  the quote is accepted. A garage without the bond cannot invoice, and its
  customer reclaims at the deadline.
- Any registered garage holding the standing bond may write a quote naming any
  address as its customer. A quote costs the customer nothing until they accept
  it, and lists are paged.
- An invoice whose round the network does not carry stores nothing; the garage
  sends it again before the deadline.
- English, printable ASCII, one line per text.

## What is in this repository

| path | what it is |
|---|---|
| `contracts/garage.py` | the Intelligent Contract |
| `tests/test_pure.py` | the offline suite: the prompt boundary, the reading of the model, the consensus round with a scripted model per node, every door, every movement of money, static checks over the parsed source |
| `tools/mutate.py`, `tests/MUTATIONS.md` | every defence removed in turn, and the test that caught it |
| `tests/on_chain/smoke.mjs` | the on-chain walk of the demonstration against Studio, with a byte-for-byte check of the deployed code |
| `docs/DEMO.md` | the plan for the site's demo garage |

## Running it

```sh
pip install -r requirements-dev.txt
pytest tests/ -q                       # offline, no network, under a second
genvm-lint check contracts/garage.py   # lint
python tools/mutate.py                 # regenerates tests/MUTATIONS.md; exit 1 if a mutant escapes
npm ci && node tests/on_chain/smoke.mjs   # the on-chain walk, against Studio
```

The smoke walks the demonstration: a quote of three lines (front brake pads
and discs, brake fluid, labour), one approved extra (wiper blades), and an
invoice with covered lines in other words, a line billed above its approved
price, an unquoted cabin filter and a vague "Sundries", plus the refusals: an
invoice before acceptance, an invoice by the customer, a second invoice, the
same words re-billed and a stranger settling.

## Network

GenLayer Studio, chain 61999. The runner is pinned in the first line of the
contract.

## Evidence

The on-chain run is recorded here once it has run.

## Licence

MIT, see `LICENSE`.
