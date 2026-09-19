"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TileButton } from "./TileButton";
import { ScoreBars } from "./ScoreBars";
import { TILE_NAME_JA, type TileId } from "@/lib/tiles";
import type { Scores } from "@/lib/explanation";
import {
  HUMAN_SEAT,
  RELATIVE_LABEL,
  SEAT_LABEL,
  START_SCORE,
  VIEW_SEATS,
  afterRonPass,
  allRivers,
  canTsumo,
  createMatch,
  cpuPickDiscard,
  declareRon,
  declareTsumo,
  discardFromTurn,
  drawForTurn,
  endPractice,
  formatScore,
  liveWallCount,
  ronCandidates,
  type MatchState,
  type Seat,
} from "@/lib/practice";

const PLAYER_KEY = "khc_player_id";
const CPU_DELAY_MS = 420;
/** Tenhou / 電脳麻将 style: 6 tiles per river row. */
const RIVER_ROW = 6;

type CoachResponse = {
  discard: TileId;
  scores: Scores;
  explanation: string;
};

type Props = {
  onExit?: () => void;
};

/** Highlight exactly one hand slot matching Jev discard (prefer drawn). */
function recommendedSlots(
  closed: TileId[],
  drawn: TileId | null | undefined,
  discard: TileId | null | undefined
): { closedIdx: number; drawn: boolean } {
  if (!discard) return { closedIdx: -1, drawn: false };
  if (drawn && drawn === discard) return { closedIdx: -1, drawn: true };
  return { closedIdx: closed.findIndex((t) => t === discard), drawn: false };
}

