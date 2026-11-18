"use client";

// Mock mode only. No wallet and no chain: the visitor acts as one of two customers of the in-memory
// contract. This bar says so on every page, lets them change account, gives test GEN, and moves the
// clock on so a deadline can be seen running out.

import { useLocal } from "@/components/use-local";
import { PERSONAS, advanceClock, mockAddress, mockBalanceText, mockClockOffset, setMockPersona } from "@/lib/chain-mock";
import { faucet } from "@/lib/chain";
import { gen, span } from "@/lib/format";

const small = "head h-8 border-2 border-ink bg-card-2 px-2 text-xs font-bold uppercase tracking-wider hover:bg-card active:translate-y-px";

export function MockBar() {
  const address = useLocal(mockAddress, PERSONAS[0].address);
  const balance = useLocal(() => mockBalanceText(mockAddress()), "0");
  const offset = useLocal(mockClockOffset, 0);
  return (
    <div className="border-b-4 border-ink bg-[repeating-linear-gradient(135deg,#e8b923_0_14px,#221e19_14px_28px)] p-1">
      <div className="mx-auto flex max-w-[1100px] flex-col gap-2 bg-card-2 px-3 py-2 text-xs lg:flex-row lg:items-center lg:justify-between">
        <p className="min-w-0">
          <strong className="head font-bold uppercase">Mock build.</strong> An in-memory copy of the contract; no model is asked. A line is judged by the words it shares with the approved line. On chain every
          validator asks its own model, twice. A reload starts again.
        </p>
        <div className="flex min-w-0 flex-wrap items-center gap-1.5">
          <label htmlFor="mock-persona" className="head shrink-0 font-bold uppercase">
            Acting as
          </label>
          <select id="mock-persona" value={address} onChange={(e) => setMockPersona(e.target.value)} className="h-8 max-w-full min-w-0 border-2 border-ink bg-card-2 px-1 text-xs">
            {PERSONAS.map((p) => (
              <option key={p.address} value={p.address}>
                {p.name}: {p.note}
              </option>
            ))}
          </select>
          <span className="mono whitespace-nowrap">{gen(balance)}</span>
          <button type="button" onClick={() => void faucet(address)} className={small}>
            +10 GEN
          </button>
          <button type="button" onClick={() => advanceClock(3600)} className={small}>
            Clock +1 h
          </button>
          <button type="button" onClick={() => advanceClock(86400)} className={small}>
            +1 day
          </button>
          {offset > 0 && <span className="text-ink-2">clock moved on {span(offset)}</span>}
        </div>
      </div>
    </div>
  );
}
