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
          <span className="font-bold text-lg" style={{fontSize: "20px"}}>Prestige <i style={{ fontSize: "14px"}}>by Chusen</i></span>
          <Link href="/packages" className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium">
            Package Types
          </Link>
          <Link href="/packages/customers" className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium">
            Customer's Packages
          </Link>
          <Link href="/appointments" className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium">
            Appointments
          </Link>
          <Link href="/packages/archive" className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium">
            Archive
          </Link>
        </nav>
        <main className="px-6 py-8">{children}</main>
        <Toaster richColors />
      </body>
    </html>
  );
}
