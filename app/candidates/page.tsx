"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

interface CandidateItem {
  id: string;
  fullName: string | null;
  headlineDisplay: string;
  totalYears: number;
  previousCompany: string | null;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export default function CandidatesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [candidates, setCandidates] = useState<CandidateItem[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState(searchParams.get("query") ?? "");
  const [inputQuery, setInputQuery] = useState(searchParams.get("query") ?? "");
  const [isCurrent, setIsCurrent] = useState<string>(searchParams.get("isCurrent") ?? "all");
  const [page, setPage] = useState(parseInt(searchParams.get("page") ?? "1", 10));
  const [sortYears, setSortYears] = useState<string>(searchParams.get("sort") ?? "");

  const fetchCandidates = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams();
    params.set("page", String(page));
    params.set("limit", "20");
    if (query) params.set("query", query);
    if (isCurrent !== "all") params.set("isCurrent", isCurrent);
    if (sortYears) params.set("sort", sortYears);

    const res = await fetch(`/api/candidates?${params}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setCandidates(data.candidates);
    setPagination(data.pagination);
    setLoading(false);
  }, [page, query, isCurrent, sortYears]);

  useEffect(() => {
    fetchCandidates();
  }, [fetchCandidates]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("page", String(page));
    if (query) params.set("query", query);
    if (isCurrent !== "all") params.set("isCurrent", isCurrent);
    if (sortYears) params.set("sort", sortYears);
    router.push(`/candidates?${params}`, { scroll: false });
  }, [page, query, isCurrent, sortYears, router]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    setQuery(inputQuery);
    setPage(1);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">후보자 목록</h1>

      <div className="mb-6 flex flex-wrap gap-4 items-end">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder="이름, 헤드라인, 회사, 직함, 스킬 검색..."
            className="px-3 py-2 border border-gray-300 rounded-md w-80 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            검색
          </button>
        </form>
        <div className="flex items-center gap-2">
          <label className="text-sm font-medium text-gray-700">현재 재직:</label>
          <select
            value={isCurrent}
            onChange={(e) => {
              setIsCurrent(e.target.value);
              setPage(1);
            }}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">전체</option>
            <option value="true">재직 중</option>
            <option value="false">이직</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="py-12 text-center text-gray-500">로딩 중...</div>
      ) : (
        <>
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">헤드라인</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-28">
                    <span className="inline-flex items-center gap-1 whitespace-nowrap">
                      연차
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortYears((s) => (s === "totalYears_asc" ? "" : "totalYears_asc"));
                          setPage(1);
                        }}
                        className={`p-0.5 rounded hover:bg-gray-200 ${sortYears === "totalYears_asc" ? "bg-blue-100 text-blue-700" : "text-gray-400"}`}
                        title="오름차순"
                      >
                        ↑
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setSortYears((s) => (s === "totalYears_desc" ? "" : "totalYears_desc"));
                          setPage(1);
                        }}
                        className={`p-0.5 rounded hover:bg-gray-200 ${sortYears === "totalYears_desc" ? "bg-blue-100 text-blue-700" : "text-gray-400"}`}
                        title="내림차순"
                      >
                        ↓
                      </button>
                    </span>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">이전 직장</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {candidates.map((c) => (
                  <tr
                    key={c.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => router.push(`/candidates/${c.id}`)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      <Link href={`/candidates/${c.id}`} className="text-blue-600 hover:underline font-medium">
                        {c.fullName ?? "-"}
                      </Link>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-700 max-w-md truncate">
                      {c.headlineDisplay}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 whitespace-nowrap">
                      {c.totalYears > 0 ? `${c.totalYears}년` : "-"}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                      {c.previousCompany ?? "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex justify-center gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                이전
              </button>
              <span className="px-4 py-2">
                {page} / {pagination.totalPages} (총 {pagination.total}건)
              </span>
              <button
                onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
                disabled={page >= pagination.totalPages}
                className="px-4 py-2 border rounded-md disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-100"
              >
                다음
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