/** null = not measured yet (SSR / first paint); treat as blocked until known. */
function useIsPortrait(): boolean | null {
  const [portrait, setPortrait] = useState<boolean | null>(null);

  useEffect(() => {
    const update = () => {
      const mq = window.matchMedia("(orientation: portrait)");
      setPortrait(mq.matches || window.innerHeight > window.innerWidth);
    };
    update();
    const mq = window.matchMedia("(orientation: portrait)");
    mq.addEventListener("change", update);
    window.addEventListener("resize", update);
    const orient = (
      screen as Screen & { orientation?: { lock?: (o: string) => Promise<void> } }
    ).orientation;
    orient?.lock?.("landscape").catch(() => {});
    return () => {
      mq.removeEventListener("change", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  return portrait;
}

function chunkRiver(tiles: TileId[]): TileId[][] {
  const rows: TileId[][] = [];
  for (let i = 0; i < tiles.length; i += RIVER_ROW) {
    rows.push(tiles.slice(i, i + RIVER_ROW));
  }
  return rows.length ? rows : [[]];
}

/**
 * Discard rivers — design lock:
 * rotate: 下家90 / 対面180 / 上家-90 / 自家0
 * growth: 自家 L→R / 下家 bottom→top / 対面 R→L / 上家 top→bottom
 * no border frame; stick to fixed center; show all discards (no 3-tile clip)
 */
function RiverHorizontal({
  tiles,
  last,
  seat,
}: {
  tiles: TileId[];
  last?: TileId | null;
  seat: "bottom" | "top";
}) {
  const rows = chunkRiver(tiles);
  const mirror = seat === "top";
  const rotate = seat === "top" ? 180 : 0;
  return (
    <div
      className={[
        "practice-river-block",
        mirror
          ? "practice-river-block--stack-from-center"
          : "practice-river-block--stack",
      ].join(" ")}
    >
      {rows.map((row, ri) => (
        <div
          key={ri}
          className={[
            "practice-river-row",
            mirror ? "practice-river-row--rtl" : "practice-river-row--ltr",
          ].join(" ")}
        >
          {row.map((t, i) => {
            const globalIdx = ri * RIVER_ROW + i;
            const isLast = Boolean(
              last && last === t && globalIdx === tiles.length - 1
            );
            return (
              <TileButton
                key={`${t}-${globalIdx}`}
                tile={t}
                size="river"
                faceOnly
                rotate={rotate}
                highlighted={isLast}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

/**
 * Side river (上家 / 下家): 6-tile Tenhou rows as columns; tiles rotated.
 */
function RiverSide({
  tiles,
  last,
  side,
}: {
  tiles: TileId[];
  last?: TileId | null;
  side: "left" | "right";
}) {
  const rows = chunkRiver(tiles);
  const empty = rows.every((r) => r.length === 0);
  const colClass =
    side === "left" ? "practice-river-col--ttb" : "practice-river-col--btt";
  const rotate = side === "left" ? -90 : 90;
  return (
    <div
      className={[
        "practice-river-block",
        side === "left"
          ? "practice-river-block--side-left"
          : "practice-river-block--side-right",
      ].join(" ")}
    >
      {empty
        ? null
        : rows.map((row, ri) => (
            <div
              key={ri}
              className={["practice-river-col", colClass].join(" ")}
            >
              {row.map((t, i) => {
                const globalIdx = ri * RIVER_ROW + i;
                const isLast = Boolean(
                  last && last === t && globalIdx === tiles.length - 1
                );
                return (
                  <TileButton
                    key={`${t}-${globalIdx}`}
                    tile={t}
                    size="river"
                    faceOnly
                    rotate={rotate}
                    highlighted={isLast}
                  />
                );
              })}
            </div>
          ))}
    </div>
  );
}

/** Center: kyoku + remaining; winds; dora also mirrored top-right in HUD. */
function CenterBox({
  roundLabel,
  remaining,
  turn,
  phase,
  doraIndicator,
}: {
  roundLabel: string;
  remaining: number;
  turn: Seat;
  phase: MatchState["phase"];
  doraIndicator: TileId;
}) {
  const windClass = (seat: Seat) =>
    [
      "absolute text-[11px] font-bold leading-none",
      turn === seat && phase === "playing"
        ? "text-amber-300"
        : "text-white/85",
    ].join(" ");

  return (
    <div className="relative flex h-[5.25rem] w-[5.75rem] shrink-0 flex-col items-center justify-center gap-0.5 border border-white/35 bg-black/45 px-1 py-1 text-center sm:h-24 sm:w-28">
      <span
        className={`${windClass(VIEW_SEATS.top)} top-0.5 left-1/2 -translate-x-1/2`}
      >
        {SEAT_LABEL[VIEW_SEATS.top]}
      </span>
      <span
        className={`${windClass(VIEW_SEATS.left)} left-1 top-1/2 -translate-y-1/2`}
      >
        {SEAT_LABEL[VIEW_SEATS.left]}
      </span>
      <span
        className={`${windClass(VIEW_SEATS.right)} right-1 top-1/2 -translate-y-1/2`}
      >
        {SEAT_LABEL[VIEW_SEATS.right]}
      </span>
      <span
        className={`${windClass(VIEW_SEATS.bottom)} bottom-0.5 left-1/2 -translate-x-1/2`}
      >
        {SEAT_LABEL[VIEW_SEATS.bottom]}
      </span>
      <span className="text-sm font-bold tracking-wide text-white sm:text-base">
        {phase === "ended" ? "終局" : roundLabel}
      </span>
      <span className="text-[10px] text-white/80 sm:text-xs">
        残り {remaining}
      </span>
      <div className="mt-0.5 flex items-center gap-1">
        <span className="text-[9px] font-medium text-white/75">ドラ</span>
        <TileButton tile={doraIndicator} size="xs" faceOnly />
      </div>
    </div>
  );
}

function ScoreLabel({
  seat,
  highlight,
  className = "",
}: {
  seat: Seat;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <div className={`text-[11px] leading-tight sm:text-xs ${className}`}>
      <span
        className={
          highlight ? "font-bold text-amber-300" : "font-semibold text-white"
        }
      >
        {SEAT_LABEL[seat]}
      </span>{" "}
      <span className="text-white/90">{RELATIVE_LABEL[seat]}</span>{" "}
      <span className="font-mono text-white/95">
        {formatScore(START_SCORE)}
      </span>
    </div>
  );
}

function PortraitGate({ onExit }: { onExit?: () => void }) {
  return (
    <div
      className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 px-6 text-center"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a5c38 0%, #0f3d26 55%, #0a2e1c 100%)",
      }}
      role="dialog"
      aria-modal="true"
      aria-label="横にしてください"
    >
      <div
        className="pointer-events-none absolute inset-0 border-[3px] border-[#2a1a14]"
        aria-hidden
      />
      <p className="text-2xl" aria-hidden>
        📱↻
      </p>
      <p className="text-lg font-bold text-amber-200">横にしてください</p>
      <p className="text-sm font-medium text-white">
        実戦練習は横向き専用です
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-white/85">
        天鳳・雀魂などと同じく、卓と河を横画面で表示します。端末を横に回転してください。
      </p>
      {onExit && (
        <button
          type="button"
          onClick={onExit}
          className="mt-2 min-h-[44px] rounded-lg border border-amber-400/70 px-5 py-2.5 text-sm font-medium text-white active:bg-white/10"
        >
          レッスンに戻る
        </button>
      )}
    </div>
  );
}

export function PracticeApp({ onExit }: Props) {
  const isPortrait = useIsPortrait();
  const [match, setMatch] = useState<MatchState>(() => createMatch());
  const [selected, setSelected] = useState<TileId | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PLAYER_KEY);
  });
  const [ronPassKey, setRonPassKey] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Monotonic id so late /api/coach responses cannot overwrite a newer turn. */
  const coachReqId = useRef(0);

  const lastDiscardKey = match.lastDiscard
    ? `${match.lastDiscard.seat}-${match.lastDiscard.tile}-${match.seats[match.lastDiscard.seat].river.length}`
    : "";

  const humanCanRon = useMemo(() => {
    if (match.phase !== "playing" || match.hasDrawn) return false;
    if (ronPassKey && ronPassKey === lastDiscardKey) return false;
    return ronCandidates(match).includes(HUMAN_SEAT);
  }, [match, ronPassKey, lastDiscardKey]);

  const promptText = useMemo(() => {
    // End overlay owns the full reason — avoid duplicate ghost text above it.
    if (match.phase === "ended") {
      if (match.endKind === "agari") return "和了";
      if (match.endKind === "ryuukyoku") return "流局";
      return "終局";
    }
    if (humanCanRon && match.lastDiscard) {
      return `${SEAT_LABEL[match.lastDiscard.seat]}の${TILE_NAME_JA[match.lastDiscard.tile]} — ロンできます`;
    }
    if (!match.hasDrawn) {
      return match.turn === HUMAN_SEAT
        ? "ツモっています…"
        : `${SEAT_LABEL[match.turn]}の番です…`;
    }
    if (match.turn === HUMAN_SEAT) {
      if (canTsumo(match)) return "形が揃いました。ツモできます。";
      return "打牌する牌を選択";
    }
    if (match.lastDiscard) {
      const { seat, tile } = match.lastDiscard;
      return `${SEAT_LABEL[seat]} が ${TILE_NAME_JA[tile]} を切りました`;
    }
    return `${SEAT_LABEL[match.turn]}が考えています…`;
  }, [match, humanCanRon]);

  const restart = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setMatch(createMatch());
    setSelected(null);
    setCoach(null);
    setError(null);
    setRonPassKey(null);
    setSettingsOpen(false);
    setCoachLoading(false);
    coachReqId.current += 1;
  }, []);

  useEffect(() => {
    const stored = localStorage.getItem(PLAYER_KEY);
    (async () => {
      try {
        const res = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: stored || undefined }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data.player_id) {
            setPlayerId(data.player_id);
            localStorage.setItem(PLAYER_KEY, data.player_id);
          }
        }
      } catch {
        /* soft-fail */
      }
    })();
  }, []);

  useEffect(() => {
    if (isPortrait !== false) return;
    if (match.phase !== "playing") return;
    if (humanCanRon) return;

    const isHuman = match.turn === HUMAN_SEAT;

    if (!match.hasDrawn) {
      const t = setTimeout(() => {
        setMatch((m) => {
          if (m.phase !== "playing" || m.hasDrawn) return m;
          const next = drawForTurn(m);
          if (
            next.phase === "playing" &&
            next.hasDrawn &&
            next.turn !== HUMAN_SEAT &&
            canTsumo(next)
          ) {
            return declareTsumo(next);
          }
          return next;
        });
        setSelected(null);
        setCoach(null);
      }, isHuman ? 250 : 180);
      return () => clearTimeout(t);
    }

    if (!isHuman && match.hasDrawn) {
      cpuTimer.current = setTimeout(() => {
        setMatch((m) => {
          if (m.phase !== "playing" || m.turn === HUMAN_SEAT || !m.hasDrawn) {
            return m;
          }
          if (canTsumo(m)) return declareTsumo(m);
          const tile = cpuPickDiscard(m);
          return discardFromTurn(m, tile);
        });
      }, CPU_DELAY_MS);
      return () => {
        if (cpuTimer.current) clearTimeout(cpuTimer.current);
      };
    }
  }, [
    isPortrait,
    match.phase,
    match.turn,
    match.hasDrawn,
    match.wall.length,
    humanCanRon,
  ]);

  function humanDiscard(tile: TileId) {
    if (match.phase !== "playing") return;
    if (match.turn !== HUMAN_SEAT || !match.hasDrawn) return;
    if (!match.seats[HUMAN_SEAT].hand.includes(tile)) return;
    coachReqId.current += 1;
    setCoachLoading(false);
    setMatch((m) => discardFromTurn(m, tile));
    setSelected(null);
    setCoach(null);
    setError(null);
  }

  const human = match.seats[HUMAN_SEAT];
  const humanTurn =
    match.phase === "playing" &&
    match.turn === HUMAN_SEAT &&
    match.hasDrawn;
  const drawn = match.drawnTile;
  const closed = humanTurn && drawn ? human.hand.slice(0, -1) : human.hand;
  const lastDisc = match.lastDiscard;
  const humanCanTsumo = humanTurn && canTsumo(match);
  const rec = recommendedSlots(
    closed,
    humanTurn ? drawn : null,
    coach?.discard
  );

  function onTileTap(tile: TileId) {
    if (!humanTurn) return;
    // Single tap discards (large hand targets). Selection still used for 切る / coach.
    setSelected(tile);
    humanDiscard(tile);
  }

  async function askCoach() {
    if (match.turn !== HUMAN_SEAT || !match.hasDrawn) return;
    const hand = match.seats[HUMAN_SEAT].hand;
    if (hand.length !== 14) return;

    const reqId = ++coachReqId.current;
    const handSnapshot = [...hand];
    const river = allRivers(match);

    setCoachLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hand: handSnapshot,
          difficulty: "intermediate",
          river,
          mode: "vs-cpu",
        }),
      });
      const data = await res.json();
      // Stale: user discarded / restarted while Jev was in flight
      if (reqId !== coachReqId.current) return;
      if (!res.ok) throw new Error(data.error || "コーチ呼び出しに失敗しました");

      const discard: TileId = handSnapshot.includes(data.discard)
        ? data.discard
        : handSnapshot[handSnapshot.length - 1];
      const scores: Scores = {
        efficiency: Number(data.scores?.efficiency ?? 0),
        safety: Number(data.scores?.safety ?? 0),
        wait: Number(data.scores?.wait ?? 0),
      };
      const explanation = `${
        typeof data.explanation === "string"
          ? data.explanation
          : `推奨は「${TILE_NAME_JA[discard]}」です。`
      }（実戦練習・mode=vs-cpu）`;
      setCoach({ discard, scores, explanation });
      setSelected(discard);
      // Clear loading before Turso writes so 解説 does not stick on "…"
      setCoachLoading(false);

      let pid = playerId;
      if (!pid) {
        const p = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (p.ok) {
          const pd = await p.json();
          pid = pd.player_id;
          if (pid) {
            setPlayerId(pid);
            localStorage.setItem(PLAYER_KEY, pid);
          }
        }
      }
      if (pid && reqId === coachReqId.current) {
        void fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_id: pid,
            hand: handSnapshot,
            discard,
            scores,
            explanation,
          }),
        });
      }
    } catch (e) {
      if (reqId !== coachReqId.current) return;
      setError(e instanceof Error ? e.message : "エラーが発生しました");
      setCoachLoading(false);
    }
  }

  const top = VIEW_SEATS.top;
  const left = VIEW_SEATS.left;
  const right = VIEW_SEATS.right;
  const bottom = VIEW_SEATS.bottom;

  if (isPortrait === null) {
    return (
      <div
        className="fixed inset-0 z-30 bg-[#0a2e1c]"
        aria-busy="true"
        aria-label="読み込み中"
      />
    );
  }
  if (isPortrait) {
    return <PortraitGate onExit={onExit} />;
  }

  return (
    <div
      className="practice-landscape-root fixed inset-0 z-30 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a5c38 0%, #0f3d26 55%, #0a2e1c 100%)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 z-40 border-[3px] border-[#2a1a14]"
        aria-hidden
      />

      <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-1 pt-2 sm:px-3 sm:pt-3">
        {/* Corner scores (Tenhou-like) + dora top-right readable */}
        <div className="relative z-10 mb-1 flex shrink-0 items-start justify-between gap-2 px-1">
          <div className="space-y-0.5">
            <ScoreLabel seat={top} />
            <ScoreLabel seat={left} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <ScoreLabel seat={right} className="text-right" />
            <div className="inline-flex items-center gap-1.5 rounded border border-amber-400/50 bg-black/30 px-1.5 py-0.5">
              <span className="text-[10px] font-bold text-amber-200">ドラ</span>
              <TileButton tile={match.doraIndicator} size="xs" faceOnly />
            </div>
          </div>
        </div>

        <div className="absolute right-2 top-14 z-20 flex flex-col gap-2 sm:right-3 sm:top-16">
          <button
            type="button"
            onClick={() => {
              if (match.phase === "playing") {
                setMatch((m) => endPractice(m, "練習を終了しました。"));
              }
            }}
            disabled={match.phase === "ended"}
            className="min-h-[36px] rounded border border-white/40 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/95 active:bg-white/10 disabled:opacity-40 sm:text-xs"
          >
            練習終了
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="min-h-[36px] rounded border border-white/40 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/95 active:bg-white/10 sm:text-xs"
          >
            設定
          </button>
        </div>

        {settingsOpen && (
          <div className="absolute right-2 top-32 z-30 w-40 rounded-lg border border-white/30 bg-emerald-950/95 p-2 shadow-xl sm:right-3">
            <button
              type="button"
              onClick={restart}
              className="w-full rounded px-2 py-2 text-left text-xs text-white hover:bg-white/10"
            >
              配り直し
            </button>
            {onExit && (
              <button
                type="button"
                onClick={() => {
                  setSettingsOpen(false);
                  onExit();
                }}
                className="w-full rounded px-2 py-2 text-left text-xs text-white hover:bg-white/10"
              >
                レッスンに戻る
              </button>
            )}
            <button
              type="button"
              onClick={() => setSettingsOpen(false)}
              className="w-full rounded px-2 py-2 text-left text-xs text-white/70 hover:bg-white/10"
            >
              閉じる
            </button>
          </div>
        )}

        {/* Seat map: fixed center; rivers glued to it (no flex push on discard) */}
        <div className="practice-table-grid">
          <div className="practice-table-top">
            <RiverHorizontal
              tiles={match.seats[top].river}
              last={lastDisc?.seat === top ? lastDisc.tile : null}
              seat="top"
            />
          </div>
          <div className="practice-table-left">
            <RiverSide
              tiles={match.seats[left].river}
              last={lastDisc?.seat === left ? lastDisc.tile : null}
              side="left"
            />
          </div>
          <div className="practice-table-center">
            <CenterBox
              roundLabel={match.roundLabel}
              remaining={liveWallCount(match)}
              turn={match.turn}
              phase={match.phase}
              doraIndicator={match.doraIndicator}
            />
          </div>
          <div className="practice-table-right">
            <RiverSide
              tiles={match.seats[right].river}
              last={lastDisc?.seat === right ? lastDisc.tile : null}
              side="right"
            />
          </div>
          <div className="practice-table-bottom">
            <RiverHorizontal
              tiles={match.seats[bottom].river}
              last={lastDisc?.seat === bottom ? lastDisc.tile : null}
              seat="bottom"
            />
          </div>
        </div>

        <div className="relative z-10 mt-auto shrink-0 px-1 pb-1">
          {match.phase !== "ended" && (
            <p
              className={[
                "mb-0.5 text-center text-xs font-medium sm:text-sm",
                humanTurn ? "text-amber-200" : "text-white/85",
              ].join(" ")}
            >
              {promptText}
            </p>
          )}
          {match.phase !== "ended" && (
            <ScoreLabel seat={bottom} highlight className="mb-1 text-center" />
          )}

          {humanCanRon && lastDisc && (
            <div className="mb-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setMatch((m) => declareRon(m, HUMAN_SEAT))}
                className="min-h-[44px] rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow"
              >
                ロン
              </button>
              <button
                type="button"
                onClick={() => {
                  setRonPassKey(lastDiscardKey);
                  setMatch((m) => afterRonPass(m));
                }}
                className="min-h-[44px] rounded-lg border border-white/40 bg-black/30 px-5 py-2.5 text-sm font-medium text-white"
              >
                スルー
              </button>
            </div>
          )}

          {match.phase === "ended" && (
            <div
              className="mb-2 rounded-xl border-2 border-amber-400/70 bg-emerald-950/95 px-3 py-3 text-center shadow-lg"
              role="status"
              aria-live="polite"
            >
              <p className="text-lg font-black tracking-wide text-amber-200">
                {match.endKind === "agari"
                  ? "和了"
                  : match.endKind === "ryuukyoku"
                    ? "流局"
                    : "終局"}
              </p>
              <p className="mt-1 text-sm font-semibold text-white">
                {match.endReason || "局が終了しました"}
              </p>
              <p className="mt-1 text-[10px] text-white/60">
                ※ 簡易ルール（役・点数・鳴きなし。4面子1雀頭 / 七対子のツモ・ロン、荒牌流局）
              </p>
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="min-h-[44px] rounded-lg bg-[#c4a574] px-4 py-2 text-sm font-bold text-stone-900"
                >
                  もう一度
                </button>
                {onExit && (
                  <button
                    type="button"
                    onClick={onExit}
                    className="min-h-[44px] rounded-lg border border-white/30 px-3 py-2 text-xs text-white"
                  >
                    レッスンに戻る
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Own hand: single bottom row, white faces via TileButton */}
          <div className="flex items-end gap-2">
            <div className="flex shrink-0 flex-col gap-1.5 pb-1">
              <button
                type="button"
                onClick={askCoach}
                disabled={!humanTurn || coachLoading}
                className="min-h-[44px] min-w-[56px] rounded-lg bg-[#c4a574] px-3 py-2 text-sm font-bold text-stone-900 shadow-md disabled:opacity-40 active:scale-[0.98]"
              >
                {coachLoading ? "…" : "解説"}
              </button>
              {humanTurn && humanCanTsumo && (
                <button
                  type="button"
                  onClick={() => {
                    coachReqId.current += 1;
                    setCoachLoading(false);
                    setCoach(null);
                    setMatch((m) => declareTsumo(m));
                  }}
                  className="min-h-[40px] rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-bold text-white"
                >
                  ツモ
                </button>
              )}
              {humanTurn && selected && (
                <button
                  type="button"
                  onClick={() => humanDiscard(selected)}
                  className="min-h-[40px] rounded-lg bg-stone-900/80 px-2 py-1.5 text-xs font-bold text-white"
                >
                  切る
                </button>
              )}
              {humanTurn && drawn && (
                <button
                  type="button"
                  onClick={() => humanDiscard(drawn)}
                  className="min-h-[36px] rounded-lg border border-white/40 px-2 py-1.5 text-[10px] font-semibold text-white"
                >
                  ツモ切
                </button>
              )}
            </div>

            <div className="practice-hand-scale min-w-0 flex-1 overflow-x-auto pb-0.5">
              <div className="practice-hand-row">
                {closed.map((t, i) => {
                  const isRec = rec.closedIdx === i;
                  const isSel =
                    humanTurn &&
                    selected === t &&
                    !rec.drawn &&
                    (coach ? isRec : closed.indexOf(t) === i);
                  return (
                  <TileButton
                    key={`${t}-${i}-h`}
                    tile={t}
                    size="hand"
                    glow={isSel}
                    recommended={isRec}
                    dimmed={Boolean(coach && !isRec && !isSel)}
                    onClick={humanTurn ? () => onTileTap(t) : undefined}
                  />
                  );
                })}
                {humanTurn && drawn && (
                  <>
                    <span className="mx-0.5 w-px shrink-0 self-stretch bg-white/20" />
                    <TileButton
                      tile={drawn}
                      size="hand"
                      glow={selected === drawn}
                      recommended={rec.drawn}
                      dimmed={Boolean(
                        coach && !rec.drawn && selected !== drawn
                      )}
                      onClick={() => onTileTap(drawn)}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {error && (
            <p className="mt-1 rounded-lg bg-red-900/80 px-2 py-1 text-center text-xs text-red-100">
              {error}
            </p>
          )}
        </div>

        {coach && (
          <section
            className="absolute left-2 top-14 z-50 max-h-[min(42vh,20rem)] w-[min(22rem,calc(100%-5.5rem))] overflow-y-auto rounded-xl border border-white/30 bg-emerald-950/95 p-3 text-white shadow-2xl sm:left-3 sm:top-16"
            aria-label="切牌解説"
          >
            <div className="mb-1 flex items-start justify-between gap-2">
              <h2 className="text-xs font-semibold text-amber-200">
                推奨: {TILE_NAME_JA[coach.discard]}（{coach.discard}）
              </h2>
              <button
                type="button"
                onClick={() => setCoach(null)}
                aria-label="解説を閉じる"
                className="min-h-[36px] min-w-[36px] shrink-0 rounded-md border border-white/30 text-sm text-white/90 active:bg-white/10"
              >
                ×
              </button>
            </div>
            <div className="mt-1">
              <ScoreBars scores={coach.scores} difficulty="advanced" variant="onDark" />
            </div>
            <p className="mt-1 text-xs leading-relaxed text-white/90">
              {coach.explanation}
            </p>
            {humanTurn && (
              <button
                type="button"
                onClick={() => humanDiscard(coach.discard)}
                className="mt-2 min-h-[44px] w-full rounded-lg bg-[#c4a574] py-2 text-xs font-bold text-stone-900"
              >
                推奨牌を切る
              </button>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
