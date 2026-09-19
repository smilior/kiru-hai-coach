import type { TileId } from "./tiles";

/** Suit and rank helpers for number tiles. */
function parseNumber(tile: TileId): { suit: "m" | "p" | "s"; n: number } | null {
  if (tile.length === 2 && (tile[1] === "m" || tile[1] === "p" || tile[1] === "s")) {
    const n = Number(tile[0]);
    if (n >= 1 && n <= 9) return { suit: tile[1], n };
  }
  return null;
}

function isHonor(tile: TileId): boolean {
  return tile.length === 1;
}

function isTerminal(tile: TileId): boolean {
  const p = parseNumber(tile);
  return Boolean(p && (p.n === 1 || p.n === 9));
}

function countMap(tiles: TileId[]): Map<TileId, number> {
  const m = new Map<TileId, number>();
  for (const t of tiles) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

/**
 * How useful is keeping this tile? Higher = keep. CPU discards lowest.
 * Lightweight efficiency-ish heuristic — not a full shanten solver.
 */
function keepValue(tile: TileId, hand: TileId[], counts: Map<TileId, number>): number {
  const c = counts.get(tile) || 0;
  let v = 0;

  // Pair / triplet are valuable
  if (c >= 3) v += 40;
  else if (c === 2) v += 28;

  const num = parseNumber(tile);
  if (num) {
    const left = `${num.n - 1}${num.suit}` as TileId;
    const right = `${num.n + 1}${num.suit}` as TileId;
    const left2 = `${num.n - 2}${num.suit}` as TileId;
    const right2 = `${num.n + 2}${num.suit}` as TileId;
    const hasL = (counts.get(left) || 0) > 0;
    const hasR = (counts.get(right) || 0) > 0;
    const hasL2 = (counts.get(left2) || 0) > 0;
    const hasR2 = (counts.get(right2) || 0) > 0;

    // Ryanmen / sequence potential
    if (hasL && hasR) v += 36; // already in sequence-ish
    else if (hasL || hasR) v += 22; // penchan/kanchan neighbor
    if (hasL2 || hasR2) v += 10; // kanchan stretch

    // Middles keep better than terminals when isolated
    if (num.n >= 3 && num.n <= 7) v += 6;
    else if (num.n === 2 || num.n === 8) v += 3;
  } else if (isHonor(tile)) {
    // Isolated honor: low keep; pair of honor: already boosted by c===2
    if (c === 1) v -= 8;
  }

  // Isolated terminals are discard fodder
  if (isTerminal(tile) && c === 1) {
    const alone =
      !num ||
      ((counts.get(`${num.n === 1 ? 2 : 8}${num.suit}` as TileId) || 0) === 0 &&
        (counts.get(`${num.n === 1 ? 3 : 7}${num.suit}` as TileId) || 0) === 0);
    if (alone) v -= 12;
  }

  // Slight bias: prefer keeping tiles that appear once in a "live" shape
  void hand;
  return v;
}

/**
 * Soft danger: mid tiles not yet visible are slightly riskier late-game.
 * Prefer discarding tiles already in any river (simplified genbutsu).
 */
function dangerPenalty(
  tile: TileId,
  allRivers: TileId[],
  wallLeft: number
): number {
  const seen = allRivers.includes(tile);
  if (seen) return -18; // negative penalty = safer to cut → lower "keep" effectively applied as discard bonus

  const num = parseNumber(tile);
  const late = wallLeft < 40;
  if (num && num.n >= 3 && num.n <= 7 && late) return 12;
  if (isHonor(tile) && !seen) return 4;
  return 0;
}

/**
 * Pick a discard index in hand (14 tiles after draw).
 * Returns the TileId to discard (first matching instance from the end favors tsumo-giri when tied).
 */
export function chooseCpuDiscard(
  hand: TileId[],
  allRivers: TileId[],
  wallLeft: number
): TileId {
  if (hand.length === 0) throw new Error("empty hand");
  const counts = countMap(hand);

  let bestTile = hand[hand.length - 1];
  let bestScore = -Infinity; // higher = prefer discard

  // Prefer tsumo-giri on ties: iterate from end
  for (let i = hand.length - 1; i >= 0; i--) {
    const tile = hand[i];
    const keep = keepValue(tile, hand, counts);
    const danger = dangerPenalty(tile, allRivers, wallLeft);
    // discardScore = -keep + safetyBonus - danger
    // seen-in-river gives dangerPenalty negative → boosts discardScore
    const discardScore = -keep - danger + (i === hand.length - 1 ? 0.5 : 0);
    if (discardScore > bestScore) {
      bestScore = discardScore;
      bestTile = tile;
    }
  }

  return bestTile;
}

/** Remove one instance of tile from hand. */
export function removeOne(hand: TileId[], tile: TileId): TileId[] {
  const idx = hand.indexOf(tile);
  if (idx < 0) return hand;
  return [...hand.slice(0, idx), ...hand.slice(idx + 1)];
}
