"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import LogoutButton from "./LogoutButton";

const NAV_LINKS = [
  { href: "/appointments", label: "Appointments" },
  { href: "/packages", label: "Package Types" },
  { href: "/packages/customers", label: "Customer's Packages" },
  { href: "/services", label: "Services" },
  { href: "/payment", label: "Payment" },
  { href: "/sales", label: "Sales" },
  { href: "/packages/archive", label: "Archive" },
  { href: "/employees", label: "Employees" },
];

export default function NavBar() {
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);

  if (pathname === "/login") return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-4 sm:px-6 py-4">
      {/* Top row */}
      <div className="flex items-center gap-3">
        {/* Hamburger — mobile only */}
        <button
          className="sm:hidden p-1 rounded hover:bg-gray-100 transition-colors"
          onClick={() => setMenuOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>

        {/* Brand */}
        <span className="font-bold text-lg" style={{ fontSize: "20px" }}>
          Prestige <i style={{ fontSize: "14px" }}>by Chusen</i>
        </span>

        {/* Desktop links */}
        <div className="hidden sm:flex items-center gap-6 ml-2">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
            >
              {label}
            </Link>
          ))}
        </div>

        <div className="ml-auto">
          <LogoutButton />
        </div>
      </div>

      {/* Mobile dropdown */}
      {menuOpen && (
        <div className="sm:hidden mt-3 flex flex-col gap-1 border-t pt-3">
          {NAV_LINKS.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              onClick={() => setMenuOpen(false)}
              className="text-sm font-medium px-2 py-2 rounded hover:bg-gray-100 transition-colors"
            >
              {label}
            </Link>
          ))}
        </div>
      )}
    </nav>
  );
}
