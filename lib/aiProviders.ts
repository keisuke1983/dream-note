import {
  aiDreamSuggestionJsonSchema,
  buildDreamClarificationPrompt,
  type AiDreamSuggestionOutput,
  type DreamClarificationInput
} from "./aiDream";
import {
  buildTodayAiPrompt,
  todayAiSuggestionJsonSchema,
  type TodayAiSuggestionInput,
  type TodayAiSuggestionOutput
} from "./aiToday";
import {
  buildWeeklyReviewPrompt,
  weeklyReviewJsonSchema,
  type WeeklyReviewInput,
  type WeeklyReviewOutput
} from "./aiWeekly";

type AiProvider = "gemini" | "openai" | "groq";

class AiOutputFormatError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AiOutputFormatError";
  }
}

const systemInstruction =
  "あなたは夢を目標と最初の行動へ変換するプロダクトAIです。必ず日本語で、指定されたJSON Schemaに従い、具体的で現実的な提案だけを返してください。";

function selectedProvider(): AiProvider {
  const configured = process.env.AI_PROVIDER?.toLowerCase();
  if (configured === "groq") return "groq";
  if (configured === "openai") return "openai";
  return "gemini";
}

function extractOpenAiOutputText(response: unknown) {
  const maybe = response as {
    output_text?: string;
    output?: Array<{ content?: Array<{ text?: string }> }>;
  };
  if (typeof maybe.output_text === "string" && maybe.output_text.trim()) return maybe.output_text;
  for (const item of maybe.output ?? []) {
    for (const content of item.content ?? []) {
      if (typeof content.text === "string" && content.text.trim()) return content.text;
    }
  }
  return "";
}

function extractGeminiOutputText(response: unknown) {
  const maybe = response as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return maybe.candidates?.[0]?.content?.parts?.map((part) => part.text ?? "").join("").trim() ?? "";
}

function extractChatCompletionOutputText(response: unknown) {
  const maybe = response as {
    choices?: Array<{
      message?: {
        content?: string | null;
        parsed?: unknown;
      };
    }>;
  };
  const message = maybe.choices?.[0]?.message;
  if (typeof message?.content === "string" && message.content.trim()) return message.content.trim();
  if (message?.parsed && typeof message.parsed === "object") return JSON.stringify(message.parsed);
  return "";
}

