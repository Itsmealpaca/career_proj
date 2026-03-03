import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ingestCandidate, normalizeLinkedInExport } from "@/lib/ingest";
import { readFile } from "fs/promises";
import path from "path";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const BATCH_SIZE = 50;

  try {
    const body = await req.json();
    const { filename, offset: reqOffset = 0, limit: reqLimit = BATCH_SIZE, runId: existingRunId } = body as {
      filename?: string;
      offset?: number;
      limit?: number;
      runId?: string;
    };

    if (!filename) {
      return NextResponse.json({ error: "filename required" }, { status: 400 });
    }

    const filepath = path.join(process.cwd(), "uploads", path.basename(filename));
    const content = await readFile(filepath, "utf-8");
    const parsed: unknown = JSON.parse(content);

    let items: unknown[] = [];
    if (Array.isArray(parsed)) {
      items = parsed;
    } else if (parsed && typeof parsed === "object") {
      items = [parsed];
    }

    const offset = Math.max(0, Math.floor(reqOffset));
    const limit = Math.min(100, Math.max(1, Math.floor(reqLimit)));
    const batch = items.slice(offset, offset + limit);
    const total = items.length;
    const isFirstBatch = !existingRunId;
    const isLastBatch = offset + limit >= total;

    let run: { id: string; inserted: number; updated: number; failed: number };
    if (isFirstBatch) {
      run = await prisma.ingestRun.create({
        data: { total },
      });
    } else {
      const existing = await prisma.ingestRun.findUnique({
        where: { id: existingRunId },
      });
      if (!existing) {
        return NextResponse.json({ error: "run not found" }, { status: 400 });
      }
      run = { id: existing.id, inserted: existing.inserted, updated: existing.updated, failed: existing.failed };
    }

    let inserted = 0;
    let updated = 0;
    let failed = 0;

    for (let i = 0; i < batch.length; i++) {
      const item = batch[i];
      const globalIndex = offset + i;
      const candidateKey =
        item && typeof item === "object" && "linkedinUrl" in item
          ? String((item as { linkedinUrl?: unknown }).linkedinUrl)
          : item && typeof item === "object" && "profileUrl" in item
            ? String((item as { profileUrl?: unknown }).profileUrl)
            : item && typeof item === "object" && "profileId" in item
              ? String((item as { profileId?: unknown }).profileId)
              : item && typeof item === "object" && "sourceProfileId" in item
                ? String((item as { sourceProfileId?: unknown }).sourceProfileId)
                : `item-${globalIndex}`;

      try {
        const normalized = normalizeLinkedInExport(item);
        const result = await ingestCandidate(normalized, run.id);
        if (result.inserted) inserted++;
        if (result.updated) updated++;
      } catch (err) {
        failed++;
        await prisma.ingestError.create({
          data: {
            runId: run.id,
            candidateKey,
            errorMessage: err instanceof Error ? err.message : String(err),
            rawFragment: item as object,
          },
        });
      }
    }

    const newInserted = run.inserted + inserted;
    const newUpdated = run.updated + updated;
    const newFailed = run.failed + failed;

    await prisma.ingestRun.update({
      where: { id: run.id },
      data: {
        ...(isLastBatch ? { finishedAt: new Date() } : {}),
        inserted: newInserted,
        updated: newUpdated,
        failed: newFailed,
      },
    });

    const nextOffset = offset + limit < total ? offset + limit : null;

    return NextResponse.json({
      success: true,
      runId: run.id,
      total,
      processed: offset + batch.length,
      inserted,
      updated,
      failed,
      nextOffset,
    });
  } catch (err) {
    console.error("Ingest error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Ingest failed" },
      { status: 500 }
    );
  }
}
