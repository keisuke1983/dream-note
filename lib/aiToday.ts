export type TodayAiTaskInput = {
  id: string;
  title: string;
  memo?: string | null;
  due_date?: string | null;
  urgent: boolean;
  important: boolean;
  dream_title?: string | null;
  goal_title?: string | null;
  matrix_label: string;
  days_until_due: number | null;
  dream_recently_acted: boolean;
};

export type TodayAiSuggestionInput = {
  date: string;
  tasks: TodayAiTaskInput[];
  active_dreams: Array<{
    id: string;
    title: string;
    deadline?: string | null;
    desired_state?: string | null;
    recently_acted: boolean;
  }>;
  recent_reflection?: {
    done_text?: string | null;
    not_done_text?: string | null;
    dream_progress_text?: string | null;
    tomorrow_text?: string | null;
  } | null;
};

export type TodayAiSuggestionOutput = {
  headline: string;
  summary: string;
  recommendations: Array<{
    task_id: string;
    priority_label: "今すぐ" | "重要" | "未来投資";
    reason: string;
    dream_connection: string;
    suggested_order: number;
  }>;
  caution: string;
};

export const todayAiSuggestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "summary", "recommendations", "caution"],
  properties: {
    headline: { type: "string" },
    summary: { type: "string" },
    recommendations: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["task_id", "priority_label", "reason", "dream_connection", "suggested_order"],
        properties: {
          task_id: { type: "string" },
          priority_label: {
            type: "string",
            enum: ["今すぐ", "重要", "未来投資"]
          },
          reason: { type: "string" },
          dream_connection: { type: "string" },
          suggested_order: { type: "integer", minimum: 1, maximum: 6 }
        }
      }
    },
    caution: { type: "string" }
  }
} as const;

export function buildTodayAiPrompt(input: TodayAiSuggestionInput) {
  return `
あなたは「夢を実現するために、今日の行動を選ぶAI」です。
タスクを勝手に変更、削除、完了、追加してはいけません。
入力された未完了タスクの中から、今日優先すべき行動を選び、理由を短く説明してください。

日付: ${input.date}

判断基準:
- 緊急性と期限切れは無視しない。
- ただし緊急タスクだけで一日を埋めない。
- 「緊急ではないが重要」かつ夢や目標につながる行動を最低1つは含める。該当タスクがない場合は caution に明記する。
- 夢に最近行動できていない場合、その夢につながる重要タスクを優先する。
- 件数は固定しないが、朝に読めるよう1〜6件に絞る。
- おすすめ順は suggested_order で示す。
- recommendations の task_id は、必ず入力tasksに存在するidだけを使う。
- reason は「なぜ今日やるか」を1文で具体的に書く。
- dream_connection は「どの夢・目標につながるか」を短く書く。紐づきがない場合は「未紐づけだが期限/重要度から優先」とする。
- 文章量を増やしすぎない。

入力データ:
${JSON.stringify(input, null, 2)}

出力形式:
- 必ず指定されたJSON Schemaに適合するJSONオブジェクトだけを返す。
- Markdown、コードブロック、説明文、前置き、後書きは返さない。
`.trim();
}