function extractFirstJsonObject(outputText: string) {
  const start = outputText.indexOf("{");
  if (start < 0) return "";

  let depth = 0;
  let inString = false;
  let escaped = false;

  for (let index = start; index < outputText.length; index += 1) {
    const char = outputText[index];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (char === "\\") {
      escaped = true;
      continue;
    }
    if (char === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (char === "{") depth += 1;
    if (char === "}") depth -= 1;
    if (depth === 0) return outputText.slice(start, index + 1);
  }

  return "";
}

function parseSuggestion(outputText: string): AiDreamSuggestionOutput {
  try {
    return JSON.parse(outputText) as AiDreamSuggestionOutput;
  } catch {
    const extracted = extractFirstJsonObject(outputText);
    if (!extracted) throw new AiOutputFormatError("AIのJSONを解析できませんでした。");
    try {
      return JSON.parse(extracted) as AiDreamSuggestionOutput;
    } catch {
      throw new AiOutputFormatError("AIのJSONを解析できませんでした。");
    }
  }
}

function parseJsonOutput<T>(outputText: string, errorMessage = "AIのJSONを解析できませんでした。"): T {
  try {
    return JSON.parse(outputText) as T;
  } catch {
    const extracted = extractFirstJsonObject(outputText);
    if (!extracted) throw new AiOutputFormatError(errorMessage);
    try {
      return JSON.parse(extracted) as T;
    } catch {
      throw new AiOutputFormatError(errorMessage);
    }
  }
}

function cleanText(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function normalizeSuggestion(suggestion: AiDreamSuggestionOutput): AiDreamSuggestionOutput {
  if (!suggestion || typeof suggestion !== "object") throw new AiOutputFormatError("AIの応答形式が不正です。");
  if (!suggestion.clarified_dream) throw new AiOutputFormatError("clarified_dream が不足しています。");

  const assumptions = Array.isArray(suggestion.assumptions)
    ? suggestion.assumptions.filter((assumption) => typeof assumption === "string" && assumption.trim()).slice(0, 4)
    : [];
  if (assumptions.length < 1) assumptions.push("不足情報があるため、現時点で分かる内容から提案しています。");

  const milestones = Array.isArray(suggestion.milestones)
    ? suggestion.milestones
        .filter(
          (milestone) =>
            milestone &&
            typeof milestone === "object" &&
            typeof milestone.title === "string" &&
            typeof milestone.description === "string" &&
            typeof milestone.target_period === "string"
        )
        .slice(0, 5)
        .map((milestone) => ({
          title: cleanText(milestone.title, "目標を具体化する"),
          description: cleanText(milestone.description, "前進したと言える状態を具体化する。"),
          target_period: cleanText(milestone.target_period, "1か月以内"),
          suggested_goal_level: inferGoalLevel(milestone.target_period)
        }))
    : [];
  if (milestones.length < 1) {
    milestones.push({
      title: "現状と達成条件を整理する",
      description: "今の状態、理想の状態、不足している条件を短く書き出し、最初に動く方向を決める。",
      target_period: "1週間以内",
      suggested_goal_level: "monthly"
    });
  }
  if (milestones.length < 2) {
    milestones.push({
      title: "最初の改善行動を実行する",
      description: "整理した内容から、今日または今週中にできる小さな行動を1つ完了する。",
      target_period: "2週間以内",
      suggested_goal_level: "monthly"
    });
  }

  const firstActions = Array.isArray(suggestion.first_actions)
    ? suggestion.first_actions
        .filter(
          (action) =>
            action &&
            typeof action === "object" &&
            typeof action.title === "string" &&
            typeof action.reason === "string"
        )
        .slice(0, 3)
        .map((action) => ({
          title: cleanText(action.title, "30分使って最初に確認することを3つ書き出す"),
          reason: cleanText(action.reason, "最初の行動を小さくすると今日から始めやすいため。"),
          completion_condition: cleanText(action.completion_condition, "メモに3項目を書き出した状態"),
          estimated_minutes: Math.min(60, Math.max(15, Math.round(Number(action.estimated_minutes) || 30)))
        }))
    : [];

  return {
    clarified_dream: {
      title: cleanText(suggestion.clarified_dream.title, "夢を具体化する"),
      description: cleanText(suggestion.clarified_dream.description, "夢を実行可能な状態へ具体化する。"),
      success_definition: cleanText(suggestion.clarified_dream.success_definition, "達成状態を具体的に説明できる状態")
    },
    assumptions,
    milestones,
    first_actions: firstActions
  };
}

function validateSuggestion(suggestion: AiDreamSuggestionOutput) {
  const levels = ["ten_year", "three_year", "one_year", "monthly", "daily"];
  if (!suggestion || typeof suggestion !== "object") throw new AiOutputFormatError("AIの応答形式が不正です。");
  if (!suggestion.clarified_dream) throw new AiOutputFormatError("clarified_dream が不足しています。");
  if (typeof suggestion.clarified_dream.title !== "string") throw new AiOutputFormatError("clarified_dream.title が不正です。");
  if (typeof suggestion.clarified_dream.description !== "string") throw new AiOutputFormatError("clarified_dream.description が不正です。");
  if (typeof suggestion.clarified_dream.success_definition !== "string") {
    throw new AiOutputFormatError("clarified_dream.success_definition が不正です。");
  }
  if (!Array.isArray(suggestion.assumptions) || suggestion.assumptions.length < 1 || suggestion.assumptions.length > 4) {
    throw new AiOutputFormatError("assumptions が不正です。");
  }
  if (!Array.isArray(suggestion.milestones) || suggestion.milestones.length < 2 || suggestion.milestones.length > 5) {
    throw new AiOutputFormatError("milestones が不正です。");
  }
  for (const milestone of suggestion.milestones) {
    if (typeof milestone.title !== "string") throw new AiOutputFormatError("milestone.title が不正です。");
    if (typeof milestone.description !== "string") throw new AiOutputFormatError("milestone.description が不正です。");
    if (typeof milestone.target_period !== "string") throw new AiOutputFormatError("milestone.target_period が不正です。");
    if (!levels.includes(milestone.suggested_goal_level)) throw new AiOutputFormatError("milestone.suggested_goal_level が不正です。");
  }
  if (!Array.isArray(suggestion.first_actions) || suggestion.first_actions.length < 1 || suggestion.first_actions.length > 3) {
    throw new AiOutputFormatError("first_actions が不正です。");
  }
  for (const action of suggestion.first_actions) {
    if (typeof action.title !== "string") throw new AiOutputFormatError("first_action.title が不正です。");
    if (typeof action.reason !== "string") throw new AiOutputFormatError("first_action.reason が不正です。");
    if (typeof action.completion_condition !== "string") throw new AiOutputFormatError("first_action.completion_condition が不正です。");
    if (!Number.isInteger(action.estimated_minutes) || action.estimated_minutes < 15 || action.estimated_minutes > 60) {
      throw new AiOutputFormatError("first_action.estimated_minutes が不正です。");
    }
  }
}

function inferGoalLevel(targetPeriod: string): AiDreamSuggestionOutput["milestones"][number]["suggested_goal_level"] {
  if (/今日|本日|daily/i.test(targetPeriod)) return "daily";
  if (/今週|来週|今月|来月|月|週間|週|monthly/i.test(targetPeriod)) return "monthly";

  const match = targetPeriod.match(/\d{4}-\d{2}-\d{2}/);
  if (match) {
    const target = new Date(`${match[0]}T00:00:00Z`).getTime();
    const now = Date.now();
    const days = Math.ceil((target - now) / 86400000);
    if (days <= 14) return "daily";
    if (days <= 45) return "monthly";
    if (days <= 540) return "one_year";
    if (days <= 1460) return "three_year";
    return "ten_year";
  }

  if (/10年|十年|ten/i.test(targetPeriod)) return "ten_year";
  if (/3年|三年|three/i.test(targetPeriod)) return "three_year";
  if (/1年|一年|年|one/i.test(targetPeriod)) return "one_year";
  return "monthly";
}

function finalizeSuggestion(suggestion: AiDreamSuggestionOutput) {
  const normalized = normalizeSuggestion(suggestion);
  validateSuggestion(normalized);
  return normalized;
}

function normalizeTodaySuggestion(
  suggestion: TodayAiSuggestionOutput,
  input: TodayAiSuggestionInput
): TodayAiSuggestionOutput {
  if (!suggestion || typeof suggestion !== "object") throw new AiOutputFormatError("AIの応答形式が不正です。");
  const validTaskIds = new Set(input.tasks.map((task) => task.id));
  const recommendations = Array.isArray(suggestion.recommendations)
    ? suggestion.recommendations
        .filter(
          (item) =>
            item &&
            typeof item === "object" &&
            typeof item.task_id === "string" &&
            validTaskIds.has(item.task_id) &&
            typeof item.reason === "string" &&
            typeof item.dream_connection === "string"
        )
        .slice(0, 6)
        .map((item, index) => ({
          task_id: item.task_id,
          priority_label:
            item.priority_label === "今すぐ" || item.priority_label === "重要" || item.priority_label === "未来投資"
              ? item.priority_label
              : input.tasks.find((task) => task.id === item.task_id)?.urgent
                ? "今すぐ"
                : input.tasks.find((task) => task.id === item.task_id)?.important
                  ? "未来投資"
                  : "重要",
          reason: cleanText(item.reason, "今日の前進につながるため。"),
          dream_connection: cleanText(item.dream_connection, "未紐づけだが期限/重要度から優先"),
          suggested_order: Number.isInteger(item.suggested_order) ? Math.min(6, Math.max(1, item.suggested_order)) : index + 1
        }))
    : [];

  if (recommendations.length < 1 && input.tasks[0]) {
    recommendations.push({
      task_id: input.tasks[0].id,
      priority_label: input.tasks[0].urgent ? "今すぐ" : input.tasks[0].important ? "未来投資" : "重要",
      reason: "期限・重要度・夢とのつながりを踏まえて、今日の最初の候補にします。",
      dream_connection: input.tasks[0].dream_title
        ? `${input.tasks[0].dream_title}につながる行動`
        : "未紐づけだが期限/重要度から優先",
      suggested_order: 1
    });
  }

  return {
    headline: cleanText(suggestion.headline, "今日の前進ポイント"),
    summary: cleanText(suggestion.summary, "緊急タスクだけでなく、夢につながる重要行動も含めて選びました。"),
    recommendations: recommendations.sort((a, b) => a.suggested_order - b.suggested_order),
    caution: cleanText(suggestion.caution, "AI提案は既存タスクを変更しません。必要に応じて自分で調整してください。")
  };
}

function validateTodaySuggestion(suggestion: TodayAiSuggestionOutput, input: TodayAiSuggestionInput) {
  const validTaskIds = new Set(input.tasks.map((task) => task.id));
  if (typeof suggestion.headline !== "string") throw new AiOutputFormatError("headline が不正です。");
  if (typeof suggestion.summary !== "string") throw new AiOutputFormatError("summary が不正です。");
  if (typeof suggestion.caution !== "string") throw new AiOutputFormatError("caution が不正です。");
  if (!Array.isArray(suggestion.recommendations) || suggestion.recommendations.length < 1 || suggestion.recommendations.length > 6) {
    throw new AiOutputFormatError("recommendations が不正です。");
  }
  const used = new Set<string>();
  for (const recommendation of suggestion.recommendations) {
    if (!validTaskIds.has(recommendation.task_id)) throw new AiOutputFormatError("存在しないtask_idが含まれています。");
    if (used.has(recommendation.task_id)) throw new AiOutputFormatError("task_idが重複しています。");
    used.add(recommendation.task_id);
    if (!["今すぐ", "重要", "未来投資"].includes(recommendation.priority_label)) {
      throw new AiOutputFormatError("priority_label が不正です。");
    }
    if (typeof recommendation.reason !== "string") throw new AiOutputFormatError("reason が不正です。");
    if (typeof recommendation.dream_connection !== "string") throw new AiOutputFormatError("dream_connection が不正です。");
    if (!Number.isInteger(recommendation.suggested_order)) throw new AiOutputFormatError("suggested_order が不正です。");
  }
}

function finalizeTodaySuggestion(suggestion: TodayAiSuggestionOutput, input: TodayAiSuggestionInput) {
  const normalized = normalizeTodaySuggestion(suggestion, input);
  validateTodaySuggestion(normalized, input);
  return normalized;
}

function normalizeStringList(value: unknown, fallback: string[], maxItems: number) {
  const list = Array.isArray(value) ? value.filter((item) => typeof item === "string" && item.trim()).slice(0, maxItems) : [];
  return list.length > 0 ? list : fallback;
}

function normalizeWeeklyReview(review: WeeklyReviewOutput, input: WeeklyReviewInput): WeeklyReviewOutput {
  if (!review || typeof review !== "object") throw new AiOutputFormatError("AIの応答形式が不正です。");
  const neglectedFallback = input.active_dreams
    .filter((dream) => dream.completed_task_count === 0)
    .slice(0, 5)
    .map((dream) => `${dream.title}: 今週の完了タスクなし`);

  return {
    headline: cleanText(review.headline, "今週の夢への前進レビュー"),
    facts: normalizeStringList(
      review.facts,
      [
        `完了タスクは${input.stats.completed_total}件です。`,
        `緊急タスクの完了は${input.stats.urgent_completed}件です。`,
        `第2領域タスクの完了は${input.stats.second_quadrant_completed}件です。`
      ],
      6
    ),
    insights: normalizeStringList(
      review.insights,
      ["完了実績から、来週も夢につながる重要行動を先に確保するとよさそうです。"],
      5
    ),
    neglected_dreams: normalizeStringList(review.neglected_dreams, neglectedFallback, 5),
    next_week_focus: normalizeStringList(
      review.next_week_focus,
      ["緊急ではないが重要なタスクを週前半に1件入れる。", "放置されている夢に関係する小さな行動を1件選ぶ。"],
      5
    ),
    urgent_bias: cleanText(review.urgent_bias, `緊急タスクは${input.stats.urgent_completed}件完了しています。`),
    second_quadrant_summary: cleanText(
      review.second_quadrant_summary,
      `第2領域タスクは${input.stats.second_quadrant_completed}件完了しています。`
    ),
    caution: cleanText(review.caution, "AIレビューは既存データを変更しません。来週の行動は自分で選んで登録してください。")
  };
}

function validateWeeklyReview(review: WeeklyReviewOutput) {
  if (typeof review.headline !== "string") throw new AiOutputFormatError("headline が不正です。");
  if (!Array.isArray(review.facts) || review.facts.length < 3 || review.facts.length > 6) throw new AiOutputFormatError("facts が不正です。");
  if (!Array.isArray(review.insights) || review.insights.length < 1 || review.insights.length > 5) {
    throw new AiOutputFormatError("insights が不正です。");
  }
  if (!Array.isArray(review.neglected_dreams) || review.neglected_dreams.length > 5) {
    throw new AiOutputFormatError("neglected_dreams が不正です。");
  }
  if (!Array.isArray(review.next_week_focus) || review.next_week_focus.length < 2 || review.next_week_focus.length > 5) {
    throw new AiOutputFormatError("next_week_focus が不正です。");
  }
  if (typeof review.urgent_bias !== "string") throw new AiOutputFormatError("urgent_bias が不正です。");
  if (typeof review.second_quadrant_summary !== "string") throw new AiOutputFormatError("second_quadrant_summary が不正です。");
  if (typeof review.caution !== "string") throw new AiOutputFormatError("caution が不正です。");
}

function finalizeWeeklyReview(review: WeeklyReviewOutput, input: WeeklyReviewInput) {
  const normalized = normalizeWeeklyReview(review, input);
  validateWeeklyReview(normalized);
  return normalized;
}

function mapSchema(schema: unknown, shouldOmit: (key: string) => boolean, typeMapper?: (schema: Record<string, unknown>) => void): unknown {
  if (Array.isArray(schema)) return schema.map((item) => mapSchema(item, shouldOmit, typeMapper));
  if (!schema || typeof schema !== "object") return schema;

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(schema)) {
    if (shouldOmit(key)) continue;
    result[key] = mapSchema(value, shouldOmit, typeMapper);
  }
  typeMapper?.(result);
  return result;
}

function toGeminiSchema(schema: unknown): unknown {
  return mapSchema(schema, (key) => key === "additionalProperties");
}

function toGroqSchema(schema: unknown): unknown {
  return mapSchema(
    schema,
    (key) => ["additionalProperties", "minItems", "maxItems", "minimum", "maximum", "enum"].includes(key),
    (node) => {
      if (node.type === "integer") node.type = "number";
    }
  );
}

async function generateWithGemini(dream: DreamClarificationInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEYが未設定です。");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${buildDreamClarificationPrompt(dream)}` }]
        }
      ],
      generationConfig: {
        temperature: 0.35,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(aiDreamSuggestionJsonSchema)
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "Gemini APIでエラーが発生しました。";
    throw new Error(message);
  }

  const outputText = extractGeminiOutputText(payload);
  if (!outputText) throw new Error("Geminiの応答が空でした。");
  return finalizeSuggestion(parseSuggestion(outputText));
}

