// The job card: the quote as the customer approved it, every extra asked for, and the invoice with a
// stamp on each line, then the money box. Printed on buff card stock; the lines are in the garage's
// carbon-copy hand, the amounts in mono. Nothing here signs; components/job-actions.tsx does.

import { IconTorque } from "@/components/icons";
import { Stamp } from "@/components/stamp";
import { cx } from "@/lib/cx";
import { big, gen, short, when } from "@/lib/format";
import { receiptOf } from "@/lib/money";
import type { ApprovedLine, InvoiceLine, Quote } from "@/lib/types";
import { lineView, maskSummary } from "@/lib/verdict";

const LINE_STATUS: Record<ApprovedLine["status"], { word: string; cls: string }> = {
  quoted: { word: "Quoted", cls: "border-ink-3 text-ink-2" },
  approved: { word: "Approved", cls: "border-ok text-ok" },
  pending: { word: "Asked, not approved", cls: "border-amber text-amber" },
  lapsed: { word: "Never approved", cls: "border-ink-3 text-ink-3 line-through" },
};

export function JobCard({ q, garageName, fresh }: { q: Quote; garageName?: string; fresh?: boolean }) {
  const r = receiptOf(q);
  const invoiced = q.invoice.length > 0;
  return (
    <article className="sheet hook px-4 pt-6 pb-5 sm:px-6" aria-label={`Job card ${q.id}`}>
      <header className="flex items-start justify-between gap-3 border-b-2 border-ink pb-2">
        <div className="min-w-0">
          <p className="form-label">Job card · {garageName || short(q.garage)}</p>
          <h1 className="head text-[34px] leading-none font-extrabold tracking-wide uppercase sm:text-[44px]">
            No. <span className="mono text-[30px] font-semibold sm:text-[38px]">{q.id}</span>
          </h1>
        </div>
        <IconTorque size={44} className="mt-1 shrink-0 text-ink-3" />
      </header>

      <dl className="mt-3 grid grid-cols-1 gap-x-5 gap-y-1.5 text-[14.5px] sm:grid-cols-2">
        <Field label="Job">{q.title}</Field>
        <Field label="Vehicle">{q.car}</Field>
        <Field label="Customer">
          <span className="mono text-[13px]">{short(q.customer)}</span>
        </Field>
        <Field label="Written">{when(q.createdAt) || "—"}</Field>
      </dl>

      <section className="mt-5" aria-label="Work approved">
        <h2 className="form-label border-b border-rule pb-1">Work approved · the customer pays only for these words</h2>
        <ol className="ruled">
          {q.approved.map((a) => (
            <li key={a.line} className="grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-2 border-b border-rule/60 py-2">
              <span className="mono text-[13px] text-ink-3">{a.line}.</span>
              <span className="min-w-0">
                <span className="hand block text-[19px]">{a.text}</span>
                <span className={cx("head mt-0.5 inline-block border px-1.5 text-[11px] font-bold tracking-wider uppercase", LINE_STATUS[a.status].cls)}>
                  {a.kind === "extra" ? "Extra · " : ""}
                  {LINE_STATUS[a.status].word}
                </span>
              </span>
              <span className="mono text-right text-[14.5px]">{gen(a.priceAtto)}</span>
            </li>
          ))}
        </ol>
        <p className="mt-1.5 flex justify-between border-t-2 border-ink pt-1 text-[14.5px]">
          <span className="form-label self-center">Quote total</span>
          <span className="mono font-semibold">{gen(q.totalAtto)}</span>
        </p>
      </section>

      <section className="mt-6" aria-label="Invoice">
        <h2 className="form-label flex flex-wrap justify-between gap-x-3 border-b border-rule pb-1">
          <span>Invoice · judged line by line</span>
          {invoiced && <span className="text-ink-2">{maskSummary(q.mask)}</span>}
        </h2>
        {!invoiced ? (
          <p className="py-3 text-[14.5px] text-ink-3 italic">No invoice yet. When the garage sends one, every line is judged against the approved line it bills, and the stamps land here.</p>
        ) : (
          <ol>
            {q.invoice.map((l) => (
              <InvoiceRow key={l.line} l={l} approved={q.approved.find((a) => a.line === l.bills)} fresh={fresh} />
            ))}
          </ol>
        )}
      </section>

      <section className="mt-6 border-2 border-ink p-3" aria-label="The money">
        <h2 className="form-label">The money</h2>
        <dl className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] gap-x-3 gap-y-1 text-[14.5px]">
          <Money label="Paid in by the customer (escrow)" v={r.escrow} />
          <Money label="Paid to the garage, covered lines" v={r.toGarage} />
          <Money label="From the garage's bond to the customer, 20% of each NOT line" v={r.penalties} tone={r.penalties > 0n ? "text-no" : ""} />
          <Money label="Escrow back to the customer" v={r.refund} />
          <Money label="Still held by the contract" v={r.held} strong={r.held > 0n} />
          {big(q.lockAtto) > 0n && <Money label="Garage bond locked behind unclear lines" v={big(q.lockAtto)} />}
        </dl>
        {(q.status === "settled" || q.status === "reclaimed") && (
          <p className="mt-2 border-t border-dashed border-rule pt-2 text-[14.5px]">
            The job cost the customer <strong className="mono">{gen(r.net)}</strong> net: {gen(r.escrow)} paid in, less {gen(r.refund)} back and {gen(r.penalties)} in penalties.
          </p>
        )}
        {!r.balanced && <p className="mt-2 text-xs text-no">The figures read do not add up; the register may be mid-update. Reload in a moment.</p>}
      </section>
    </article>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex min-w-0 items-baseline gap-2 border-b border-dotted border-rule">
      <dt className="form-label shrink-0">{label}</dt>
      <dd className="min-w-0 truncate">{children}</dd>
    </div>
  );
}

