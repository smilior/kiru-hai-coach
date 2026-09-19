import { experimental_evaluate as evaluate } from "ai";
import {
  TILE_NAME_JA,
  isTileId,
  type TileId,
} from "./tiles";
import type { Difficulty } from "./lessons";
import {
  buildExplanation,
  normalizeScore,
  type Scores,
} from "./explanation";

export type CoachResult = {
  discard: TileId;
  scores: Scores;
  explanation: string;
  raw?: unknown;
};

function scoreCriteria(difficulty: Difficulty): string[] {
  if (difficulty === "beginner") {
    return [
      "とても低い: 受け入れがほぼ増えない",
      "低い: あまり良くない",
      "普通: まずまず",
      "高い: 受け入れが大きく増える",
    ];
  }
  if (difficulty === "intermediate") {
    return [
      "とても低い",
      "低い",
      "普通",
      "高い（効率と安全のバランスが良い）",
    ];
  }
  return [
    "とても低い",
    "低い",
    "普通",
    "高い（効率・安全・待ちの質が揃う）",
  ];
}

function difficultyContext(difficulty: Difficulty): string {
  if (difficulty === "beginner") {
    return "難易度: 初級。効率（受け入れの広さ・テンパイまでの速さ）を最優先。安全や待ちの質は参考程度。";
  }
  if (difficulty === "intermediate") {
    return "難易度: 中級。効率と安全度のバランスを重視。危険牌は避けつつ進める。";
  }
  return "難易度: 上級。効率・安全・待ちの質（良形/愚形）・押し引きを総合判断。";
}

/** Map Jev choice (tile id, Japanese name, or criteria text) back to a hand tile. */
export function resolveDiscardChoice(
  choice: unknown,
  hand: TileId[]
): TileId | null {
  if (choice == null) return null;
  const raw = String(choice).trim();
  if (!raw) return null;

  if (isTileId(raw) && hand.includes(raw)) return raw;

  // Exact Japanese name
  for (const id of hand) {
    if (TILE_NAME_JA[id] === raw) return id;
  }

  // Criteria text like "五萬（5m）を切る" or containing "(5m)"
  const paren = raw.match(/\(([1-9][mps]|[ESWNPFC])\)/);
  if (paren && isTileId(paren[1]) && hand.includes(paren[1] as TileId)) {
    return paren[1] as TileId;
  }

  // Substring tile id
  for (const id of [...new Set(hand)]) {
    if (raw.includes(id) || raw.includes(TILE_NAME_JA[id])) {
      if (hand.includes(id)) return id;
    }
  }

  return null;
}

function extractDiscardAnswer(answers: Record<string, unknown>): unknown {
  const d = answers.discard;
  if (d == null) return null;
  if (typeof d === "string") return d;
  if (typeof d === "object") {
    const obj = d as Record<string, unknown>;
    if (typeof obj.choice === "string") return obj.choice;
    if (typeof obj.value === "string") return obj.value;
    if (typeof obj.id === "string") return obj.id;
  }
  return null;
}

function extractScore(
  answers: Record<string, unknown>,
  key: string
): number {
  const v = answers[key];
  if (v == null) return 2;
  if (typeof v === "number") return v;
  if (typeof v === "object" && v !== null) {
    const obj = v as Record<string, unknown>;
    if (typeof obj.score === "number") return obj.score;
    if (typeof obj.value === "number") return obj.value;
  }
  return 2;
}

export async function evaluateDiscard(
  hand: TileId[],
  difficulty: Difficulty,
  river: TileId[] = [],
  mode: "solo" | "vs-cpu" = "solo"
): Promise<CoachResult> {
  const unique = [...new Set(hand)];
  const criteria: Record<string, string> = {};
  for (const id of unique) {
    criteria[id] = `${TILE_NAME_JA[id]}（${id}）を切る`;
  }

  const state = {
    game:
      mode === "vs-cpu"
        ? "リーチ麻雀（実戦練習・あなた＋CPU3・簡略ルール）"
        : "リーチ麻雀（1人用コーチ・簡略ルール）",
    mode,
    difficulty,
    context: difficultyContext(difficulty),
    hand: hand.map((id) => ({ id, name: TILE_NAME_JA[id] })),
    handCodes: hand,
    river,
    task:
      mode === "vs-cpu"
        ? "14枚の手牌から切る1枚を選ぶ。河も参考に安全を意識。ツモは手牌の最後。discard は handCodes の牌コード（例: 5m）を返すこと。"
        : "14枚の手牌から、今切るべき1枚を選ぶ。ツモ牌は手牌の最後の要素として扱う。回答の discard は handCodes にある牌コード（例: 5m）をそのまま返すこと。",
  };

  const questions: Record<string, unknown> = {
    discard: {
      type: "choice",
      instructions:
        "手牌から切るべき1枚を、criteria のキー（牌コード）で選んでください。難易度の優先順位に従ってください。",
      criteria,
    },
    efficiency: {
      type: "score",
      instructions:
        "選んだ切り方の効率（受け入れ・進行速度）を評価してください。",
      criteria: scoreCriteria(difficulty),
    },
    safety: {
      type: "score",
      instructions:
        difficulty === "beginner"
          ? "安全度の参考評価（初級では優先度低）。"
          : "選んだ切り方の安全度（振り込みにくさ）を評価してください。",
      criteria:
        difficulty === "advanced" || difficulty === "intermediate"
          ? ["危険: 振り込みやすい", "やや危険", "普通", "安全: 振り込みにくい"]
          : ["危険", "やや危険", "普通", "安全"],
    },
    wait: {
      type: "score",
      instructions:
        difficulty === "advanced"
          ? "切ったあとの待ちの質（広さ・良形かどうか）を評価してください。"
          : "待ちの質の参考評価。",
      criteria:
        difficulty === "advanced"
          ? ["愚形・狭い", "やや狭い", "普通", "良形・広い"]
          : ["狭い", "やや狭い", "普通", "広い"],
    },
  };

  const result = await evaluate({
    model: "typesafe-ai/jev",
    state,
    questions: questions as Parameters<typeof evaluate>[0]["questions"],
  });

  const answers = (result.answers || {}) as Record<string, unknown>;
  const resolved =
    resolveDiscardChoice(extractDiscardAnswer(answers), hand) ||
    hand[hand.length - 1];

  // Final guard: must be in hand
  const discard: TileId = hand.includes(resolved)
    ? resolved
    : hand[hand.length - 1];

  const scores: Scores = {
    efficiency: normalizeScore(extractScore(answers, "efficiency")),
    safety: normalizeScore(extractScore(answers, "safety")),
    wait: normalizeScore(extractScore(answers, "wait")),
  };

  return {
    discard,
    scores,
    explanation: buildExplanation(discard, scores, difficulty),
    raw: result.answers,
  };
}
