// A rubber-stamp verdict: COVERED in green, NOT in red, UNCLEAR in amber, pressed a little crooked.

import { cx } from "@/lib/cx";
import type { Stamp as StampT } from "@/lib/verdict";

export function Stamp({ stamp, size = "md", fresh, className }: { stamp: StampT; size?: "sm" | "md" | "lg"; fresh?: boolean; className?: string }) {
  return (
    <span
      title={stamp.hint}
      className={cx("stamp", `stamp-${stamp.tone}`, fresh && "stamp-new", size === "sm" ? "text-[13px]" : size === "lg" ? "text-[30px]" : "text-[19px]", className)}
    >
      {stamp.word}
    </span>
  );
}