async function generateTodayWithGemini(input: TodayAiSuggestionInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEYが未設定です。");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${buildTodayAiPrompt(input)}` }]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(todayAiSuggestionJsonSchema)
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Gemini APIでエラーが発生しました。");
  const outputText = extractGeminiOutputText(payload);
  if (!outputText) throw new Error("Geminiの応答が空でした。");
  return finalizeTodaySuggestion(parseJsonOutput<TodayAiSuggestionOutput>(outputText), input);
}

async function generateWeeklyWithGemini(input: WeeklyReviewInput) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEYが未設定です。");

  const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey
    },
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [{ text: `${systemInstruction}\n\n${buildWeeklyReviewPrompt(input)}` }]
        }
      ],
      generationConfig: {
        temperature: 0.25,
        responseMimeType: "application/json",
        responseSchema: toGeminiSchema(weeklyReviewJsonSchema)
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "Gemini APIでエラーが発生しました。");
  const outputText = extractGeminiOutputText(payload);
  if (!outputText) throw new Error("Geminiの応答が空でした。");
  return finalizeWeeklyReview(parseJsonOutput<WeeklyReviewOutput>(outputText), input);
}

async function generateWithOpenAi(dream: DreamClarificationInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが未設定です。");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: buildDreamClarificationPrompt(dream) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "dream_clarification",
          strict: true,
          schema: aiDreamSuggestionJsonSchema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const message = payload?.error?.message || "OpenAI APIでエラーが発生しました。";
    throw new Error(message);
  }

  const outputText = extractOpenAiOutputText(payload);
  if (!outputText) throw new Error("OpenAIの応答が空でした。");
  return finalizeSuggestion(parseSuggestion(outputText));
}

