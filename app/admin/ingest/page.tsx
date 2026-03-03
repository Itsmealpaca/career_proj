"use client";

import { useEffect, useState } from "react";

interface IngestRun {
  id: string;
  startedAt: string;
  finishedAt: string | null;
  total: number;
  inserted: number;
  updated: number;
  failed: number;
  errorCount: number;
}

interface IngestError {
  id: string;
  candidateKey: string | null;
  errorMessage: string;
  rawFragment: unknown;
}

export default function AdminIngestPage() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadedFilename, setUploadedFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [ingestLoading, setIngestLoading] = useState(false);
  const [runs, setRuns] = useState<IngestRun[]>([]);
  const [errors, setErrors] = useState<IngestError[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  async function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!file) {
      setMessage({ type: "error", text: "파일을 선택하세요." });
      return;
    }

    setLoading(true);
    setMessage(null);
    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "업로드 실패");
      setUploadedFilename(data.filename);
      setMessage({ type: "success", text: `업로드 완료: ${data.filename}` });
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "업로드 실패",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleIngest(e: React.FormEvent) {
    e.preventDefault();
    if (!uploadedFilename) {
      setMessage({ type: "error", text: "먼저 JSON 파일을 업로드하세요." });
      return;
    }

    setIngestLoading(true);
    setMessage(null);

    const BATCH_SIZE = 50;
    let runId: string | undefined;
    let offset = 0;
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalFailed = 0;
    let totalProcessed = 0;

    try {
      while (true) {
        const body: { filename: string; offset: number; limit: number; runId?: string } = {
          filename: uploadedFilename,
          offset,
          limit: BATCH_SIZE,
        };
        if (runId) body.runId = runId;

        const res = await fetch("/api/ingest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "적재 실패");

        runId = data.runId;
        totalInserted += data.inserted ?? 0;
        totalUpdated += data.updated ?? 0;
        totalFailed += data.failed ?? 0;
        totalProcessed = data.processed ?? offset + BATCH_SIZE;

        if (data.nextOffset == null) {
          setMessage({
            type: "success",
            text: `적재 완료: 총 ${data.total}건 처리, 신규 ${totalInserted}건, 업데이트 ${totalUpdated}건, 실패 ${totalFailed}건`,
          });
          setUploadedFilename(null);
          setFile(null);
          break;
        }
        offset = data.nextOffset;
        setMessage({
          type: "success",
          text: `적재 중... ${totalProcessed}/${data.total}건`,
        });
      }

      const runsRes = await fetch("/api/ingest/runs?limit=10");
      const runsData = await runsRes.json();
      setRuns(runsData);
    } catch (err) {
      setMessage({
        type: "error",
        text: err instanceof Error ? err.message : "적재 실패",
      });
    } finally {
      setIngestLoading(false);
    }
  }

  useEffect(() => {
    async function fetchRuns() {
      const res = await fetch("/api/ingest/runs?limit=20");
      const data = await res.json();
      setRuns(data);
    }
    fetchRuns();
  }, []);

  async function loadErrors(runId: string) {
    setSelectedRunId(runId);
    const res = await fetch(`/api/ingest/errors?runId=${runId}`);
    const data = await res.json();
    setErrors(data);
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">적재 관리</h1>

      {message && (
        <div
          className={`mb-6 p-4 rounded-lg ${
            message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
          }`}
        >
          {message.text}
        </div>
      )}

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">파일 업로드</h2>
        <form onSubmit={handleUpload} className="flex gap-4 items-end flex-wrap">
          <div>
            <input
              type="file"
              accept=".json"
              onChange={(e) => {
                const f = e.target.files?.[0];
                setFile(f ?? null);
                if (!f) setUploadedFilename(null);
              }}
              className="block text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>
          <button
            type="submit"
            disabled={loading || !file}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "업로드 중..." : "업로드"}
          </button>
        </form>

        {uploadedFilename && (
          <p className="mt-4 text-sm text-gray-600">
            업로드된 파일: <strong>{uploadedFilename}</strong>
          </p>
        )}
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">적재 실행</h2>
        <p className="text-sm text-gray-600 mb-4">
          업로드한 JSON 파일을 DB에 적재합니다. profileUrl 또는 sourceProfileId 기준으로 upsert됩니다.
        </p>
        <button
          onClick={handleIngest}
          disabled={ingestLoading || !uploadedFilename}
          className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {ingestLoading ? "적재 중..." : "적재 실행"}
        </button>
      </div>

      <div className="bg-white rounded-lg shadow p-6 mb-8">
        <h2 className="text-lg font-semibold mb-4">최근 IngestRun</h2>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">시작</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">완료</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">총</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">신규</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">업데이트</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">실패</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">에러 조회</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm font-mono truncate max-w-[120px]">{r.id}</td>
                  <td className="px-4 py-2 text-sm">
                    {new Date(r.startedAt).toLocaleString("ko-KR")}
                  </td>
                  <td className="px-4 py-2 text-sm">
                    {r.finishedAt ? new Date(r.finishedAt).toLocaleString("ko-KR") : "-"}
                  </td>
                  <td className="px-4 py-2 text-sm">{r.total}</td>
                  <td className="px-4 py-2 text-sm text-green-600">{r.inserted}</td>
                  <td className="px-4 py-2 text-sm text-blue-600">{r.updated}</td>
                  <td className="px-4 py-2 text-sm text-red-600">{r.failed}</td>
                  <td className="px-4 py-2">
                    {r.errorCount > 0 && (
                      <button
                        onClick={() => loadErrors(r.id)}
                        className="text-sm text-blue-600 hover:underline"
                      >
                        {r.errorCount}건 조회
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {selectedRunId && errors.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold mb-4">실패 로그 (Run: {selectedRunId})</h2>
          <div className="space-y-4 max-h-96 overflow-auto">
            {errors.map((e) => (
              <div key={e.id} className="p-4 bg-red-50 rounded border border-red-200">
                <p className="font-medium text-red-800">
                  {e.candidateKey ?? "키 없음"}: {e.errorMessage}
                </p>
                {e.rawFragment != null && (
                  <pre className="mt-2 p-2 bg-white text-xs overflow-auto max-h-32">
                    {JSON.stringify(e.rawFragment, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
