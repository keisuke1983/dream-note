import { NextResponse } from "next/server";
import { generateAiDreamSuggestion, getDefaultAiProvider } from "../../../../lib/aiProviders";
import type { DreamClarificationInput } from "../../../../lib/aiDream";

export const runtime = "nodejs";

function hasLikelyBrokenText(value?: string | null) {
  if (!value) return false;
  return /\uFFFD|縺|譛|螟|邵|隴|\?{3,}/.test(value);
}

function publicAiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (message.includes("GEMINI_API_KEY") || message.includes("OPENAI_API_KEY") || message.includes("GROQ_API_KEY")) {
    return "AI提案を取得できませんでした。AIのAPIキーが未設定です。";
  }
  if (
    lower.includes("prepayment") ||
    lower.includes("depleted") ||
    lower.includes("billing") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many")
  ) {
    return "AI提案を取得できませんでした。AI APIの利用枠または課金設定を確認してください。";
  }
  if (message.includes("JSON") || message.includes("Schema") || message.includes("応答形式")) {
    return "AI提案を取得できませんでした。AIの応答形式を確認してください。もう一度お試しください。";
  }
  if (lower.includes("groq")) {
    return "AI提案を取得できませんでした。Groq APIの設定または利用状況を確認してください。";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "AI提案を取得できませんでした。通信がタイムアウトしました。もう一度お試しください。";
  }
  return "AI提案を取得できませんでした。時間をおいてもう一度お試しください。";
}

export async function POST(request: Request) {
  let dream: DreamClarificationInput;
  try {
    const body = (await request.json()) as { dream?: DreamClarificationInput };
    if (!body.dream?.title?.trim()) {
      return NextResponse.json({ error: "AI提案を取得できませんでした。夢の内容が必要です。" }, { status: 400 });
    }
    dream = body.dream;
    if (
      hasLikelyBrokenText(dream.title) ||
      hasLikelyBrokenText(dream.reason) ||
      hasLikelyBrokenText(dream.category) ||
      hasLikelyBrokenText(dream.desired_state)
    ) {
      return NextResponse.json(
        { error: "AI提案を取得できませんでした。入力文字が壊れている可能性があります。内容を確認してください。" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "AI提案を取得できませんでした。入力を確認してください。" }, { status: 400 });
  }

  try {
    const suggestion = await generateAiDreamSuggestion(dream);
    return NextResponse.json({ suggestion, provider: getDefaultAiProvider() });
  } catch (error) {
    return NextResponse.json({ error: publicAiError(error) }, { status: 500 });
  }
}