async function generateTodayWithOpenAi(input: TodayAiSuggestionInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが未設定です。");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: buildTodayAiPrompt(input) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "today_actions",
          strict: true,
          schema: todayAiSuggestionJsonSchema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI APIでエラーが発生しました。");
  const outputText = extractOpenAiOutputText(payload);
  if (!outputText) throw new Error("OpenAIの応答が空でした。");
  return finalizeTodaySuggestion(parseJsonOutput<TodayAiSuggestionOutput>(outputText), input);
}

async function generateWeeklyWithOpenAi(input: WeeklyReviewInput) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEYが未設定です。");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      input: [
        { role: "system", content: systemInstruction },
        { role: "user", content: buildWeeklyReviewPrompt(input) }
      ],
      text: {
        format: {
          type: "json_schema",
          name: "weekly_review",
          strict: true,
          schema: weeklyReviewJsonSchema
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) throw new Error(payload?.error?.message || "OpenAI APIでエラーが発生しました。");
  const outputText = extractOpenAiOutputText(payload);
  if (!outputText) throw new Error("OpenAIの応答が空でした。");
  return finalizeWeeklyReview(parseJsonOutput<WeeklyReviewOutput>(outputText), input);
}

function isGroqStructuredOutputError(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("json") ||
    lower.includes("schema") ||
    lower.includes("structured") ||
    lower.includes("failed_generation") ||
    lower.includes("tool_use_failed")
  );
}

