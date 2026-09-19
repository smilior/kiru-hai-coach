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
  ronCandidates,
  type MatchState,
  type Seat,
} from "@/lib/practice";

const PLAYER_KEY = "khc_player_id";
const CPU_DELAY_MS = 750;
const RIVER_ROW = 6;

type CoachResponse = {
  discard: TileId;
  scores: Scores;
  explanation: string;
};

type Props = {
  onExit?: () => void;
};

function chunkRiver(tiles: TileId[]): TileId[][] {
  const rows: TileId[][] = [];
  for (let i = 0; i < tiles.length; i += RIVER_ROW) {
    rows.push(tiles.slice(i, i + RIVER_ROW));
  }
  return rows.length ? rows : [[]];
}

function RiverGrid({
  tiles,
  last,
  rotate = 0,
}: {
  tiles: TileId[];
  last?: TileId | null;
  rotate?: 0 | 90 | 180 | 270;
}) {
  const rows = chunkRiver(tiles);
  const rot =
    rotate === 90
      ? "rotate-90"
      : rotate === 180
        ? "rotate-180"
        : rotate === 270
          ? "-rotate-90"
          : "";

  return (
    <div className={`flex flex-col items-center gap-0.5 ${rot}`}>
      {rows.map((row, ri) => (
        <div key={ri} className="flex gap-px">
          {row.map((t, i) => {
            const globalIdx = ri * RIVER_ROW + i;
            const isLast = Boolean(
              last && last === t && globalIdx === tiles.length - 1
            );
            return (
              <TileButton
                key={`${t}-${globalIdx}`}
                tile={t}
                size="xs"
                faceOnly
                highlighted={isLast}
              />
            );
          })}
        </div>
      ))}
    </div>
  );
}

