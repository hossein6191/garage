"use client";

// The one button of the site: a square safety-orange lever with a heavy edge that pushes in. Three
// colours: safety (the thing to do), ok (money coming to you), plain (everything else).

import * as React from "react";
import Link from "next/link";

import { cx } from "@/lib/cx";

type Variant = "safety" | "ok" | "plain";
type Common = { variant?: Variant; size?: "sm" | "md"; block?: boolean; icon?: React.ReactNode; className?: string; children: React.ReactNode };

const classes = (variant: Variant, size: "sm" | "md", block?: boolean, className?: string) =>
  cx("btn", variant !== "safety" && `btn-${variant}`, size === "sm" && "btn-sm", block && "btn-block", className);

export function Button({ variant = "safety", size = "md", block, icon, className, children, type = "button", ...rest }: Common & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className">) {
  return (
    <button type={type} className={classes(variant, size, block, className)} {...rest}>
      {icon}
      <span>{children}</span>
    </button>
  );
}

export function ButtonLink({ variant = "safety", size = "md", block, icon, className, children, href }: Common & { href: string }) {
  return (
    <Link href={href} className={classes(variant, size, block, className)}>
      {icon}
      <span>{children}</span>
    </Link>
  );
}
