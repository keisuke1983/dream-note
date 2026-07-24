import { NextResponse } from "next/server";
import { generateAiTodaySuggestion, getDefaultAiProvider } from "../../../../lib/aiProviders";
import type { TodayAiSuggestionInput } from "../../../../lib/aiToday";

export const runtime = "nodejs";

function hasLikelyBrokenText(value?: string | null) {
  if (!value) return false;
  return /\uFFFD|縺|譛|螟|邵|隴|\?{3,}/.test(value);
}

function publicAiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (message.includes("GEMINI_API_KEY") || message.includes("OPENAI_API_KEY") || message.includes("GROQ_API_KEY")) {
    return "今日やることAIを取得できませんでした。AIのAPIキーが未設定です。";
  }
  if (
    lower.includes("prepayment") ||
    lower.includes("depleted") ||
    lower.includes("billing") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many")
  ) {
    return "今日やることAIを取得できませんでした。AI APIの利用枠または課金設定を確認してください。";
  }
  if (message.includes("JSON") || message.includes("Schema") || message.includes("応答形式")) {
    return "今日やることAIを取得できませんでした。AIの応答形式を確認してください。もう一度お試しください。";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "今日やることAIを取得できませんでした。通信がタイムアウトしました。もう一度お試しください。";
  }
  return "今日やることAIを取得できませんでした。時間をおいてもう一度お試しください。";
}

export async function POST(request: Request) {
  let input: TodayAiSuggestionInput;
  try {
    const body = (await request.json()) as { input?: TodayAiSuggestionInput };
    if (!body.input || !Array.isArray(body.input.tasks) || body.input.tasks.length === 0) {
      return NextResponse.json({ error: "AIに渡せる未完了タスクがありません。" }, { status: 400 });
    }
    input = {
      ...body.input,
      tasks: body.input.tasks.slice(0, 12),
      active_dreams: (body.input.active_dreams ?? []).slice(0, 8)
    };

    const textValues = [
      ...input.tasks.flatMap((task) => [task.title, task.memo, task.dream_title, task.goal_title]),
      ...input.active_dreams.flatMap((dream) => [dream.title, dream.desired_state]),
      input.recent_reflection?.done_text,
      input.recent_reflection?.not_done_text,
      input.recent_reflection?.dream_progress_text,
      input.recent_reflection?.tomorrow_text
    ];
    if (textValues.some(hasLikelyBrokenText)) {
      return NextResponse.json(
        { error: "今日やることAIを取得できませんでした。入力文字が壊れている可能性があります。内容を確認してください。" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "今日やることAIを取得できませんでした。入力を確認してください。" }, { status: 400 });
  }

  try {
    const suggestion = await generateAiTodaySuggestion(input);
    return NextResponse.json({ suggestion, provider: getDefaultAiProvider() });
  } catch (error) {
    return NextResponse.json({ error: publicAiError(error) }, { status: 500 });
  }
}
