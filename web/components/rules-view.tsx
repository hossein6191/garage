"use client";

// rules() word for word: read from the register itself, or, while none is set (and in mock mode), the
// copy in lib/contract-rules.ts, marked as a copy.

import { useRead } from "@/components/use-read";
import { hasContract, isMock, readRules } from "@/lib/chain";
import { RULES_COPY } from "@/lib/contract-rules";

const ORDER: [string, string][] = [
  ["question", "The question"],
  ["answers", "The three answers"],
  ["askings", "The two askings"],
  ["prompt", "The prompt, paragraph by paragraph"],
  ["reading", "Reading an answer"],
  ["combine", "Combining the two askings"],
  ["value", "The stored value"],
  ["compared", "What validators compare"],
  ["not_asked", "What the model never sees"],
  ["untrusted", "Untrusted text"],
  ["money", "The money"],
  ["who", "Who may do what"],
  ["no_veto", "No veto"],
  ["settlement", "Bounded work"],
  ["limits", "The limits"],
];

function Value({ v }: { v: unknown }) {
  if (typeof v === "string") return <p className="text-[15px] leading-relaxed">{v}</p>;
  if (typeof v === "number" || typeof v === "boolean") return <p className="mono">{String(v)}</p>;
  if (Array.isArray(v))
    return (
      <ul className="list-disc pl-5 text-[15px] leading-relaxed">
        {v.map((x, i) => (
          <li key={i}>{typeof x === "string" ? x : JSON.stringify(x)}</li>
        ))}
      </ul>
    );
  if (v && typeof v === "object")
    return (
      <dl className="grid gap-x-4 gap-y-1.5 sm:grid-cols-[minmax(0,11rem)_minmax(0,1fr)]">
        {Object.entries(v as Record<string, unknown>).map(([k, x]) => (
          <div key={k} className="contents">
            <dt className="mono text-[13px] font-semibold break-words text-ink-2">{k}</dt>
            <dd className="min-w-0 border-b border-dashed border-rule pb-1.5 text-[15px] leading-relaxed">{typeof x === "string" ? x : JSON.stringify(x)}</dd>
          </div>
        ))}
      </dl>
    );
  return null;
}

export function RulesView() {
  const live = useRead(readRules, ["rules"], { enabled: hasContract() && !isMock });
  const rules = live.data ?? RULES_COPY;
  const copy = !live.data;
  return (
    <div className="flex flex-col gap-3">
      <p className="text-[13.5px] text-card-3">
        {copy
          ? live.loading
            ? "Reading rules() from the register… shown meanwhile: the copy kept with the site, checked against the contract's source by the tests."
            : "Shown: the copy of rules() kept with the site, checked against the contract's source by the tests. The register itself answers the same."
          : "Read just now from rules() on the register."}
      </p>
      {ORDER.filter(([k]) => k in rules).map(([k, title]) => (
        <section key={k} className={k === "question" ? "sheet px-4 py-4 sm:px-6" : "sheet-plain px-4 py-3 sm:px-5"}>
          <h3 className="form-label mb-1.5">
            {title} <span className="mono normal-case">· {k}</span>
          </h3>
          {k === "question" ? <p className="hand text-[24px] leading-snug">{String(rules[k])}</p> : <Value v={rules[k]} />}
        </section>
      ))}
    </div>
  );
}
