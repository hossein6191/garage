import { ImageResponse } from "next/og";

import { AMBER, CARBON, CARD, INK, NO, OK, SAFETY, WALL, markDataUri } from "@/lib/mark";
import { cardFonts } from "@/lib/og-fonts";

export const alt = "Garage: a repair quote held in escrow, and an invoice judged line by line by GenLayer's validators.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

const HEAD = "GARAGE";
const LINE = "YOU PAY FOR THE WORK YOU APPROVED";
const ROWS: [string, string, string][] = [
  ["Replaced front brake discs and pads", "COVERED", OK],
  ["Replaced cabin filter", "NOT", NO],
  ["Sundries", "UNCLEAR", AMBER],
];

// The share card: the pegboard wall, the mark and the promise on the left, a job card pinned on the
// right with three handwritten invoice lines and their rubber stamps.
export default async function OpenGraphImage() {
  const fonts = await cardFonts(HEAD + LINE + "COVEREDNOTUNCLEARINVOICEGenLayerStudio·", ROWS.map((r) => r[0]).join(""));
  const head = fonts.length ? "Barlow Condensed" : "sans-serif";
  const hand = fonts.length ? "Kalam" : "sans-serif";
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", backgroundColor: WALL, fontFamily: head, position: "relative" }}>
        <div style={{ display: "flex", flexDirection: "column", padding: "70px 0 0 70px", width: 520 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <img src={markDataUri()} width={96} height={96} alt="" />
            <div style={{ fontSize: 96, fontWeight: 800, color: CARD, letterSpacing: 8 }}>{HEAD}</div>
          </div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 60, fontWeight: 800, lineHeight: 1, color: CARD }}>{LINE}</div>
          <div style={{ display: "flex", marginTop: 34, fontSize: 28, fontWeight: 800, color: SAFETY, letterSpacing: 3 }}>INVOICE LINES JUDGED BY GENLAYER</div>
        </div>
        <div style={{ position: "absolute", right: 60, top: 70, width: 560, height: 490, backgroundColor: CARD, border: `2px solid #BFA77A`, display: "flex", flexDirection: "column", padding: "34px 30px", transform: "rotate(2deg)" }}>
          <div style={{ display: "flex", fontSize: 30, fontWeight: 800, color: INK, borderBottom: `4px solid ${INK}`, paddingBottom: 8, letterSpacing: 3 }}>JOB CARD · INVOICE</div>
          {ROWS.map(([t, s, c]) => (
            <div key={t} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "2px solid #C8B286", padding: "22px 0" }}>
              <div style={{ display: "flex", fontFamily: hand, fontSize: 30, color: CARBON, width: 320 }}>{t}</div>
              <div style={{ display: "flex", fontSize: 34, fontWeight: 800, color: c, border: `5px solid ${c}`, boxShadow: `inset 0 0 0 4px ${CARD}, inset 0 0 0 7px ${c}`, padding: "4px 12px", transform: "rotate(-6deg)", letterSpacing: 3 }}>{s}</div>
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}
