import { NextResponse } from "next/server";
import { generateAiWeeklyReview, getDefaultAiProvider } from "../../../../lib/aiProviders";
import type { WeeklyReviewInput } from "../../../../lib/aiWeekly";

export const runtime = "nodejs";

function hasLikelyBrokenText(value?: string | null) {
  if (!value) return false;
  return /\uFFFD|縺|譛|螟|邵|隴|\?{3,}/.test(value);
}

function publicAiError(error: unknown) {
  const message = error instanceof Error ? error.message : "";
  const lower = message.toLowerCase();

  if (message.includes("GEMINI_API_KEY") || message.includes("OPENAI_API_KEY") || message.includes("GROQ_API_KEY")) {
    return "週次レビューAIを取得できませんでした。AIのAPIキーが未設定です。";
  }
  if (
    lower.includes("prepayment") ||
    lower.includes("depleted") ||
    lower.includes("billing") ||
    lower.includes("quota") ||
    lower.includes("rate limit") ||
    lower.includes("too many")
  ) {
    return "週次レビューAIを取得できませんでした。AI APIの利用枠または課金設定を確認してください。";
  }
  if (message.includes("JSON") || message.includes("Schema") || message.includes("応答形式")) {
    return "週次レビューAIを取得できませんでした。AIの応答形式を確認してください。もう一度お試しください。";
  }
  if (lower.includes("timeout") || lower.includes("timed out")) {
    return "週次レビューAIを取得できませんでした。通信がタイムアウトしました。もう一度お試しください。";
  }
  return "週次レビューAIを取得できませんでした。時間をおいてもう一度お試しください。";
}

export async function POST(request: Request) {
  let input: WeeklyReviewInput;
  try {
    const body = (await request.json()) as { input?: WeeklyReviewInput };
    if (!body.input) {
      return NextResponse.json({ error: "週次レビューに必要なデータがありません。" }, { status: 400 });
    }

    input = {
      ...body.input,
      completed_tasks: (body.input.completed_tasks ?? []).slice(0, 40),
      active_dreams: (body.input.active_dreams ?? []).slice(0, 12),
      reflections: (body.input.reflections ?? []).slice(0, 7)
    };

    if (input.completed_tasks.length === 0 && input.reflections.length === 0) {
      return NextResponse.json({ error: "今週の完了タスクまたは振り返りがまだありません。" }, { status: 400 });
    }

    const textValues = [
      ...input.completed_tasks.flatMap((task) => [task.title, task.dream_title, task.goal_title]),
      ...input.active_dreams.flatMap((dream) => [dream.title, dream.category, dream.desired_state]),
      ...input.reflections.flatMap((reflection) => [
        reflection.done_text,
        reflection.not_done_text,
        reflection.dream_progress_text,
        reflection.tomorrow_text,
        reflection.insight_text
      ])
    ];
    if (textValues.some(hasLikelyBrokenText)) {
      return NextResponse.json(
        { error: "週次レビューAIを取得できませんでした。入力文字が壊れている可能性があります。内容を確認してください。" },
        { status: 400 }
      );
    }
  } catch {
    return NextResponse.json({ error: "週次レビューAIを取得できませんでした。入力を確認してください。" }, { status: 400 });
  }

  try {
    const review = await generateAiWeeklyReview(input);
    return NextResponse.json({ review, provider: getDefaultAiProvider() });
  } catch (error) {
    return NextResponse.json({ error: publicAiError(error) }, { status: 500 });
  }
}
