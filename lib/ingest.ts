import { prisma } from "./prisma";
import { Prisma } from "@prisma/client";

export interface LinkedInCandidateInput {
  profileUrl?: string | null;
  sourceProfileId?: string | null;
  fullName?: string | null;
  headline?: string | null;
  summary?: string | null;
  locationText?: string | null;
  industry?: string | null;
  positions?: Array<{
    companyName?: string;
    title?: string;
    employmentType?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    isCurrent?: boolean;
    description?: string | null;
    locationText?: string | null;
  }>;
  educations?: Array<{
    schoolName?: string | null;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    description?: string | null;
  }>;
  skills?: Array<{ skillName?: string; name?: string } | string>;
}

/** 과거작업 양식: linkedinUrl, profileId, firstName, lastName, industryName, startEndDate 등 */
interface LinkedInExportItem {
  linkedinUrl?: string | null;
  profileId?: string | null;
  profileUrl?: string | null;
  sourceProfileId?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  fullName?: string | null;
  headline?: string | null;
  summary?: string | null;
  industryName?: string | null;
  industry?: string | null;
  positions?: Array<{
    companyName?: string;
    title?: string;
    companyLocation?: string | null;
    description?: string | null;
    locationText?: string | null;
    startEndDate?: {
      start?: { month?: number; year?: number };
      end?: { month?: number; year?: number };
    };
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    isCurrent?: boolean;
  }>;
  educations?: Array<{
    schoolName?: string | null;
    degreeName?: string | null;
    degree?: string | null;
    fieldOfStudy?: string | null;
    startEndDate?: string;
    originStartEndDate?: {
      startDateOn?: { month?: number; year?: number };
      endDateOn?: { month?: number; year?: number };
    };
    startDate?: string | Date | null;
    endDate?: string | Date | null;
    description?: string | null;
  }>;
  skills?: string[] | Array<{ skillName?: string; name?: string }>;
  [key: string]: unknown;
}

function parseDate(val: string | Date | null | undefined): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
}

function monthYearToDate(m?: number, y?: number): Date | null {
  if (y == null) return null;
  const month = m != null && m >= 1 && m <= 12 ? m - 1 : 0;
  const d = new Date(y, month, 1);
  return isNaN(d.getTime()) ? null : d;
}

/** 과거작업 JSON 양식을 스키마용 형식으로 변환 */
export function normalizeLinkedInExport(raw: unknown): LinkedInCandidateInput & Record<string, unknown> {
  const item = raw as LinkedInExportItem;
  const profileUrl = item.linkedinUrl ?? item.profileUrl ?? null;
  const sourceProfileId = item.profileId ?? item.sourceProfileId ?? null;
  const fullName =
    item.fullName ??
    ([item.firstName, item.lastName].filter(Boolean).join(" ").trim() || null);
  const industry = item.industryName ?? item.industry ?? null;

  const positions = (item.positions ?? []).map((p) => {
    const startEnd = p.startEndDate;
    const startDate =
      p.startDate != null
        ? parseDate(p.startDate)
        : startEnd?.start
          ? monthYearToDate(startEnd.start.month, startEnd.start.year)
          : null;
    const hasEnd = startEnd?.end != null;
    const endDate =
      p.endDate != null
        ? parseDate(p.endDate)
        : hasEnd && startEnd?.end
          ? monthYearToDate(startEnd.end.month, startEnd.end.year)
          : null;
    return {
      companyName: p.companyName ?? "",
      title: p.title ?? "",
      employmentType: null as string | null,
      startDate,
      endDate,
      isCurrent: !hasEnd,
      description: p.description ?? null,
      locationText: p.companyLocation ?? p.locationText ?? null,
    };
  });

  const educations = (item.educations ?? []).map((e) => {
    const origin = e.originStartEndDate;
    const startDate =
      e.startDate != null
        ? parseDate(e.startDate)
        : origin?.startDateOn
          ? monthYearToDate(origin.startDateOn.month, origin.startDateOn.year)
          : null;
    const endDate =
      e.endDate != null
        ? parseDate(e.endDate)
        : origin?.endDateOn
          ? monthYearToDate(origin.endDateOn.month, origin.endDateOn.year)
          : null;
    return {
      schoolName: e.schoolName ?? null,
      degree: e.degreeName ?? e.degree ?? null,
      fieldOfStudy: e.fieldOfStudy ?? null,
      startDate,
      endDate,
      description: e.description ?? null,
    };
  });

  const skills = item.skills ?? [];

  return {
    ...item,
    profileUrl,
    sourceProfileId,
    fullName,
    headline: item.headline ?? null,
    summary: item.summary ?? null,
    locationText: (item as { locationText?: string }).locationText ?? null,
    industry,
    positions,
    educations,
    skills,
  } as LinkedInCandidateInput & Record<string, unknown>;
}

