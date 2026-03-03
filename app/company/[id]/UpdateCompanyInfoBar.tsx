"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function UpdateCompanyInfoBar({
  companyId,
  lastUpdatedLabel,
}: {
  companyId: string;
  lastUpdatedLabel: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRefresh() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/company/${encodeURIComponent(companyId)}/refresh`, {
        method: "POST",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError(body.error ?? "회사 정보 업데이트에 실패했습니다.");
      } else {
        router.refresh();
      }
    } catch {
      setError("회사 정보 업데이트 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center justify-between pt-2 border-t border-gray-100">
      <div className="flex flex-col">
        <p className="text-xs text-gray-500">마지막 업데이트: {lastUpdatedLabel}</p>
        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="px-4 py-2 text-sm rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? "업데이트 중..." : "회사 정보 업데이트"}
      </button>
    </div>
  );
}

