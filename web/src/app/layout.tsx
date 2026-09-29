import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Onest } from "next/font/google";
import type { CSSProperties } from "react";
import { asset } from "@/lib/base-path";
import { MOTION_VARS } from "@/lib/motion";
import "./globals.css";

const bricolage = Bricolage_Grotesque({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  axes: ["opsz"],
  display: "swap",
  variable: "--font-bricolage",
});

const onest = Onest({
  subsets: ["latin", "latin-ext"],
  weight: "variable",
  display: "swap",
  variable: "--font-onest",
});

export const metadata: Metadata = {
  title: {
    default: "Dementra",
    template: "%s | Dementra",
  },
  description: "Aerial vineyard intelligence: every row, every gap, every walk.",
  applicationName: "Dementra",
  metadataBase: new URL("https://dementra.md"),
  robots: { index: true, follow: true },
  manifest: asset("/site.webmanifest"),
};

export const viewport: Viewport = {
  themeColor: "#0F2A1D",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${bricolage.variable} ${onest.variable}`} style={MOTION_VARS as CSSProperties}>
      <body className="min-h-dvh bg-dew font-sans text-forest antialiased">
        <a
          href="#main"
          className="absolute top-3 left-3 z-[80] -translate-y-24 rounded-pill bg-paper px-4 py-2.5 font-semibold text-forest focus:translate-y-0"
        >
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
