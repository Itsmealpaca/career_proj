import { prisma } from "@/lib/prisma";
import { CompanyListClient, CompanyListItem } from "./CompanyListClient";

export const dynamic = "force-dynamic";

export default async function CompanyPage() {
  const companies = await prisma.company.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      description: true,
    },
  });

  // 회사별 전·현직 인원 수 계산 (후보자 기준, isDeleted 제외)
  const positions = await prisma.candidatePosition.findMany({
    where: {
      candidate: { isDeleted: false },
    },
    select: {
      companyName: true,
      candidateId: true,
    },
  });

  const countsByName = new Map<string, Set<string>>();
  for (const p of positions) {
    const name = p.companyName.trim();
    if (!name) continue;
    const set = countsByName.get(name) ?? new Set<string>();
    set.add(p.candidateId);
    countsByName.set(name, set);
  }

  const items: CompanyListItem[] = companies.map((c) => ({
    id: c.id,
    name: c.name,
    description: c.description,
    employeeCount: countsByName.get(c.name)?.size ?? 0,
  }));

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">회사 목록</h1>

      <CompanyListClient initialCompanies={items} />

      <p className="mt-4 text-sm text-gray-500 text-right">총 {items.length}개 회사</p>
    </div>
  );
}
