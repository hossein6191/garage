import type { Metadata, Viewport } from "next";
import { Barlow_Condensed, IBM_Plex_Mono, IBM_Plex_Sans, Kalam } from "next/font/google";

import "./globals.css";
import { AppFrame } from "@/components/app-frame";
import { Providers } from "@/components/providers";
import { SITE_LINE, SITE_NAME, SITE_TAGLINE } from "@/lib/config";

// Barlow Condensed for headings and stamps, IBM Plex Sans to read, IBM Plex Mono for amounts, Kalam
// for the carbon-copy handwriting of the lines.
const barlow = Barlow_Condensed({ subsets: ["latin"], weight: ["600", "700", "800"], variable: "--font-barlow", display: "swap" });
const plex = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-plex-mono", display: "swap" });
const kalam = Kalam({ subsets: ["latin"], weight: ["400", "700"], variable: "--font-kalam", display: "swap" });

const siteUrl =
  process.env.NEXT_PUBLIC_SITE_URL || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : "http://localhost:3000");

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: { default: `${SITE_NAME}: a repair quote held in escrow, an invoice judged line by line`, template: `%s · ${SITE_NAME}` },
  description: SITE_LINE,
  applicationName: SITE_NAME,
  openGraph: { title: SITE_NAME, description: SITE_TAGLINE },
};

export const viewport: Viewport = {
  themeColor: "#23272A",
  colorScheme: "dark light",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${plex.variable} ${plexMono.variable} ${kalam.variable} antialiased`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:bg-safety focus:px-3 focus:py-2 focus:text-ink">
          Skip to the page
        </a>
        <Providers>
          <AppFrame>{children}</AppFrame>
        </Providers>
      </body>
    </html>
  );
}
