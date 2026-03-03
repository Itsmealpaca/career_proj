import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const candidate = await prisma.candidate.findFirst({
    where: { id, isDeleted: false },
    include: {
      positions: { orderBy: { sequenceIndex: "asc" } },
      educations: true,
      skills: true,
    },
  });

  if (!candidate) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const companyNames = Array.from(
    new Set(candidate.positions.map((p) => p.companyName).filter(Boolean))
  );

  const companies =
    companyNames.length === 0
      ? []
      : await prisma.company.findMany({
          where: { name: { in: companyNames } },
          select: { name: true },
        });

  const companyLogos = Object.fromEntries(
    companies.map((c) => [c.name, null as string | null])
  );

  return NextResponse.json({
    ...candidate,
    companyLogos,
  });
}