function Money({ label, v, tone, strong }: { label: string; v: bigint; tone?: string; strong?: boolean }) {
  return (
    <>
      <dt className="min-w-0 text-ink-2">{label}</dt>
      <dd className={cx("mono text-right", tone, strong && "font-semibold")}>{gen(v)}</dd>
    </>
  );
}

function InvoiceRow({ l, approved, fresh }: { l: InvoiceLine; approved?: ApprovedLine; fresh?: boolean }) {
  const v = lineView(l);
  return (
    <li className="border-b border-rule/60 py-3">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] gap-x-2 sm:grid-cols-[2rem_minmax(0,1fr)_auto_8.5rem]">
        <span className="mono pt-1 text-[13px] text-ink-3">{l.line}.</span>
        <div className="min-w-0">
          <p className={cx("hand text-[19px]", v.rebill && "line-through decoration-ink-3/60")}>{l.text}</p>
          <p className="text-[12.5px] text-ink-3">
            billed against approved line {l.bills}
            {approved ? (
              <>
                : <span className="italic">{approved.text}</span>
              </>
            ) : null}
          </p>
          {v.rebill && (
            <p className="mt-1">
              <span className="form-label mr-1">Re-billed as</span>
              <span className="hand text-[19px]">{l.rebillText}</span> <span className="mono text-[13px]">{gen(l.rebillPriceAtto)}</span>
            </p>
          )}
        </div>
        <div className="col-start-2 mt-1.5 flex items-center justify-between gap-3 sm:col-start-auto sm:mt-0 sm:block sm:text-right">
          <span className="mono text-[14.5px]">{gen(l.priceAtto)}</span>
        </div>
        <div className="col-start-2 mt-1 flex flex-wrap items-center gap-2 sm:col-start-auto sm:mt-0 sm:flex-col sm:items-end">
          {v.rebill && <Stamp stamp={v.first} size="sm" className="opacity-50" />}
          <Stamp stamp={v.final} fresh={fresh} />
        </div>
      </div>
      <p className={cx("mt-1.5 ml-[2.5rem] text-[13.5px]", v.final.tone === "covered" ? "text-ok" : v.final.tone === "not" ? "text-no" : "text-amber")}>{v.money}</p>
    </li>
  );
}
