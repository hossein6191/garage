"use client";

// The waiting panel: a work-order tag pinned beside the job, saying what is happening now, then four
// short lines (how long, what is needed from you, whether you can leave, where the money is), a counter,
// and the next button when there is one. The words come from lib/guide.ts.

import * as React from "react";

import { IconCheck, IconClock, IconHand, IconSpanner } from "@/components/icons";
import { useWallNow } from "@/components/use-now";
import { cx } from "@/lib/cx";
import type { Guide, GuideTone } from "@/lib/guide";

/** "0:42", "12:05", "1:02:09"; longer than a day, "2 d 3 h". */
export function clockText(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const d = Math.floor(s / 86400);
  if (d > 0) {
    const h = Math.floor((s % 86400) / 3600);
    return h ? `${d} d ${h} h` : `${d} d`;
  }
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const BAND: Record<GuideTone, string> = {
  busy: "bg-ink text-card-2",
  clock: "bg-wall-3 text-card-2",
  act: "bg-safety text-ink",
  done: "bg-ok text-card-2",
};

export function WaitPanel({ guide, since, left, action, className }: { guide: Guide; since?: number; left?: number; action?: React.ReactNode; className?: string }) {
  const ref = React.useRef<HTMLDivElement>(null);
  const wall = useWallNow();
  React.useEffect(() => {
    const el = ref.current;
    if (guide.tone !== "busy" || !el || typeof el.scrollIntoView !== "function") return;
    const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    el.scrollIntoView({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
  }, [guide.id, guide.tone]);

  const remaining = left ?? guide.left;
  const counter =
    remaining !== undefined && remaining > 0 ? { text: clockText(remaining), label: guide.leftLabel ?? "left" } : since && wall ? { text: clockText(wall - since), label: "so far" } : null;

  return (
    <section ref={ref} data-wait={guide.id} className={cx("sheet scroll-mt-4 scroll-mb-4 overflow-hidden", className)}>
      <div className={cx("flex items-center justify-between gap-3 px-4 py-1.5", BAND[guide.tone])}>
        <p className="head flex items-center gap-1.5 text-[13px] font-bold tracking-[0.14em] uppercase">
          {guide.tone === "done" ? <IconCheck size={15} /> : guide.tone === "act" ? <IconHand size={15} /> : guide.tone === "busy" ? <IconSpanner size={15} className="wrench-busy" /> : <IconClock size={15} />}
          {guide.kicker}
        </p>
        {counter && (
          <p className="mono text-[15px] font-semibold whitespace-nowrap">
            {counter.text} <span className="head text-[11px] tracking-widest uppercase opacity-80">{counter.label}</span>
          </p>
        )}
      </div>
      <div className="px-4 pt-2.5 pb-3.5" role="status" aria-live="polite" aria-atomic="true">
        <p className="head text-[21px] leading-tight font-bold">{guide.now}</p>
        <dl className="mt-2 grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 text-[14.5px] leading-[1.45]">
          <Row label="How long">{guide.time}</Row>
          <Row label="From you" strong={guide.mustAct}>
            {guide.need}
          </Row>
          <Row label="Leave?" warn={!guide.canLeave}>
            {guide.leave}
          </Row>
          <Row label="Money">{guide.money}</Row>
        </dl>
        {action && <div className="mt-3 flex flex-wrap items-center gap-2">{action}</div>}
      </div>
    </section>
  );
}

function Row({ label, children, strong, warn }: { label: string; children: React.ReactNode; strong?: boolean; warn?: boolean }) {
  return (
    <>
      <dt className="form-label border-t border-dashed border-rule pt-1.5 pb-1 whitespace-nowrap">{label}</dt>
      <dd className={cx("min-w-0 border-t border-dashed border-rule pt-1.5 pb-1", strong ? "font-semibold text-ink" : warn ? "font-semibold text-no" : "text-ink-2")}>{children}</dd>
    </>
  );
}