async function generateWithGroqOnce(dream: DreamClarificationInput, retry: boolean) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEYが未設定です。");

  const prompt = retry
    ? `${buildDreamClarificationPrompt(dream)}

前回の出力がJSON Schemaに適合しませんでした。今回はMarkdown、説明文、コードブロックを一切付けず、指定Schemaに合うJSONオブジェクトだけを返してください。配列の件数と必須フィールドを必ず守ってください。`
    : buildDreamClarificationPrompt(dream);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      temperature: retry ? 0.15 : 0.25,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "dream_clarification",
          strict: false,
          schema: toGroqSchema(aiDreamSuggestionJsonSchema)
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = [payload?.error?.message, payload?.error?.code, payload?.error?.failed_generation]
      .filter(Boolean)
      .join(" ");
    if (isGroqStructuredOutputError(detail)) throw new AiOutputFormatError("Groqの応答形式が不正です。");
    throw new Error(detail || "Groq APIでエラーが発生しました。");
  }

  const outputText = extractChatCompletionOutputText(payload);
  if (!outputText) throw new AiOutputFormatError("Groqの応答が空でした。");
  return finalizeSuggestion(parseSuggestion(outputText));
}

async function generateTodayWithGroqOnce(input: TodayAiSuggestionInput, retry: boolean) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEYが未設定です。");

  const prompt = retry
    ? `${buildTodayAiPrompt(input)}

前回の出力がJSON Schemaに適合しませんでした。今回はMarkdown、説明文、コードブロックを一切付けず、指定Schemaに合うJSONオブジェクトだけを返してください。recommendationsのtask_idは入力tasksに存在するidだけにしてください。`
    : buildTodayAiPrompt(input);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      temperature: retry ? 0.1 : 0.2,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "today_actions",
          strict: false,
          schema: toGroqSchema(todayAiSuggestionJsonSchema)
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = [payload?.error?.message, payload?.error?.code, payload?.error?.failed_generation]
      .filter(Boolean)
      .join(" ");
    if (isGroqStructuredOutputError(detail)) throw new AiOutputFormatError("Groqの応答形式が不正です。");
    throw new Error(detail || "Groq APIでエラーが発生しました。");
  }

  const outputText = extractChatCompletionOutputText(payload);
  if (!outputText) throw new AiOutputFormatError("Groqの応答が空でした。");
  return finalizeTodaySuggestion(parseJsonOutput<TodayAiSuggestionOutput>(outputText), input);
}

