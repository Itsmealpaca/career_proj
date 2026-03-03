import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(Math.max(parseInt(searchParams.get("limit") ?? "20", 10), 1), 100);
  const query = searchParams.get("query")?.trim() ?? "";
  const isCurrent = searchParams.get("isCurrent");
  const sort = searchParams.get("sort") ?? "updatedAt";

  const skip = (page - 1) * limit;
  const sortByTotalYears = sort === "totalYears_asc" || sort === "totalYears_desc";

  const where: Prisma.CandidateWhereInput = {
    isDeleted: false,
  };

  if (query) {
    where.OR = [
      { fullName: { contains: query, mode: "insensitive" } },
      { headline: { contains: query, mode: "insensitive" } },
      { summary: { contains: query, mode: "insensitive" } },
      { industry: { contains: query, mode: "insensitive" } },
      { positions: { some: { OR: [{ companyName: { contains: query, mode: "insensitive" } }, { title: { contains: query, mode: "insensitive" } }] } } },
      { skills: { some: { skillName: { contains: query, mode: "insensitive" } } } },
    ];
  }

  if (isCurrent === "true") {
    where.positions = { some: { isCurrent: true } };
  } else if (isCurrent === "false") {
    where.NOT = { positions: { some: { isCurrent: true } } };
  }

  const orderBy: Prisma.CandidateOrderByWithRelationInput =
    sort === "fullName" ? { fullName: "asc" } : { updatedAt: "desc" };

  const selectFields = {
    id: true,
    fullName: true,
    positions: {
      orderBy: { sequenceIndex: "asc" as const },
      select: {
        companyName: true,
        title: true,
        startDate: true,
        endDate: true,
        isCurrent: true,
      },
    },
  } as const;

  type RawCandidate = {
    id: string;
    fullName: string | null;
    positions: { companyName: string; title: string; startDate: Date | null; endDate: Date | null; isCurrent: boolean }[];
  };

  let rawCandidates: RawCandidate[];
  let total: number;

  if (sortByTotalYears) {
    const all = await prisma.candidate.findMany({
      where,
      select: selectFields,
    });
    total = all.length;
    rawCandidates = all as RawCandidate[];
  } else {
    const [cands, cnt] = await Promise.all([
      prisma.candidate.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        select: selectFields,
      }),
      prisma.candidate.count({ where }),
    ]);
    rawCandidates = cands as RawCandidate[];
    total = cnt;
  }

  const now = new Date();

  let candidates = rawCandidates.map((c) => {
    const positions = c.positions;
    const currentIndex = positions.findIndex((p) => p.isCurrent);
    const displayIndex = currentIndex >= 0 ? currentIndex : 0;
    const currentPos = positions[displayIndex];
    const headlineDisplay = currentPos
      ? `${currentPos.title} at ${currentPos.companyName}`
      : "-";
    const previousCompany = positions[displayIndex + 1]?.companyName ?? null;

    let totalMonths = 0;
    for (const p of positions) {
      const start = p.startDate ? new Date(p.startDate) : null;
      const end = p.isCurrent ? now : p.endDate ? new Date(p.endDate) : null;
      if (!start) continue;
      const endDate = end ?? now;
      const months = (endDate.getFullYear() - start.getFullYear()) * 12 + (endDate.getMonth() - start.getMonth());
      if (months > 0) totalMonths += months;
    }
    const totalYears = totalMonths > 0 ? Math.round((totalMonths / 12) * 10) / 10 : 0;

    return {
      id: c.id,
      fullName: c.fullName,
      headlineDisplay,
      totalYears,
      previousCompany,
    };
  });

  if (sortByTotalYears) {
    const dir = sort === "totalYears_asc" ? 1 : -1;
    candidates.sort((a, b) => dir * (a.totalYears - b.totalYears));
    candidates = candidates.slice(skip, skip + limit);
  }

  return NextResponse.json({
    candidates,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}
