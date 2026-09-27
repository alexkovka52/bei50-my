import type { Metadata, Viewport } from "next";
import { Rubik, Source_Sans_3 } from "next/font/google";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

const sourceSans = Source_Sans_3({
  variable: "--font-source",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Sireț3 · Demetra",
  description:
    "Marcaj vineyard viewer: Sireț3 ortho, IDs, planar measurements, inspector and farmer walks.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${rubik.variable} ${sourceSans.variable} min-h-dvh antialiased`}>{children}</body>
    </html>
  );
}
