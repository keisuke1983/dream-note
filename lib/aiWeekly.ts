export type WeeklyReviewTaskInput = {
  id: string;
  title: string;
  completed_at: string;
  urgent: boolean;
  important: boolean;
  matrix_label: string;
  dream_title?: string | null;
  goal_title?: string | null;
};

export type WeeklyReviewInput = {
  week_start: string;
  week_end: string;
  completed_tasks: WeeklyReviewTaskInput[];
  active_dreams: Array<{
    id: string;
    title: string;
    category?: string | null;
    deadline?: string | null;
    desired_state?: string | null;
    completed_task_count: number;
    important_completed_count: number;
  }>;
  reflections: Array<{
    date: string;
    done_text?: string | null;
    not_done_text?: string | null;
    dream_progress_text?: string | null;
    tomorrow_text?: string | null;
    insight_text?: string | null;
    satisfaction_score?: number | null;
  }>;
  stats: {
    completed_total: number;
    urgent_completed: number;
    important_completed: number;
    second_quadrant_completed: number;
    unlinked_completed: number;
  };
};

export type WeeklyReviewOutput = {
  headline: string;
  facts: string[];
  insights: string[];
  neglected_dreams: string[];
  next_week_focus: string[];
  urgent_bias: string;
  second_quadrant_summary: string;
  caution: string;
};

export const weeklyReviewJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "headline",
    "facts",
    "insights",
    "neglected_dreams",
    "next_week_focus",
    "urgent_bias",
    "second_quadrant_summary",
    "caution"
  ],
  properties: {
    headline: { type: "string" },
    facts: {
      type: "array",
      minItems: 3,
      maxItems: 6,
      items: { type: "string" }
    },
    insights: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" }
    },
    neglected_dreams: {
      type: "array",
      minItems: 0,
      maxItems: 5,
      items: { type: "string" }
    },
    next_week_focus: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: { type: "string" }
    },
    urgent_bias: { type: "string" },
    second_quadrant_summary: { type: "string" },
    caution: { type: "string" }
  }
} as const;

export function buildWeeklyReviewPrompt(input: WeeklyReviewInput) {
  return `
あなたは「夢に向かって行動できたか」を週次で振り返るAIです。
チャットではなく、1〜2分で読める週次レビューを作成してください。

対象期間: ${input.week_start} 〜 ${input.week_end}

最重要ルール:
- 既存データを勝手に変更しない。
- タスクを自動登録しない。
- 感想文だけにしない。
- 必ず「事実 → 気づき → 来週の行動」の順で整理する。
- 入力データにない成果を作らない。
- 緊急タスクへの偏りと、第2領域タスクの実行状況を必ず見る。
- 放置されている夢があれば明記する。
- 来週の重点は、具体的だがタスクとして自動登録しない提案にする。
- スマホで読みやすい短文にする。

入力データ:
${JSON.stringify(input, null, 2)}

出力形式:
- 必ず指定されたJSON Schemaに適合するJSONオブジェクトだけを返す。
- Markdown、コードブロック、前置き、後書きは返さない。
`.trim();
}
