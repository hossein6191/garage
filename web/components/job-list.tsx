// A rack of job tickets: one row per quote, with its status, its money and a small stamp per judged line.

import Link from "next/link";

import { cx } from "@/lib/cx";
import { gen, short } from "@/lib/format";
import type { QuoteRow } from "@/lib/types";
import { letterVerdict, stampOf } from "@/lib/verdict";

const STATUS: Record<QuoteRow["status"], string> = { quoted: "Quoted", accepted: "Job on", invoiced: "Judged, open", settled: "Settled", reclaimed: "Reclaimed" };

export function JobList({ rows, empty, showRole }: { rows: QuoteRow[]; empty: string; showRole?: boolean }) {
  if (!rows.length) return <p className="sheet-plain px-4 py-3 text-[14.5px] text-ink-2">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.id}>
          <Link href={`/job/${r.id}`} className="sheet-plain group grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1 px-3 py-2.5 hover:bg-card-2 sm:grid-cols-[auto_minmax(0,1fr)_auto]">
            <span className="mono row-span-2 self-center border-r-2 border-dashed border-rule pr-3 text-[18px] font-semibold">{r.id}</span>
            <span className="min-w-0">
              <span className="head block truncate text-[18px] font-bold uppercase group-hover:underline">{r.title}</span>
              <span className="block truncate text-[13px] text-ink-3">
                {r.car}
                {showRole && r.role ? ` · you are the ${r.role}` : ` · customer ${short(r.customer)}`}
              </span>
            </span>
            <span className="flex flex-wrap items-center gap-x-3 gap-y-1 sm:row-span-2 sm:justify-end">
              <span className={cx("head border-2 px-1.5 text-[12px] font-bold tracking-wider uppercase", r.status === "settled" || r.status === "reclaimed" ? "border-ok text-ok" : "border-ink-3 text-ink-2")}>{STATUS[r.status]}</span>
              <span className="mono text-[13.5px]">{gen(r.totalAtto)}</span>
            </span>
            {r.mask && (
              <span className="col-start-2 flex flex-wrap gap-1" aria-label={`verdicts ${r.mask}`}>
                {Array.from(r.mask).map((c, i) => {
                  const s = stampOf(letterVerdict(c));
                  return (
                    <span key={i} title={s.word} className={cx("stamp text-[10px]", `stamp-${s.tone}`)}>
                      {c === "C" ? "COV" : c === "N" ? "NOT" : "UNC"}
                    </span>
                  );
                })}
              </span>
            )}
          </Link>
        </li>
      ))}
    </ul>
  );
}
