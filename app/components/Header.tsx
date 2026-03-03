"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function Header() {
  const pathname = usePathname();

  const navItems = [
    { label: "후보자", href: "/candidates", active: pathname.startsWith("/candidates") },
    { label: "회사", href: "/company", active: pathname.startsWith("/company") },
    { label: "적재 관리", href: "/admin/ingest", active: pathname.startsWith("/admin") },
  ];

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between w-full max-w-[60vw] mx-auto">
        <nav className="flex gap-6">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`font-medium text-sm ${
                item.active ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-500 hover:text-gray-900"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
