"use client";

// The frame of every page: the pegboard header with the mark, the five places, and the wallet (or, in
// mock mode, the yellow-and-black mock bar); the footer with the register and its source.

import Link from "next/link";
import { usePathname } from "next/navigation";
import * as React from "react";

import { Logo } from "@/components/logo";
import { MockBar } from "@/components/mock-bar";
import { WalletButton, WrongChainBanner } from "@/components/wallet";
import { addressUrl, contractInUse, hasContract, isMock } from "@/lib/chain";
import { REPO_URL } from "@/lib/config";
import { cx } from "@/lib/cx";

const NAV = [
  { href: "/", label: "Start" },
  { href: "/mine", label: "My jobs" },
  { href: "/garage", label: "Garage" },
  { href: "/ledger", label: "Ledger" },
  { href: "/how", label: "How it works" },
];

export function AppFrame({ children }: { children: React.ReactNode }) {
  const path = usePathname() || "/";
  const here = (href: string) => (href === "/" ? path === "/" : path.startsWith(href));
  return (
    <>
      {isMock && <MockBar />}
      <header className="border-b border-black/50 bg-wall-2/90 shadow-[0_3px_0_#111]">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2.5">
          <Link href="/" className="flex items-center gap-2 text-card-2">
            <Logo size={38} />
            <span className="head text-[28px] leading-none font-extrabold tracking-[0.12em] uppercase">Garage</span>
          </Link>
          {!isMock && <WalletButton />}
        </div>
        <nav aria-label="Pages" className="mx-auto max-w-[1100px] px-2">
          <ul className="flex flex-wrap">
            {NAV.map((n) => (
              <li key={n.href}>
                <Link
                  href={n.href}
                  aria-current={here(n.href) ? "page" : undefined}
                  className={cx("head block border-b-4 px-2.5 py-1.5 text-[15px] font-bold tracking-wider uppercase", here(n.href) ? "border-safety text-card-2" : "border-transparent text-steel hover:text-card-2")}
                >
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      {!isMock && <WrongChainBanner />}
      <main id="main" className="mx-auto w-full max-w-[1100px] px-4 pt-8 pb-16">
        {children}
      </main>
      <footer className="border-t border-black/50 bg-wall-2/90 text-[13px] text-steel">
        <div className="mx-auto flex max-w-[1100px] flex-col gap-1 px-4 py-4 sm:flex-row sm:justify-between">
          <p>
            GenLayer Intelligent Contract on Studio (chain 61999).{" "}
            {hasContract() && !isMock ? (
              <a href={addressUrl(contractInUse())} target="_blank" rel="noreferrer" className="mono link break-all text-card-2">
                {contractInUse()}
              </a>
            ) : isMock ? (
              "Mock build: no register."
            ) : (
              "The register is not deployed yet."
            )}
          </p>
          {REPO_URL && (
            <a href={REPO_URL} target="_blank" rel="noreferrer" className="link text-card-2">
              Source
            </a>
          )}
        </div>
      </footer>
    </>
  );
}
