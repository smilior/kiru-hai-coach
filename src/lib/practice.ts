import { buildWall, shuffle, sortHand, type TileId } from "./tiles";
import { chooseCpuDiscard, removeOne } from "./cpu";
import { isWinningHand, wouldWin } from "./winning";

export type Seat = "E" | "S" | "W" | "N";

export const SEAT_ORDER: Seat[] = ["E", "S", "W", "N"];

export const SEAT_LABEL: Record<Seat, string> = {
  E: "東",
  S: "南",
  W: "西",
  N: "北",
};

/** Human is fixed South (自家 at bottom). */
export const HUMAN_SEAT: Seat = "S";

export type SeatState = {
  hand: TileId[];
  river: TileId[];
};

export type MatchPhase = "playing" | "ended";

export type EndKind = "agari" | "ryuukyoku" | "abort" | null;

export type MatchState = {
  wall: TileId[];
  seats: Record<Seat, SeatState>;
  turn: Seat;
  /** After draw, turn player has 14; before draw, 13. */
  hasDrawn: boolean;
  /** Tile just drawn this turn (for ツモ切 UI). */
  drawnTile: TileId | null;
  phase: MatchPhase;
  endReason: string | null;
  endKind: EndKind;
  winner: Seat | null;
  /** Last discarded tile for brief highlight. */
  lastDiscard: { seat: Seat; tile: TileId } | null;
};

export function nextSeat(seat: Seat): Seat {
  const i = SEAT_ORDER.indexOf(seat);
  return SEAT_ORDER[(i + 1) % 4];
}

export function createMatch(): MatchState {
  const wall = shuffle(buildWall());
  const seats: Record<Seat, SeatState> = {
    E: { hand: [], river: [] },
    S: { hand: [], river: [] },
    W: { hand: [], river: [] },
    N: { hand: [], river: [] },
  };

  for (let r = 0; r < 13; r++) {
    for (const seat of SEAT_ORDER) {
      const t = wall.pop();
      if (t) seats[seat].hand.push(t);
    }
  }

  for (const seat of SEAT_ORDER) {
    seats[seat].hand = sortHand(seats[seat].hand);
  }

  return {
    wall,
    seats,
    turn: "E",
    hasDrawn: false,
    drawnTile: null,
    phase: "playing",
    endReason: null,
    endKind: null,
    winner: null,
    lastDiscard: null,
  };
}

export function allRivers(state: MatchState): TileId[] {
  return SEAT_ORDER.flatMap((s) => state.seats[s].river);
}

/** Draw one tile for current turn. No-op if already drawn or ended. */
export function drawForTurn(state: MatchState): MatchState {
  if (state.phase !== "playing" || state.hasDrawn) return state;
  if (state.wall.length === 0) {
    return {
      ...state,
      phase: "ended",
      endKind: "ryuukyoku",
      endReason: "流局（山がなくなりました）",
    };
  }
  const tile = state.wall[state.wall.length - 1];
  const wall = state.wall.slice(0, -1);
  const seat = state.turn;
  const closed = sortHand(state.seats[seat].hand);
  const hand = [...closed, tile];
  return {
    ...state,
    wall,
    hasDrawn: true,
    drawnTile: tile,
    seats: {
      ...state.seats,
      [seat]: { ...state.seats[seat], hand },
    },
  };
}

function removeDiscard(
  hand: TileId[],
  tile: TileId,
  drawnTile: TileId | null
): TileId[] {
  if (drawnTile && tile === drawnTile) {
    for (let i = hand.length - 1; i >= 0; i--) {
      if (hand[i] === tile) {
        return [...hand.slice(0, i), ...hand.slice(i + 1)];
      }
    }
  }
  return removeOne(hand, tile);
}

export function canTsumo(state: MatchState): boolean {
  if (state.phase !== "playing" || !state.hasDrawn) return false;
  return isWinningHand(state.seats[state.turn].hand);
}

export function declareTsumo(state: MatchState): MatchState {
  if (!canTsumo(state)) return state;
  const seat = state.turn;
  const who = seat === HUMAN_SEAT ? "あなた" : `${SEAT_LABEL[seat]}（CPU）`;
  return {
    ...state,
    phase: "ended",
    endKind: "agari",
    winner: seat,
    endReason: `${who}のツモ和了！`,
  };
}

/** Who can ron the last discard (13-tile closed hands). Excludes discarder. */
export function ronCandidates(state: MatchState): Seat[] {
  const last = state.lastDiscard;
  if (!last || state.phase !== "playing") return [];
  const out: Seat[] = [];
  for (const seat of SEAT_ORDER) {
    if (seat === last.seat) continue;
    const hand = state.seats[seat].hand;
    if (hand.length === 13 && wouldWin(hand, last.tile)) {
      out.push(seat);
    }
  }
  return out;
}

export function declareRon(state: MatchState, winner: Seat): MatchState {
  const last = state.lastDiscard;
  if (!last) return state;
  if (!ronCandidates(state).includes(winner)) return state;
  const who = winner === HUMAN_SEAT ? "あなた" : `${SEAT_LABEL[winner]}（CPU）`;
  const from =
    last.seat === HUMAN_SEAT ? "あなた" : `${SEAT_LABEL[last.seat]}（CPU）`;
  return {
    ...state,
    phase: "ended",
    endKind: "agari",
    winner,
    endReason: `${who}のロン和了！（${from}の${last.tile}）`,
  };
}

export function discardFromTurn(state: MatchState, tile: TileId): MatchState {
  if (state.phase !== "playing" || !state.hasDrawn) return state;
  const seat = state.turn;
  const handBefore = state.seats[seat].hand;
  if (!handBefore.includes(tile)) return state;

  const hand = sortHand(removeDiscard(handBefore, tile, state.drawnTile));
  const river = [...state.seats[seat].river, tile];
  const next = nextSeat(seat);

  let nextState: MatchState = {
    ...state,
    hasDrawn: false,
    drawnTile: null,
    turn: next,
    lastDiscard: { seat, tile },
    seats: {
      ...state.seats,
      [seat]: { hand, river },
    },
  };

  // Human ron is offered in UI; auto-ron only for CPUs when human cannot
  const cands = ronCandidates(nextState);
  if (!cands.includes(HUMAN_SEAT)) {
    const cpuRon = cands[0];
    if (cpuRon) {
      return declareRon(nextState, cpuRon);
    }
  }

  if (nextState.wall.length === 0 && cands.length === 0) {
    nextState = {
      ...nextState,
      phase: "ended",
      endKind: "ryuukyoku",
      endReason: "流局（山がなくなりました）",
    };
  }

  return nextState;
}

/** CPU: choose discard for current turn (must have drawn). */
export function cpuPickDiscard(state: MatchState): TileId {
  const hand = state.seats[state.turn].hand;
  return chooseCpuDiscard(hand, allRivers(state), state.wall.length);
}

export function endPractice(
  state: MatchState,
  reason = "練習を終了しました。"
): MatchState {
  return {
    ...state,
    phase: "ended",
    endKind: "abort",
    endReason: reason,
  };
}
