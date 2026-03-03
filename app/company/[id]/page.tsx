import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { UpdateCompanyInfoBar } from "./UpdateCompanyInfoBar";

export const dynamic = "force-dynamic";

function formatMonth(d: Date | null | undefined) {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = d.getMonth() + 1;
  return `${y}.${String(m).padStart(2, "0")}`;
}

function formatDateTime(d: Date | null | undefined) {
  if (!d) return "-";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${hh}:${mm}`;
}

function formatDuration(start: Date | null | undefined, end: Date | null | undefined, isCurrent: boolean) {
  if (!start) return "";
  const startDate = new Date(start);
  const endDate = isCurrent ? new Date() : end ? new Date(end) : null;
  if (!endDate) return "";
  let months = (endDate.getFullYear() - startDate.getFullYear()) * 12 + (endDate.getMonth() - startDate.getMonth());
  if (months <= 0) return "";
  const years = Math.floor(months / 12);
  const monthsPart = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years}년`);
  parts.push(`${monthsPart}개월`);
  return ` (${parts.join(" ")})`;
}

export default async function CompanyDetailPage({ params }: { params: { id: string } }) {
  const key = decodeURIComponent(params.id);

  let company = await prisma.company.findUnique({
    where: { id: key },
  });

  if (!company) {
    company = await prisma.company.findUnique({
      where: { name: key },
    });
  }

  if (!company) {
    notFound();
  }

  const positions = await prisma.candidatePosition.findMany({
    where: {
      companyName: company.name,
      candidate: { isDeleted: false },
    },
    orderBy: [{ isCurrent: "desc" }, { startDate: "desc" }],
    include: {
      candidate: {
        select: {
          id: true,
          fullName: true,
          headline: true,
        },
      },
    },
  });

  // 같은 사람이 한 회사에서 여러 직함을 가진 경우 하나로 통합
  const aggregated = new Map<
    string,
    {
      candidate: (typeof positions)[number]["candidate"];
      titles: Set<string>;
      startDate: Date | null;
      endDate: Date | null;
      isCurrent: boolean;
    }
  >();

  for (const p of positions) {
    const keyCandidateId = p.candidate.id;
    const existing = aggregated.get(keyCandidateId);
    const start = p.startDate ? new Date(p.startDate) : null;
    const end = p.endDate ? new Date(p.endDate) : null;

    if (!existing) {
      aggregated.set(keyCandidateId, {
        candidate: p.candidate,
        titles: new Set(p.title ? [p.title] : []),
        startDate: start,
        endDate: end,
        isCurrent: p.isCurrent,
      });
    } else {
      if (p.title) existing.titles.add(p.title);
      if (start) {
        if (!existing.startDate || start < existing.startDate) {
          existing.startDate = start;
        }
      }
      if (p.isCurrent) {
        existing.isCurrent = true;
        existing.endDate = null;
      } else if (end && !existing.isCurrent) {
        if (!existing.endDate || end > existing.endDate) {
          existing.endDate = end;
        }
      }
    }
  }

  const current = [];
  const past = [];
  for (const value of aggregated.values()) {
    if (value.isCurrent) {
      current.push(value);
    } else {
      past.push(value);
    }
  }

  const initials = company.name.slice(0, 2);

  return (
    <div className="space-y-8">
      {/* 상단 회사 정보 */}
      <section className="bg-white rounded-lg shadow border border-gray-200 p-6 flex flex-col gap-6">
        <div className="flex gap-6 items-start">
          <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold text-xl shrink-0">
            {initials}
          </div>
          <div className="flex-1 space-y-4">
            <div>
              <h1 className="text-2xl font-bold">{company.name}</h1>
              {company.description && (
                <p className="mt-1 text-gray-600 whitespace-pre-wrap">{company.description}</p>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-3 text-sm text-gray-700">
              <div>
                <span className="font-semibold text-gray-900">기업 개요</span>
                <p className="mt-1 text-gray-600">{company.description ?? "-"}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">제품 · 서비스</span>
                <p className="mt-1 text-gray-600">{company.products ?? "-"}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">연관 키워드</span>
                <p className="mt-1 text-gray-600">{company.keywords ?? "-"}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">투자 라운드</span>
                <p className="mt-1 text-gray-600">{company.fundingRound ?? "-"}</p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">누적 투자액</span>
                <p className="mt-1 text-gray-600">
                  {company.totalFunding != null ? `${company.totalFunding.toLocaleString()}원` : "-"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">업력 (창립일)</span>
                <p className="mt-1 text-gray-600">
                  {company.foundedAt ? formatMonth(company.foundedAt) : "-"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">임직원 수</span>
                <p className="mt-1 text-gray-600">
                  {company.headcount != null ? `${company.headcount.toLocaleString()}명` : "-"}
                </p>
              </div>
              <div>
                <span className="font-semibold text-gray-900">연 매출</span>
                <p className="mt-1 text-gray-600">
                  {company.annualRevenue != null ? `${company.annualRevenue.toLocaleString()}원` : "-"}
                </p>
              </div>
            </div>
          </div>
        </div>
        <UpdateCompanyInfoBar
          companyId={company.id}
          lastUpdatedLabel={formatDateTime(company.updatedAt)}
        />
      </section>

      {/* 재직 중 */}
      <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          재직 중 <span className="text-sm text-gray-500">({current.length}명)</span>
        </h2>
        {current.length === 0 ? (
          <p className="text-gray-500 text-sm">현재 재직 중인 인원이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">직함</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">헤드라인</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">재직 기간</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {current.map((p) => (
                  <tr key={p.candidate.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/candidates/${p.candidate.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {p.candidate.fullName ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-800 whitespace-pre-line">
                      {Array.from(p.titles).join("\n")}
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{p.candidate.headline ?? "-"}</td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {formatMonth(p.startDate)} ~ 현재
                      {formatDuration(p.startDate, p.endDate, p.isCurrent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* 이전 재직자 */}
      <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4">
          이전 재직자 <span className="text-sm text-gray-500">({past.length}명)</span>
        </h2>
        {past.length === 0 ? (
          <p className="text-gray-500 text-sm">이전 재직자가 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">이름</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">직함</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">헤드라인</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">재직 기간</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200 text-sm">
                {past.map((p) => (
                  <tr key={p.candidate.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2">
                      <Link
                        href={`/candidates/${p.candidate.id}`}
                        className="text-blue-600 hover:underline font-medium"
                      >
                        {p.candidate.fullName ?? "-"}
                      </Link>
                    </td>
                    <td className="px-4 py-2 text-gray-800 whitespace-pre-line">
                      {Array.from(p.titles).join("\n")}
                    </td>
                    <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{p.candidate.headline ?? "-"}</td>
                    <td className="px-4 py-2 text-gray-600 whitespace-nowrap">
                      {formatMonth(p.startDate)} ~ {formatMonth(p.endDate)}
                      {formatDuration(p.startDate, p.endDate, p.isCurrent)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

