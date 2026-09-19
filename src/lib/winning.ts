import { ALL_TILE_IDS, type TileId } from "./tiles";

const TILE_ORDER = new Map(ALL_TILE_IDS.map((id, i) => [id, i]));

function countMap(tiles: TileId[]): Map<TileId, number> {
  const m = new Map<TileId, number>();
  for (const t of tiles) m.set(t, (m.get(t) || 0) + 1);
  return m;
}

function cloneCounts(m: Map<TileId, number>): Map<TileId, number> {
  return new Map(m);
}

function parseNumber(
  tile: TileId
): { suit: "m" | "p" | "s"; n: number } | null {
  if (
    tile.length === 2 &&
    (tile[1] === "m" || tile[1] === "p" || tile[1] === "s")
  ) {
    const n = Number(tile[0]);
    if (n >= 1 && n <= 9) return { suit: tile[1], n };
  }
  return null;
}

/** Lowest tile still present — order must not depend on hand / Map insertion. */
function earliestTile(counts: Map<TileId, number>): TileId | null {
  let best: TileId | null = null;
  let bestOrd = Infinity;
  for (const [t, c] of counts) {
    if (c <= 0) continue;
    const ord = TILE_ORDER.get(t) ?? 999;
    if (ord < bestOrd) {
      bestOrd = ord;
      best = t;
    }
  }
  return best;
}

/** Seven pairs (チートイツ). */
function isSevenPairs(tiles: TileId[]): boolean {
  if (tiles.length !== 14) return false;
  const counts = countMap(tiles);
  if (counts.size !== 7) return false;
  for (const c of counts.values()) {
    if (c !== 2) return false;
  }
  return true;
}

/**
 * Try to remove 4 mentsu from remaining counts (after pair removed).
 * Always consume the earliest remaining tile (standard recursive check).
 */
function canFormMentsu(counts: Map<TileId, number>, remaining: number): boolean {
  if (remaining === 0) {
    for (const c of counts.values()) {
      if (c !== 0) return false;
    }
    return true;
  }

  const tile = earliestTile(counts);
  if (!tile) return remaining === 0;

  const c = counts.get(tile) || 0;

  // Triplet
  if (c >= 3) {
    const next = cloneCounts(counts);
    next.set(tile, c - 3);
    if (canFormMentsu(next, remaining - 1)) return true;
  }

  // Sequence (number tiles only) — must start at `tile`
  const num = parseNumber(tile);
  if (num && num.n <= 7) {
    const t2 = `${num.n + 1}${num.suit}` as TileId;
    const t3 = `${num.n + 2}${num.suit}` as TileId;
    const c2 = counts.get(t2) || 0;
    const c3 = counts.get(t3) || 0;
    if (c >= 1 && c2 >= 1 && c3 >= 1) {
      const next = cloneCounts(counts);
      next.set(tile, c - 1);
      next.set(t2, c2 - 1);
      next.set(t3, c3 - 1);
      if (canFormMentsu(next, remaining - 1)) return true;
    }
  }

  return false;
}

/** True if 14 tiles form a standard winning hand (4 mentsu + pair) or seven pairs. */
export function isWinningHand(tiles: TileId[]): boolean {
  if (tiles.length !== 14) return false;
  if (isSevenPairs(tiles)) return true;

  const counts = countMap(tiles);
  for (const [tile, c] of counts) {
    if (c < 2) continue;
    const next = cloneCounts(counts);
    next.set(tile, c - 2);
    if (canFormMentsu(next, 4)) return true;
  }
  return false;
}

/** True if adding `tile` to a 13-tile hand completes a win (ron / tsumo wait). */
export function wouldWin(hand13: TileId[], tile: TileId): boolean {
  if (hand13.length !== 13) return false;
  return isWinningHand([...hand13, tile]);
}
