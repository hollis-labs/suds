import type { Metadata, Viewport } from "next";
import { JetBrains_Mono } from "next/font/google";
import { Providers } from "@/components/providers";
import "./globals.css";

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "SUDS - Single User Dungeons",
  description: "A web-based dungeon crawler with retro terminal aesthetics",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${jetbrainsMono.variable} dark`} data-theme="green">
      <body className="antialiased">
        <Providers>{children}</Providers>
        <div className="scanline-overlay" aria-hidden="true" />
      </body>
    </html>
  );
}