function normalizeSkill(val: string): string {
  return val.trim().toLowerCase();
}

export async function ingestCandidate(
  data: LinkedInCandidateInput & Record<string, unknown>,
  runId: string
): Promise<{ inserted: boolean; updated: boolean }> {
  const profileUrl = data.profileUrl ?? null;
  const sourceProfileId = data.sourceProfileId ?? null;

  if (!profileUrl && !sourceProfileId) {
    throw new Error("profileUrl or sourceProfileId is required");
  }

  const rawJson = data as unknown as Prisma.InputJsonValue;
  const fullName = data.fullName ?? null;
  const headline = data.headline ?? null;
  const summary = data.summary ?? null;
  const locationText = data.locationText ?? null;
  const industry = data.industry ?? null;

  const existing = await prisma.candidate.findFirst({
    where: {
      isDeleted: false,
      OR: [
        ...(profileUrl ? [{ profileUrl }] : []),
        ...(sourceProfileId ? [{ sourceProfileId }] : []),
      ],
    },
    include: { positions: true, educations: true, skills: true },
  });

  const upsertData = {
    source: "linkedin",
    sourceProfileId,
    profileUrl,
    fullName,
    headline,
    summary,
    locationText,
    industry,
    rawJson,
  };

  if (existing) {
    await prisma.candidatePosition.deleteMany({ where: { candidateId: existing.id } });
    await prisma.candidateEducation.deleteMany({ where: { candidateId: existing.id } });
    await prisma.candidateSkill.deleteMany({ where: { candidateId: existing.id } });

    await prisma.candidate.update({
      where: { id: existing.id },
      data: upsertData,
    });

    const positions = data.positions ?? [];
    for (let i = 0; i < positions.length; i++) {
      const p = positions[i];
      await prisma.candidatePosition.create({
        data: {
          candidateId: existing.id,
          companyName: p.companyName ?? "",
          title: p.title ?? "",
          employmentType: p.employmentType ?? null,
          startDate: parseDate(p.startDate),
          endDate: parseDate(p.endDate),
          isCurrent: p.isCurrent ?? false,
          description: p.description ?? null,
          locationText: p.locationText ?? null,
          sequenceIndex: i,
        },
      });
    }

    const educations = data.educations ?? [];
    for (const e of educations) {
      await prisma.candidateEducation.create({
        data: {
          candidateId: existing.id,
          schoolName: e.schoolName ?? null,
          degree: e.degree ?? null,
          fieldOfStudy: e.fieldOfStudy ?? null,
          startDate: parseDate(e.startDate),
          endDate: parseDate(e.endDate),
          description: e.description ?? null,
        },
      });
    }

    const skillsRaw = data.skills ?? [];
    const seenSkills = new Set<string>();
    for (const s of skillsRaw) {
      const skillName = typeof s === "string" ? s : (s.skillName ?? s.name ?? "");
      if (!skillName) continue;
      const norm = normalizeSkill(skillName);
      if (seenSkills.has(norm)) continue;
      seenSkills.add(norm);
      await prisma.candidateSkill.create({
        data: {
          candidateId: existing.id,
          skillName,
          normalizedSkill: norm,
        },
      });
    }

    return { inserted: false, updated: true };
  }

  const candidate = await prisma.candidate.create({
    data: upsertData,
  });

  const positions = data.positions ?? [];
  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    await prisma.candidatePosition.create({
      data: {
        candidateId: candidate.id,
        companyName: p.companyName ?? "",
        title: p.title ?? "",
        employmentType: p.employmentType ?? null,
        startDate: parseDate(p.startDate),
        endDate: parseDate(p.endDate),
        isCurrent: p.isCurrent ?? false,
        description: p.description ?? null,
        locationText: p.locationText ?? null,
        sequenceIndex: i,
      },
    });
  }

  const educations = data.educations ?? [];
  for (const e of educations) {
    await prisma.candidateEducation.create({
      data: {
        candidateId: candidate.id,
        schoolName: e.schoolName ?? null,
        degree: e.degree ?? null,
        fieldOfStudy: e.fieldOfStudy ?? null,
        startDate: parseDate(e.startDate),
        endDate: parseDate(e.endDate),
        description: e.description ?? null,
      },
    });
  }

  const skillsRaw = data.skills ?? [];
  const seenSkills = new Set<string>();
  for (const s of skillsRaw) {
    const skillName = typeof s === "string" ? s : (s.skillName ?? s.name ?? "");
    if (!skillName) continue;
    const norm = normalizeSkill(skillName);
    if (seenSkills.has(norm)) continue;
    seenSkills.add(norm);
    await prisma.candidateSkill.create({
      data: {
        candidateId: candidate.id,
        skillName,
        normalizedSkill: norm,
      },
    });
  }

  return { inserted: true, updated: false };
}
