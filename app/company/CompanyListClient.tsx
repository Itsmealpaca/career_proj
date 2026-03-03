"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

export interface CompanyListItem {
  id: string;
  name: string;
  description: string | null;
  employeeCount: number;
}

export function CompanyListClient({ initialCompanies }: { initialCompanies: CompanyListItem[] }) {
  const [query, setQuery] = useState("");
  const [sortDir, setSortDir] = useState<"none" | "asc" | "desc">("desc");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return initialCompanies;
    return initialCompanies.filter((c) =>
      [c.name, c.description ?? ""].join(" ").toLowerCase().includes(q)
    );
  }, [initialCompanies, query]);

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortDir === "none") return list;
    const dir = sortDir === "asc" ? 1 : -1;
    return list.sort((a, b) => dir * (a.employeeCount - b.employeeCount));
  }, [filtered, sortDir]);

  return (
    <div>
      <div className="flex items-end justify-between gap-4 mb-4">
        <div className="flex flex-col gap-2">
          <label className="text-sm font-medium text-gray-700">회사 검색</label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="회사명, 키워드, 제품명으로 검색..."
            className="px-3 py-2 border border-gray-300 rounded-md w-80 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <p className="text-sm text-gray-500">
          검색 결과: <span className="font-semibold text-gray-700">{filtered.length}</span> /{" "}
          {initialCompanies.length}
        </p>
      </div>

      <div className="bg-white rounded-lg shadow overflow-hidden border border-gray-200">
        {sorted.length === 0 ? (
          <div className="px-6 py-8 text-center text-gray-500">해당하는 회사가 없습니다.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  #
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  회사명
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap w-28">
                  <span className="inline-flex items-center gap-1 whitespace-nowrap">
                    직원 수
                    <button
                      type="button"
                      onClick={() =>
                        setSortDir((prev) =>
                          prev === "asc" ? "none" : "asc"
                        )
                      }
                      className={`p-0.5 rounded hover:bg-gray-200 ${
                        sortDir === "asc" ? "bg-blue-100 text-blue-700" : "text-gray-400"
                      }`}
                      title="직원 수 오름차순"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setSortDir((prev) =>
                          prev === "desc" ? "none" : "desc"
                        )
                      }
                      className={`p-0.5 rounded hover:bg-gray-200 ${
                        sortDir === "desc" ? "bg-blue-100 text-blue-700" : "text-gray-400"
                      }`}
                      title="직원 수 내림차순"
                    >
                      ↓
                    </button>
                  </span>
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  소개
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {sorted.map((c, i) => (
                <tr key={c.id} className="hover:bg-gray-50">
                  <td className="px-6 py-3 text-sm text-gray-400 w-12">{i + 1}</td>
                  <td className="px-6 py-3 text-sm font-medium text-gray-800">
                    <Link href={`/company/${c.id}`} className="text-blue-600 hover:underline">
                      {c.name}
                    </Link>
                  </td>
                  <td className="px-6 py-3 text-sm text-gray-700 w-24 whitespace-nowrap">
                    {c.employeeCount}
                  </td>
                  <td className="px-6 py-3 text-xs text-gray-600 max-w-lg truncate whitespace-nowrap">
                    {c.description ?? "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

