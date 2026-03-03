"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import Link from "next/link";

interface Position {
  id: string;
  companyName: string;
  title: string;
  employmentType: string | null;
  startDate: string | null;
  endDate: string | null;
  isCurrent: boolean;
  description: string | null;
  locationText: string | null;
}

interface Education {
  id: string;
  schoolName: string | null;
  degree: string | null;
  fieldOfStudy: string | null;
  startDate: string | null;
  endDate: string | null;
  description: string | null;
}

interface Skill {
  id: string;
  skillName: string;
}

interface CandidateDetail {
  id: string;
  fullName: string | null;
  headline: string | null;
  summary: string | null;
  locationText: string | null;
  industry: string | null;
  profileUrl: string | null;
   profileImageUrl: string | null;
  rawJson: unknown;
  positions: Position[];
  educations: Education[];
  skills: Skill[];
   companyLogos?: Record<string, string | null>;
}

function formatDate(d: string | null): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("ko-KR");
}

/** 경력/학력용: 월 단위만 (YYYY.MM) */
function formatDateMonth(d: string | null): string {
  if (!d) return "-";
  const date = new Date(d);
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  return `${y}.${String(m).padStart(2, "0")}`;
}

/** 재직 기간 (n년 n개월) */
function formatDuration(startDate: string | null, endDate: string | null, isCurrent: boolean): string {
  if (!startDate) return "";
  const start = new Date(startDate);
  const end = isCurrent ? new Date() : endDate ? new Date(endDate) : null;
  if (!end) return "";
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  if (months <= 0) return "";
  const years = Math.floor(months / 12);
  const monthsPart = months % 12;
  const parts = [];
  if (years > 0) parts.push(`${years}년`);
  parts.push(`${monthsPart}개월`);
  return ` (${parts.join(" ")})`;
}

