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

export async function evaluateDiscard(
  hand: TileId[],
  difficulty: Difficulty,
  river: TileId[] = []
): Promise<CoachResult> {
  const unique = [...new Set(hand)];
  const criteria: Record<string, string> = {};
  for (const id of unique) {
    criteria[id] = `${TILE_NAME_JA[id]}（${id}）を切る`;
  }

  const state = {
    game: "リーチ麻雀（1人用コーチ・簡略ルール）",
    difficulty,
    context: difficultyContext(difficulty),
    hand: hand.map((id) => ({ id, name: TILE_NAME_JA[id] })),
    handCodes: hand,
    river,
    task: "14枚の手牌から、今切るべき1枚を選ぶ。ツモ牌は手牌の最後の要素として扱う。",
  };

  const questions: Record<string, unknown> = {
    discard: {
      type: "choice",
      instructions:
        "手牌から切るべき1枚を選んでください。難易度の優先順位に従ってください。",
      criteria,
    },
    efficiency: {
      type: "score",
      instructions:
        "選んだ切り方の効率（受け入れ・進行速度）を評価してください。",
      criteria: scoreCriteria(difficulty),
    },
  };

  if (difficulty === "intermediate" || difficulty === "advanced") {
    questions.safety = {
      type: "score",
      instructions: "選んだ切り方の安全度（振り込みにくさ）を評価してください。",
      criteria: [
        "危険: 振り込みやすい",
        "やや危険",
        "普通",
        "安全: 振り込みにくい",
      ],
    };
  }

  if (difficulty === "advanced") {
    questions.wait = {
      type: "score",
      instructions:
        "切ったあとの待ちの質（広さ・良形かどうか）を評価してください。",
      criteria: [
        "愚形・狭い",
        "やや狭い",
        "普通",
        "良形・広い",
      ],
    };
  }

  // beginner still needs wait score for schema lock {efficiency,safety,wait}
  if (difficulty === "beginner") {
    questions.safety = {
      type: "score",
      instructions: "安全度の参考評価（初級では優先度低）。",
      criteria: ["危険", "やや危険", "普通", "安全"],
    };
    questions.wait = {
      type: "score",
      instructions: "待ちの質の参考評価（初級では優先度低）。",
      criteria: ["狭い", "やや狭い", "普通", "広い"],
    };
  }

  if (difficulty === "intermediate") {
    questions.wait = {
      type: "score",
      instructions: "待ちの質の参考評価（中級では補助）。",
      criteria: ["狭い", "やや狭い", "普通", "広い"],
    };
  }

  const result = await evaluate({
    model: "typesafe-ai/jev",
    state,
    questions: questions as Parameters<typeof evaluate>[0]["questions"],
  });

  const answers = result.answers as {
    discard?: { choice?: string };
    efficiency?: { score?: number };
    safety?: { score?: number };
    wait?: { score?: number };
  };

  const choice = answers.discard?.choice;
  let discard: TileId =
    choice && isTileId(choice) ? choice : unique[unique.length - 1];

  // Fallback if model returns unexpected choice
  if (!hand.includes(discard)) {
    discard = hand[hand.length - 1];
  }

  const scores: Scores = {
    efficiency: normalizeScore(answers.efficiency?.score ?? 2),
    safety: normalizeScore(answers.safety?.score ?? 2),
    wait: normalizeScore(answers.wait?.score ?? 2),
  };

  return {
    discard,
    scores,
    explanation: buildExplanation(discard, scores, difficulty),
    raw: result.answers,
  };
}
