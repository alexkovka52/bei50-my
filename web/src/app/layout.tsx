import type { Metadata } from "next";
import localFont from "next/font/local";
import type { CSSProperties } from "react";
import { MOTION_VARS } from "@/lib/motion";
import "./globals.css";

const manrope = localFont({
  variable: "--font-manrope",
  display: "swap",
  adjustFontFallback: false,
  src: [
    { path: "./fonts/manrope-latin-400-normal.woff2", weight: "400" },
    { path: "./fonts/manrope-latin-500-normal.woff2", weight: "500" },
    { path: "./fonts/manrope-latin-600-normal.woff2", weight: "600" },
    { path: "./fonts/manrope-latin-700-normal.woff2", weight: "700" },
    { path: "./fonts/manrope-latin-800-normal.woff2", weight: "800" },
  ],
});

export const metadata: Metadata = {
  title: "TRASHOPOLY · Smart Vineyard Routing",
  description:
    "Marcaj vineyard viewer: Sireț3 ortho, IDs, planar measurements, inspector and farmer walks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" style={MOTION_VARS as CSSProperties}>
      <body className={`${manrope.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
