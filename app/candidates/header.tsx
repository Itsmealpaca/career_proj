"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";

export function Header() {
  const pathname = usePathname();

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <nav className="flex gap-6">
          <Link
            href="/candidates"
            className={`font-medium ${
              pathname === "/candidates" ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            후보자
          </Link>
          <Link
            href="/admin/ingest"
            className={`font-medium ${
              pathname.startsWith("/admin") ? "text-blue-600" : "text-gray-600 hover:text-gray-900"
            }`}
          >
            적재 관리
          </Link>
        </nav>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="text-sm text-gray-600 hover:text-gray-900"
        >
          로그아웃
        </button>
      </div>
    </header>
  );
}
