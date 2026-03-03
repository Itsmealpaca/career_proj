import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type EnrichedCompanyInfo = {
  description?: string | null;
  products?: string | null;
  keywords?: string[] | string | null;
  fundingRound?: string | null;
  totalFunding?: number | null;
  foundedAt?: string | null;
  headcount?: number | null;
  annualRevenue?: number | null;
};

export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
  });

  if (!company) {
    return NextResponse.json({ error: "Company not found" }, { status: 404 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured" },
      { status: 500 }
    );
  }

  const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";

  const systemPrompt = `
You are a research assistant that summarizes company information into a strict JSON object
for an internal admin tool. Never include explanations or markdown, only raw JSON.
`.trim();

  const userPrompt = `
다음 회사에 대해 정보를 요약해서 JSON으로만 반환해줘. 설명 텍스트는 모두 한국어로 작성해.

회사명: "${company.name}"

[요구 사항]
- description: 어떤 고객에게 어떤 이름의 어떤 서비스를 제공하는지 한 문단으로 설명.
- products: 주요 제품/서비스를 한 문단으로 요약.
- keywords: 회사의 도메인, 서비스, 기술을 나타내는 4개의 키워드 (문자열 배열).
- fundingRound: 가장 최근 투자 단계 (예: Seed, Series A, Series B, 상장, 비공개 등).
- totalFunding: 지금까지의 누적 투자 금액. 알 수 없으면 null. (정수, KRW 단위. 쉼표 없이 숫자만)
- foundedAt: 회사 설립일. "YYYY-MM-DD" 형식 문자열. 알 수 없으면 null. (괄호나 설명 붙이지 말 것)
- headcount: 가장 최근 기준 임직원 수. 추정치여도 숫자만 넣고, 알 수 없으면 null.
- annualRevenue: 직전 회계연도 매출액. 알 수 없으면 null. (정수, KRW 단위. 쉼표 없이 숫자만)

[반환 JSON 스키마]
{
  "description": "기업 개요",
  "products": "주요 제품/서비스",
  "keywords": ["keyword1", "keyword2", "keyword3", "keyword4"],
  "fundingRound": "투자 단계",
  "totalFunding": 123456789,
  "foundedAt": "YYYY-MM-DD",
  "headcount": 1234,
  "annualRevenue": 123456789
}

위와 같은 형태의 유효한 JSON 객체만 반환해줘.
마크다운(예: \`\`\`)이나 추가 텍스트, 주석(//)은 절대 넣지 말 것.
  `.trim();

let content: string | null = null;

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("OpenAI error:", text);
      return NextResponse.json(
        { error: "Failed to fetch company info from GPT" },
        { status: 502 }
      );
    }

    const json = await resp.json();
    content = json.choices?.[0]?.message?.content ?? null;
  } catch (e) {
    console.error("OpenAI request failed:", e);
    return NextResponse.json(
      { error: "Failed to call GPT provider" },
      { status: 502 }
    );
  }

  if (!content) {
    return NextResponse.json(
      { error: "Empty response from GPT provider" },
      { status: 502 }
    );
  }

  // GPT가 ```json ... ``` 형태로 감싸거나 앞뒤에 텍스트를 붙이는 경우를 대비해 JSON 부분만 추출
  function extractJsonBlock(text: string): string {
    const trimmed = text.trim();
    if (trimmed.startsWith("```")) {
      // ```json ... ``` 또는 ``` ... ``` 제거
      const withoutFence = trimmed.replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "");
      return withoutFence.trim();
    }
    // 첫 번째 { 부터 마지막 } 까지를 찾아 잘라냄
    const firstBrace = trimmed.indexOf("{");
    const lastBrace = trimmed.lastIndexOf("}");
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      return trimmed.slice(firstBrace, lastBrace + 1);
    }
    return trimmed;
  }

  let parsed: EnrichedCompanyInfo;
  try {
    const jsonText = extractJsonBlock(content);
    parsed = JSON.parse(jsonText) as EnrichedCompanyInfo;
  } catch (e) {
    console.error("Failed to parse GPT JSON:", e, content);
    return NextResponse.json(
      { error: "Failed to parse GPT JSON response" },
      { status: 502 }
    );
  }

  const data: Record<string, any> = {};
  if (typeof parsed.description === "string") data.description = parsed.description;
  if (typeof parsed.products === "string") data.products = parsed.products;

  if (Array.isArray(parsed.keywords)) {
    data.keywords = parsed.keywords.join(", ");
  } else if (typeof parsed.keywords === "string") {
    data.keywords = parsed.keywords;
  }

  if (typeof parsed.fundingRound === "string") data.fundingRound = parsed.fundingRound;

  const INT32_MAX = 2_147_483_647;
  const INT32_MIN = -2_147_483_648;

  if (
    typeof parsed.totalFunding === "number" &&
    parsed.totalFunding <= INT32_MAX &&
    parsed.totalFunding >= INT32_MIN
  ) {
    data.totalFunding = parsed.totalFunding;
  }

  if (
    typeof parsed.headcount === "number" &&
    parsed.headcount <= INT32_MAX &&
    parsed.headcount >= 0
  ) {
    data.headcount = parsed.headcount;
  }

  if (
    typeof parsed.annualRevenue === "number" &&
    parsed.annualRevenue <= INT32_MAX &&
    parsed.annualRevenue >= INT32_MIN
  ) {
    data.annualRevenue = parsed.annualRevenue;
  }

  if (typeof parsed.foundedAt === "string") {
    const d = new Date(parsed.foundedAt);
    if (!isNaN(d.getTime())) {
      (data as any).foundedAt = d;
    }
  }

  const updated = await prisma.company.update({
    where: { id: company.id },
    data,
  });

  return NextResponse.json({ company: updated });
}

