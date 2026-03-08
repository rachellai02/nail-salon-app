import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Prestige by Chusen",
  description: "Nail salon management app",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-50 min-h-screen`}
      >
        <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-6">
          <span className="font-bold text-lg text-pink-600">Prestige by Chusen</span>
          <Link href="/packages" className="text-sm text-gray-600 hover:text-pink-600 font-medium">
            Packages
          </Link>
          <Link href="/packages/customers" className="text-sm text-gray-600 hover:text-pink-600 font-medium">
            Customer's Packages
          </Link>
        </nav>
        <main className="px-6 py-8 max-w-6xl mx-auto">{children}</main>
        <Toaster richColors />
      </body>
    </html>
  );
}