async function generateWeeklyWithGroqOnce(input: WeeklyReviewInput, retry: boolean) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) throw new Error("GROQ_API_KEYが未設定です。");

  const prompt = retry
    ? `${buildWeeklyReviewPrompt(input)}

前回の出力がJSON Schemaに適合しませんでした。今回はMarkdown、説明文、コードブロックを一切付けず、指定Schemaに合うJSONオブジェクトだけを返してください。配列件数と必須フィールドを必ず守ってください。`
    : buildWeeklyReviewPrompt(input);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    signal: AbortSignal.timeout(45000),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: process.env.GROQ_MODEL || "openai/gpt-oss-20b",
      messages: [
        { role: "system", content: systemInstruction },
        { role: "user", content: prompt }
      ],
      temperature: retry ? 0.1 : 0.2,
      reasoning_effort: "low",
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "weekly_review",
          strict: false,
          schema: toGroqSchema(weeklyReviewJsonSchema)
        }
      }
    })
  });

  const payload = await response.json();
  if (!response.ok) {
    const detail = [payload?.error?.message, payload?.error?.code, payload?.error?.failed_generation]
      .filter(Boolean)
      .join(" ");
    if (isGroqStructuredOutputError(detail)) throw new AiOutputFormatError("Groqの応答形式が不正です。");
    throw new Error(detail || "Groq APIでエラーが発生しました。");
  }

  const outputText = extractChatCompletionOutputText(payload);
  if (!outputText) throw new AiOutputFormatError("Groqの応答が空でした。");
  return finalizeWeeklyReview(parseJsonOutput<WeeklyReviewOutput>(outputText), input);
}