function CenterBox({
  roundLabel,
  remaining,
  turn,
  phase,
}: {
  roundLabel: string;
  remaining: number;
  turn: Seat;
  phase: MatchState["phase"];
}) {
  const windClass = (seat: Seat) =>
    [
      "absolute text-[11px] font-bold leading-none",
      turn === seat && phase === "playing"
        ? "text-amber-300"
        : "text-white/85",
    ].join(" ");

  return (
    <div className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 flex-col items-center justify-center border border-amber-400/80 bg-emerald-950/40 text-center shadow-[inset_0_0_12px_rgba(0,0,0,0.35)] sm:h-20 sm:w-20">
      <span className={`${windClass(VIEW_SEATS.top)} top-0.5 left-1/2 -translate-x-1/2`}>
        {SEAT_LABEL[VIEW_SEATS.top]}
      </span>
      <span className={`${windClass(VIEW_SEATS.left)} left-1 top-1/2 -translate-y-1/2`}>
        {SEAT_LABEL[VIEW_SEATS.left]}
      </span>
      <span className={`${windClass(VIEW_SEATS.right)} right-1 top-1/2 -translate-y-1/2`}>
        {SEAT_LABEL[VIEW_SEATS.right]}
      </span>
      <span className={`${windClass(VIEW_SEATS.bottom)} bottom-0.5 left-1/2 -translate-x-1/2`}>
        {SEAT_LABEL[VIEW_SEATS.bottom]}
      </span>
      <span className="text-sm font-bold tracking-wide text-white sm:text-base">
        {phase === "ended" ? "終局" : roundLabel}
      </span>
      <span className="text-[10px] text-white/80 sm:text-xs">
        残り {remaining}
      </span>
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

export function PracticeApp({ onExit }: Props) {
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
  const [showRyuukyoku, setShowRyuukyoku] = useState(false);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastDiscardKey = match.lastDiscard
    ? `${match.lastDiscard.seat}-${match.lastDiscard.tile}-${match.seats[match.lastDiscard.seat].river.length}`
    : "";

  const humanCanRon = useMemo(() => {
    if (match.phase !== "playing" || match.hasDrawn) return false;
    if (ronPassKey && ronPassKey === lastDiscardKey) return false;
    return ronCandidates(match).includes(HUMAN_SEAT);
  }, [match, ronPassKey, lastDiscardKey]);

  const promptText = useMemo(() => {
    if (match.phase === "ended") return match.endReason || "練習終了";
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
    setShowRyuukyoku(false);
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
    setMatch((m) => discardFromTurn(m, tile));
    setSelected(null);
    setCoach(null);
    setError(null);
  }

  function onTileTap(tile: TileId) {
    if (!humanTurn) return;
    if (selected === tile) {
      humanDiscard(tile);
      return;
    }
    setSelected(tile);
  }

  async function askCoach() {
    if (match.turn !== HUMAN_SEAT || !match.hasDrawn) return;
    const hand = match.seats[HUMAN_SEAT].hand;
    if (hand.length !== 14) return;

    setCoachLoading(true);
    setError(null);
    try {
      const river = allRivers(match);
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hand,
          difficulty: "intermediate",
          river,
          mode: "vs-cpu",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "コーチ呼び出しに失敗しました");

      const explanation = `${data.explanation}（実戦練習・mode=vs-cpu）`;
      setCoach({
        discard: data.discard,
        scores: data.scores,
        explanation,
      });
      setSelected(data.discard);

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
      if (pid) {
        await fetch("/api/consultations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_id: pid,
            hand,
            discard: data.discard,
            scores: data.scores,
            explanation,
          }),
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setCoachLoading(false);
    }
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

  const top = VIEW_SEATS.top;
  const left = VIEW_SEATS.left;
  const right = VIEW_SEATS.right;
  const bottom = VIEW_SEATS.bottom;

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a5c38 0%, #0f3d26 55%, #0a2e1c 100%)",
      }}
    >
      {/* Wood frame */}
      <div
        className="pointer-events-none absolute inset-0 z-40 border-[5px] border-[#3e2723] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.06)]"
        aria-hidden
      />

      {/* Table surface */}
      <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-1 pt-2 sm:px-3 sm:pt-3">
        {/* Corner scores + dora */}
        <div className="relative z-10 mb-1 flex items-start justify-between gap-2 px-1">
          <div className="space-y-0.5">
            <ScoreLabel seat={top} />
            <ScoreLabel seat={left} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <ScoreLabel seat={right} className="text-right" />
            <div className="flex items-center gap-1.5">
              <span className="text-[10px] font-medium text-white/90">ドラ</span>
              <TileButton tile={match.doraIndicator} size="xs" faceOnly />
            </div>
          </div>
        </div>

        {/* Side outlined buttons */}
        <div className="absolute right-2 top-16 z-20 flex flex-col gap-2 sm:right-3 sm:top-20">
          <button
            type="button"
            onClick={() => {
              if (match.phase === "ended") {
                setShowRyuukyoku(true);
              } else {
                setMatch((m) =>
                  endPractice(m, "流局（表示）— 山を残して終了しました。")
                );
                setShowRyuukyoku(true);
              }
            }}
            className="rounded border border-amber-400/70 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/95 active:bg-white/10 sm:text-xs"
          >
            流局を表示
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="rounded border border-amber-400/70 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/95 active:bg-white/10 sm:text-xs"
          >
            設定
          </button>
        </div>

        {settingsOpen && (
          <div className="absolute right-2 top-36 z-30 w-40 rounded-lg border border-amber-400/50 bg-emerald-950/95 p-2 shadow-xl sm:right-3">
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

        {/* Center table: rivers + box */}
        <div className="relative mx-auto flex min-h-0 w-full max-w-lg flex-1 flex-col items-center justify-center py-1">
          {/* Top river (西 対面) */}
          <div className="mb-1 flex min-h-[32px] justify-center">
            <RiverGrid
              tiles={match.seats[top].river}
              last={lastDisc?.seat === top ? lastDisc.tile : null}
              rotate={180}
            />
          </div>

          <div className="flex w-full items-center justify-center gap-1 sm:gap-2">
            {/* Left river (北 上家) */}
            <div className="flex w-[72px] justify-center sm:w-[88px]">
              <RiverGrid
                tiles={match.seats[left].river}
                last={lastDisc?.seat === left ? lastDisc.tile : null}
                rotate={270}
              />
            </div>

            <CenterBox
              roundLabel={match.roundLabel}
              remaining={match.wall.length}
              turn={match.turn}
              phase={match.phase}
            />

            {/* Right river (南 下家) */}
            <div className="flex w-[72px] justify-center sm:w-[88px]">
              <RiverGrid
                tiles={match.seats[right].river}
                last={lastDisc?.seat === right ? lastDisc.tile : null}
                rotate={90}
              />
            </div>
          </div>

          {/* Bottom river (東 あなた) */}
          <div className="mt-1 flex min-h-[32px] justify-center">
            <RiverGrid
              tiles={match.seats[bottom].river}
              last={lastDisc?.seat === bottom ? lastDisc.tile : null}
            />
          </div>
        </div>

        {/* Human score + prompt */}
        <div className="relative z-10 mt-auto px-1 pb-1">
          <p
            className={[
              "mb-1 text-center text-xs font-medium sm:text-sm",
              humanTurn ? "text-amber-200" : "text-white/85",
            ].join(" ")}
          >
            {promptText}
          </p>
          <ScoreLabel seat={bottom} highlight className="mb-2 text-center" />

          {/* Ron overlay */}
          {humanCanRon && lastDisc && (
            <div className="mb-2 flex justify-center gap-2">
              <button
                type="button"
                onClick={() => setMatch((m) => declareRon(m, HUMAN_SEAT))}
                className="rounded-lg bg-rose-600 px-5 py-2.5 text-sm font-bold text-white shadow"
              >
                ロン
              </button>
              <button
                type="button"
                onClick={() => setRonPassKey(lastDiscardKey)}
                className="rounded-lg border border-white/40 bg-black/30 px-5 py-2.5 text-sm font-medium text-white"
              >
                スルー
              </button>
            </div>
          )}

          {/* End overlay */}
          {(match.phase === "ended" || showRyuukyoku) && (
            <div className="mb-2 rounded-xl border border-amber-400/40 bg-emerald-950/90 px-3 py-3 text-center">
              <p className="text-sm font-semibold text-white">
                {match.endReason || "流局"}
              </p>
              <p className="mt-1 text-[10px] text-white/60">
                ※ 簡易ルール（役・点数・鳴きなし。形完成のツモ/ロンのみ）
              </p>
              <div className="mt-2 flex justify-center gap-2">
                <button
                  type="button"
                  onClick={restart}
                  className="rounded-lg bg-[#c4a574] px-4 py-2 text-sm font-bold text-stone-900"
                >
                  もう一度
                </button>
                <button
                  type="button"
                  onClick={() => setShowRyuukyoku(false)}
                  className="rounded-lg border border-white/30 px-3 py-2 text-xs text-white"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* Hand + 解説 */}
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
                  onClick={() => setMatch((m) => declareTsumo(m))}
                  className="rounded-lg bg-rose-600 px-2 py-1.5 text-xs font-bold text-white"
                >
                  ツモ
                </button>
              )}
              {humanTurn && selected && (
                <button
                  type="button"
                  onClick={() => humanDiscard(selected)}
                  className="rounded-lg bg-stone-900/80 px-2 py-1.5 text-xs font-bold text-white"
                >
                  切る
                </button>
              )}
              {humanTurn && drawn && (
                <button
                  type="button"
                  onClick={() => humanDiscard(drawn)}
                  className="rounded-lg border border-white/40 px-2 py-1.5 text-[10px] font-semibold text-white"
                >
                  ツモ切
                </button>
              )}
            </div>

            <div className="min-w-0 flex-1 overflow-x-auto pb-1">
              <div className="flex justify-center gap-0.5 sm:gap-1">
                {closed.map((t, i) => (
                  <TileButton
                    key={`${t}-${i}-h`}
                    tile={t}
                    size="hand"
                    glow={humanTurn && selected === t}
                    recommended={Boolean(coach && coach.discard === t)}
                    dimmed={Boolean(coach && coach.discard !== t && selected !== t)}
                    onClick={humanTurn ? () => onTileTap(t) : undefined}
                  />
                ))}
                {humanTurn && drawn && (
                  <>
                    <span className="mx-0.5 w-px self-stretch bg-white/20" />
                    <TileButton
                      tile={drawn}
                      size="hand"
                      glow={selected === drawn}
                      recommended={Boolean(coach && coach.discard === drawn)}
                      dimmed={Boolean(
                        coach && coach.discard !== drawn && selected !== drawn
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

          {coach && (
            <section className="mt-2 max-h-36 overflow-y-auto rounded-xl border border-amber-400/30 bg-emerald-950/95 p-3 text-white shadow-lg">
              <h2 className="text-xs font-semibold text-amber-200">
                推奨: {TILE_NAME_JA[coach.discard]}（{coach.discard}）
              </h2>
              <div className="mt-1 [&_*]:text-white">
                <ScoreBars scores={coach.scores} difficulty="advanced" />
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/90">
                {coach.explanation}
              </p>
              {humanTurn && (
                <button
                  type="button"
                  onClick={() => humanDiscard(coach.discard)}
                  className="mt-2 w-full rounded-lg bg-[#c4a574] py-2 text-xs font-bold text-stone-900"
                >
                  推奨牌を切る
                </button>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
