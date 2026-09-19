import { TILE_NAME_JA, type TileId } from "./tiles";
import type { Difficulty } from "./lessons";

export type Scores = {
  efficiency: number;
  safety: number;
  wait: number;
};

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

/** Normalize Jev score (often 0..n on criteria index) to 0..1 display. */
export function normalizeScore(raw: number, maxIndex = 3): number {
  if (raw >= 0 && raw <= 1) return clamp01(raw);
  return clamp01(raw / maxIndex);
}

export function formatPct(score: number): string {
  return `${Math.round(normalizeScore(score) * 100)}`;
}

export function buildExplanation(
  discard: TileId,
  scores: Scores,
  difficulty: Difficulty
): string {
  const name = TILE_NAME_JA[discard];
  const eff = formatPct(scores.efficiency);
  const saf = formatPct(scores.safety);
  const wait = formatPct(scores.wait);

  if (difficulty === "beginner") {
    return [
      `推奨は「${name}」です。`,
      `いまは効率を一番大切にしています（効率スコア ${eff}）。`,
      `この牌を切ると、手牌の形が整いやすく、次に進みやすい受け入れが増える可能性が高いです。`,
      `まずは「形をきれいにする」感覚を身につけましょう。`,
    ].join("");
  }

  if (difficulty === "intermediate") {
    return [
      `推奨は「${name}」です。`,
      `効率（${eff}）と安全（${saf}）のバランスを見ています。`,
      `ただ速く進めるだけでなく、他家に振り込みにくい切り方も意識する段階です。`,
      `状況によっては少し遅い形でも、安全な切り方を選ぶことがあります。`,
    ].join("");
  }

  return [
    `推奨は「${name}」です。`,
    `効率（${eff}）・安全（${saf}）・待ちの質（${wait}）を総合しています。`,
    `上級では「何を切るか」だけでなく、切ったあとの待ちが広いか・良いか、押し引きの判断まで含めます。`,
    `スコアが近い牌同士では、待ちの質や場況の読みで差がつきます。`,
  ].join("");
}