export default function CandidateDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const [candidate, setCandidate] = useState<CandidateDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showRawJson, setShowRawJson] = useState(false);

  useEffect(() => {
    async function fetchCandidate() {
      const res = await fetch(`/api/candidates/${id}`);
      if (!res.ok) {
        setLoading(false);
        return;
      }
      const data = await res.json();
      setCandidate(data);
      setLoading(false);
    }
    fetchCandidate();
  }, [id]);

  if (loading) {
    return <div className="py-12 text-center text-gray-500">로딩 중...</div>;
  }

  if (!candidate) {
    return (
      <div className="py-12 text-center">
        <p className="text-gray-500 mb-4">후보자를 찾을 수 없습니다.</p>
        <Link href="/candidates" className="text-blue-600 hover:underline">
          목록으로
        </Link>
      </div>
    );
  }

  const totalYears = (() => {
    let months = 0;
    const now = new Date();
    for (const p of candidate.positions) {
      const start = p.startDate ? new Date(p.startDate) : null;
      const end = p.isCurrent ? now : p.endDate ? new Date(p.endDate) : null;
      if (!start) continue;
      const endDate = end ?? now;
      const m = (endDate.getFullYear() - start.getFullYear()) * 12 + (endDate.getMonth() - start.getMonth());
      if (m > 0) months += m;
    }
    return months > 0 ? Math.round((months / 12) * 10) / 10 : 0;
  })();

  const initials =
    (candidate.fullName ?? "")
      .trim()
      .split(/\s+/)
      .map((part) => part[0])
      .join("")
      .slice(0, 2) || "·";

  const groupedPositions = (() => {
    const groups: { companyName: string; positions: Position[] }[] = [];
    const indexByName = new Map<string, number>();

    for (const p of candidate.positions) {
      const name = p.companyName || "(회사명 없음)";
      let idx = indexByName.get(name);
      if (idx === undefined) {
        idx = groups.length;
        groups.push({ companyName: name, positions: [] });
        indexByName.set(name, idx);
      }
      groups[idx].positions.push(p);
    }

    // 각 회사 내에서는 시작일 기준 최근 순으로 정렬
    for (const g of groups) {
      g.positions.sort((a, b) => {
        const aDate = a.startDate ? new Date(a.startDate) : new Date(0);
        const bDate = b.startDate ? new Date(b.startDate) : new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
    }

    return groups;
  })();

  return (
    <div>
      <div className="mb-8 flex items-start justify-between">
        <div>
          <Link href="/candidates" className="text-blue-600 hover:underline inline-block mb-6">
            ← 목록으로
          </Link>
          <div className="flex items-center gap-4 mt-2">
            <div className="w-14 h-14 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 font-semibold overflow-hidden shrink-0">
              {candidate.profileImageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={candidate.profileImageUrl}
                  alt={candidate.fullName ?? "프로필 이미지"}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span>{initials}</span>
              )}
            </div>
            <div>
              <h1 className="text-2xl font-bold">{candidate.fullName ?? "이름 없음"}</h1>
              <p className="text-gray-600 mt-1">{candidate.headline ?? "-"}</p>
            </div>
          </div>
        </div>
        <button
          onClick={() => setShowRawJson((s) => !s)}
          className="px-4 py-2 rounded-md bg-gray-200 text-gray-700 hover:bg-gray-300 text-sm shrink-0"
        >
          {showRawJson ? "rawJson 숨기기" : "rawJson 보기"}
        </button>
      </div>

      <div className="space-y-6">
        <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            기본 정보
          </h2>
          <div className="space-y-4">
            <div>
              <span className="font-medium text-gray-700">도메인:</span>{" "}
              {candidate.industry ?? "-"}
            </div>
            {candidate.profileUrl && (
              <div>
                <span className="font-medium text-gray-700">프로필 URL:</span>{" "}
                <a
                  href={candidate.profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:underline"
                >
                  {candidate.profileUrl}
                </a>
              </div>
            )}
            <div>
              <span className="font-medium text-gray-700">요약:</span>
              <p className="mt-2 text-gray-600 whitespace-pre-wrap">
                {candidate.summary ?? "-"}
              </p>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <div className="flex justify-between items-center border-b border-gray-200 pb-2 mb-4">
            <h2 className="text-lg font-semibold text-gray-800">경력</h2>
            {totalYears > 0 && (
              <span className="text-sm font-medium text-gray-600">총 경력 {totalYears}년</span>
            )}
          </div>
          {candidate.positions.length === 0 ? (
            <p className="text-gray-500">경력 정보가 없습니다.</p>
          ) : (
            <div className="space-y-6">
              {groupedPositions.map((group) => (
                <div key={group.companyName} className="border-b border-gray-200 pb-4 last:border-0">
                  <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 text-xs overflow-hidden shrink-0">
                        {candidate.companyLogos?.[group.companyName] ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={candidate.companyLogos[group.companyName] as string}
                            alt={group.companyName}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <span>{group.companyName.slice(0, 2)}</span>
                        )}
                      </div>
                      <Link
                        href={`/company/${encodeURIComponent(group.companyName)}`}
                        className="text-blue-600 font-semibold hover:underline"
                      >
                        {group.companyName}
                      </Link>
                    </div>
                  </div>
                  <div className="space-y-3">
                    {group.positions.map((p) => (
                      <div key={p.id} className="flex justify-between items-start text-sm">
                        <div className="pr-4">
                          <div className="font-semibold text-gray-900">{p.title}</div>
                          {p.employmentType && (
                            <div className="text-xs text-gray-500 mt-0.5">{p.employmentType}</div>
                          )}
                          {p.description && (
                            <p className="mt-1 text-gray-600 whitespace-pre-wrap">{p.description}</p>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 whitespace-nowrap text-right">
                          {formatDateMonth(p.startDate)} ~{" "}
                          {p.isCurrent ? "현재" : formatDateMonth(p.endDate)}
                          {formatDuration(p.startDate, p.endDate, p.isCurrent)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            학력
          </h2>
          {candidate.educations.length === 0 ? (
            <p className="text-gray-500">학력 정보가 없습니다.</p>
          ) : (
            <div className="space-y-6">
              {candidate.educations.map((e) => (
                <div key={e.id} className="border-b border-gray-200 pb-4 last:border-0">
                  <h3 className="font-semibold">{e.schoolName ?? "학교명 없음"}</h3>
                  <p className="text-gray-600">
                    {[e.degree, e.fieldOfStudy].filter(Boolean).join(" · ") || "-"}
                  </p>
                  <p className="text-sm text-gray-500">
                    {formatDate(e.startDate)} ~ {formatDate(e.endDate)}
                  </p>
                  {e.description && (
                    <p className="mt-2 text-gray-600 text-sm whitespace-pre-wrap">
                      {e.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
            스킬
          </h2>
          {candidate.skills.length === 0 ? (
            <p className="text-gray-500">스킬 정보가 없습니다.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {candidate.skills.map((s) => (
                <span
                  key={s.id}
                  className="px-3 py-1 bg-gray-100 text-gray-800 rounded-full text-sm"
                >
                  {s.skillName}
                </span>
              ))}
            </div>
          )}
        </section>

        {showRawJson && (
          <section className="bg-white rounded-lg shadow border border-gray-200 p-6">
            <h2 className="text-lg font-semibold text-gray-800 border-b border-gray-200 pb-2 mb-4">
              rawJson
            </h2>
            <pre className="p-4 bg-gray-100 rounded overflow-auto max-h-96 text-xs">
              {JSON.stringify(candidate.rawJson, null, 2)}
            </pre>
          </section>
        )}
      </div>
    </div>
  );
}
