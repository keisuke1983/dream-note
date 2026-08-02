export type DreamClarificationInput = {
  title: string;
  reason?: string | null;
  deadline?: string | null;
  category?: string | null;
  desired_state?: string | null;
};

export type AiDreamSuggestionOutput = {
  clarified_dream: {
    title: string;
    description: string;
    success_definition: string;
  };
  assumptions: string[];
  milestones: Array<{
    title: string;
    description: string;
    target_period: string;
    suggested_goal_level: "twenty_year" | "ten_year" | "five_year" | "one_year" | "monthly" | "weekly" | "daily" | "three_year";
  }>;
  first_actions: Array<{
    title: string;
    reason: string;
    completion_condition: string;
    estimated_minutes: number;
  }>;
};

export const aiDreamSuggestionJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: ["clarified_dream", "assumptions", "milestones", "first_actions"],
  properties: {
    clarified_dream: {
      type: "object",
      additionalProperties: false,
      required: ["title", "description", "success_definition"],
      properties: {
        title: { type: "string" },
        description: { type: "string" },
        success_definition: { type: "string" }
      }
    },
    assumptions: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 4
    },
    milestones: {
      type: "array",
      minItems: 2,
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "description", "target_period", "suggested_goal_level"],
        properties: {
          title: { type: "string" },
          description: { type: "string" },
          target_period: { type: "string" },
          suggested_goal_level: {
            type: "string",
            enum: ["twenty_year", "ten_year", "five_year", "one_year", "monthly", "weekly"]
          }
        }
      }
    },
    first_actions: {
      type: "array",
      minItems: 1,
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "reason", "completion_condition", "estimated_minutes"],
        properties: {
          title: { type: "string" },
          reason: { type: "string" },
          completion_condition: { type: "string" },
          estimated_minutes: { type: "integer", minimum: 15, maximum: 60 }
        }
      }
    }
  }
} as const;

function valueOrUnset(value?: string | null) {
  return value?.trim() || "未設定";
}

export function buildDreamClarificationPrompt(dream: DreamClarificationInput) {
  const currentDate = new Date().toISOString().slice(0, 10);

  return `
あなたは「夢を実行可能な行動へ変換するAI」です。チャット相談ではなく、夢を具体化し、目標候補と最初の行動へ分解してください。

現在日付: ${currentDate}

入力された夢:
- 内容: ${valueOrUnset(dream.title)}
- 理由: ${valueOrUnset(dream.reason)}
- 期限: ${valueOrUnset(dream.deadline)}
- カテゴリー: ${valueOrUnset(dream.category)}
- 達成したい状態: ${valueOrUnset(dream.desired_state)}

最重要ルール:
- 入力された夢を別の夢に置き換えない。
- 例に引っ張られて「起業」「旅行」「商品発売」など別テーマへ変換しない。
- clarified_dream.title は、入力された夢の主語・目的・対象を必ず保つ。
- 不足情報があっても業種、商品、金額、行き先などを勝手に断定しない。不足情報は assumptions に前提として明記する。
- 夢に期限がある場合は、現在日付から期限までを逆算する。
- 目標階層は「20年後」「10年後」「5年後」「1年後」「今月」「今週」で考える。
- suggested_goal_level は twenty_year / ten_year / five_year / one_year / monthly / weekly のいずれかにする。
- 今日の具体的行動は milestones ではなく first_actions に入れる。
- 過去の日付を target_period に出さない。
- 夢に期限がない場合は、1〜2か月で最初の変化が見える前提を assumptions に明記する。
- 抽象的な夢では意味を決めつけず、「以下の前提で提案しています」と分かる前提を置く。
- 抽象的な夢の first_actions は、価値観・制約・減らしたいことを可視化する行動を優先し、勝手に事業・旅行・商品へ変換しない。

出力品質:
- 一般論は禁止。「調査する」「準備する」「計画する」「努力する」だけで終わらせない。
- どう調べるか、何を何個書くか、誰に何人聞くか、いつまでに何を終えるかを具体化する。
- milestones は原則3〜5個。期限が短い夢や小さな夢は2〜3個でもよい。
- milestones の description は、その期間で何ができていれば前進と言えるかを書く。
- first_actions は今日または近日中に実行できる粒度にする。
- first_actions は1回で完了できる行動にする。
- first_actions は15〜60分で開始可能な内容にする。
- first_actions の title は動詞を含め、読んだ瞬間に着手できる表現にする。
- first_actions には completion_condition を必ず入れる。
- completion_condition は「何をもって完了か」が第三者にも分かる具体的な条件にする。
- estimated_minutes は15〜60の整数にする。
- 説明は短く、ユーザーが採用・編集しやすい粒度にする。

出力形式:
- 必ず指定されたJSON Schemaに適合するJSONオブジェクトだけを返す。
- Markdown、コードブロック、説明文、前置き、後書きは返さない。
- 文字列は自然な日本語で返す。
`.trim();
}
