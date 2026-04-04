"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import LogoutButton from "./LogoutButton";

export default function NavBar() {
  const pathname = usePathname();
  if (pathname === "/login") return null;

  return (
    <nav className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-6">
      <span className="font-bold text-lg" style={{ fontSize: "20px" }}>
        Prestige <i style={{ fontSize: "14px" }}>by Chusen</i>
      </span>
      <Link
        href="/appointments"
        className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
      >
        Appointments
      </Link>
      <Link
        href="/packages"
        className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
      >
        Package Types
      </Link>
      <Link
        href="/packages/customers"
        className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
      >
        Customer&apos;s Packages
      </Link>
      <Link
        href="/packages/archive"
        className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
      >
        Archive
      </Link>
      <Link
        href="/services"
        className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
      >
        Services
      </Link>
      <Link
        href="/payment"
        className="text-sm text-black-600 hover:text-gray-500 hover:font-bold hover:underline font-medium"
      >
        Payment
      </Link>
      <div className="ml-auto">
        <LogoutButton />
      </div>
    </nav>
  );
}