async function generateWithGroq(dream: DreamClarificationInput) {
  try {
    return await generateWithGroqOnce(dream, false);
  } catch (error) {
    if (error instanceof AiOutputFormatError) {
      return generateWithGroqOnce(dream, true);
    }
    throw error;
  }
}

async function generateTodayWithGroq(input: TodayAiSuggestionInput) {
  try {
    return await generateTodayWithGroqOnce(input, false);
  } catch (error) {
    if (error instanceof AiOutputFormatError) {
      return generateTodayWithGroqOnce(input, true);
    }
    throw error;
  }
}

async function generateWeeklyWithGroq(input: WeeklyReviewInput) {
  try {
    return await generateWeeklyWithGroqOnce(input, false);
  } catch (error) {
    if (error instanceof AiOutputFormatError) {
      return generateWeeklyWithGroqOnce(input, true);
    }
    throw error;
  }
}

export async function generateAiDreamSuggestion(dream: DreamClarificationInput) {
  if (selectedProvider() === "groq") return generateWithGroq(dream);
  if (selectedProvider() === "openai") return generateWithOpenAi(dream);
  return generateWithGemini(dream);
}

export async function generateAiTodaySuggestion(input: TodayAiSuggestionInput) {
  if (selectedProvider() === "groq") return generateTodayWithGroq(input);
  if (selectedProvider() === "openai") return generateTodayWithOpenAi(input);
  return generateTodayWithGemini(input);
}

export async function generateAiWeeklyReview(input: WeeklyReviewInput) {
  if (selectedProvider() === "groq") return generateWeeklyWithGroq(input);
  if (selectedProvider() === "openai") return generateWeeklyWithOpenAi(input);
  return generateWeeklyWithGemini(input);
}

export function getDefaultAiProvider() {
  return selectedProvider();
}
