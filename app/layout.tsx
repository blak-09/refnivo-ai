import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Toaster } from "sonner";
import { MisconfiguredPage } from "@/components/system/misconfigured";
import { isMisconfigured } from "@/lib/config/boot-state";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"], display: "swap" });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"], display: "swap", preload: false });

export const metadata: Metadata = {
  title: { default: "Refnivo AI", template: "%s · Refnivo AI" },
  description:
    "Refnivo is the creator commerce platform for Indian product brands: affiliate and referral campaigns that pay on verified sales, UGC at a fixed fee, and every creator partnership in one place.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col">
        <a
          href="#main-content"
          className="sr-only rounded-lg bg-background px-4 py-2 text-sm font-medium text-foreground shadow-lg focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[100]"
        >
          Skip to main content
        </a>
        {isMisconfigured() ? <MisconfiguredPage /> : children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
