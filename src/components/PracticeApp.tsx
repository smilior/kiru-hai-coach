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

/** Horizontal river (対面 / 自分). Tiles stay upright and readable. */
function RiverHorizontal({
  tiles,
  last,
}: {
  tiles: TileId[];
  last?: TileId | null;
}) {
  const rows = chunkRiver(tiles);
  return (
    <div className="flex max-w-full flex-col items-center gap-px overflow-x-auto">
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-nowrap gap-px">
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

/**
 * Side river (上家 / 下家): each discard "row" of 6 becomes a vertical column
 * so the full 河 stays visible without CSS rotate clipping.
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
  return (
    <div
      className={[
        "flex max-h-full items-end gap-px overflow-y-auto",
        side === "left" ? "flex-row-reverse" : "flex-row",
      ].join(" ")}
    >
      {rows.map((row, ri) => (
        <div key={ri} className="flex flex-col gap-px">
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

/** Tenhou-style center: kyoku + remaining + dora (flat, glanceable). */
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
      aria-label="横向きにしてください"
    >
      <div
        className="pointer-events-none absolute inset-0 border-[3px] border-[#2a1a14]"
        aria-hidden
      />
      <p className="text-2xl" aria-hidden>
        📱↻
      </p>
      <p className="text-lg font-bold text-white">
        実戦練習は横向き専用です
      </p>
      <p className="max-w-sm text-sm leading-relaxed text-white/85">
        端末を横向き（ランドスケープ）に回転してください。縦向きでは対局できません。
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
    // Pause CPU / draws while portrait gate is up (or orientation unknown)
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

  // Do not render the table until orientation is known; never play in portrait.
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
      className="fixed inset-0 z-30 flex flex-col overflow-hidden"
      style={{
        background:
          "radial-gradient(ellipse at center, #1a5c38 0%, #0f3d26 55%, #0a2e1c 100%)",
      }}
    >
      {/* Wood frame */}
      <div
        className="pointer-events-none absolute inset-0 z-40 border-[3px] border-[#2a1a14]"
        aria-hidden
      />

      {/* Table surface */}
      <div className="relative flex min-h-0 flex-1 flex-col px-2 pb-1 pt-2 sm:px-3 sm:pt-3">
        {/* Corner scores + dora */}
        <div className="relative z-10 mb-1 flex shrink-0 items-start justify-between gap-2 px-1">
          <div className="space-y-0.5">
            <ScoreLabel seat={top} />
            <ScoreLabel seat={left} />
          </div>
          <div className="flex flex-col items-end gap-1">
            <ScoreLabel seat={right} className="text-right" />
            <ScoreLabel seat={bottom} highlight className="text-right" />
          </div>
        </div>

        {/* Side outlined buttons */}
        <div className="absolute right-2 top-14 z-20 flex flex-col gap-2 sm:right-3 sm:top-16">
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
            className="min-h-[36px] rounded border border-amber-400/70 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/95 active:bg-white/10 sm:text-xs"
          >
            流局を表示
          </button>
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="min-h-[36px] rounded border border-amber-400/70 bg-transparent px-2 py-1.5 text-[10px] font-medium text-white/95 active:bg-white/10 sm:text-xs"
          >
            設定
          </button>
        </div>

        {settingsOpen && (
          <div className="absolute right-2 top-32 z-30 w-40 rounded-lg border border-amber-400/50 bg-emerald-950/95 p-2 shadow-xl sm:right-3">
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

        {/* Center table: rivers + box — flex so all 河 stay visible */}
        <div className="relative mx-auto flex min-h-0 w-full max-w-4xl flex-1 flex-col items-stretch justify-center gap-1 py-1">
          {/* Top river (西 対面) */}
          <div className="flex min-h-0 shrink justify-center overflow-visible px-8">
            <RiverHorizontal
              tiles={match.seats[top].river}
              last={lastDisc?.seat === top ? lastDisc.tile : null}
            />
          </div>

          <div className="flex min-h-0 w-full flex-1 items-center justify-center gap-2 sm:gap-3">
            {/* Left river (北 上家) — full 河, upright */}
            <div className="flex h-full min-w-[56px] max-w-[30%] flex-1 items-center justify-end overflow-visible sm:min-w-[72px]">
              <RiverSide
                tiles={match.seats[left].river}
                last={lastDisc?.seat === left ? lastDisc.tile : null}
                side="left"
              />
            </div>

            <CenterBox
              roundLabel={match.roundLabel}
              remaining={match.wall.length}
              turn={match.turn}
              phase={match.phase}
              doraIndicator={match.doraIndicator}
            />

            {/* Right river (南 下家) */}
            <div className="flex h-full min-w-[56px] max-w-[30%] flex-1 items-center justify-start overflow-visible sm:min-w-[72px]">
              <RiverSide
                tiles={match.seats[right].river}
                last={lastDisc?.seat === right ? lastDisc.tile : null}
                side="right"
              />
            </div>
          </div>

          {/* Bottom river (東 あなた) */}
          <div className="flex min-h-0 shrink justify-center overflow-visible px-8">
            <RiverHorizontal
              tiles={match.seats[bottom].river}
              last={lastDisc?.seat === bottom ? lastDisc.tile : null}
            />
          </div>
        </div>

        {/* Human score + prompt + hand */}
        <div className="relative z-10 mt-auto shrink-0 px-1 pb-1">
          <p
            className={[
              "mb-0.5 text-center text-xs font-medium sm:text-sm",
              humanTurn ? "text-amber-200" : "text-white/85",
            ].join(" ")}
          >
            {promptText}
          </p>
          {/* Ron overlay */}
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
                onClick={() => setRonPassKey(lastDiscardKey)}
                className="min-h-[44px] rounded-lg border border-white/40 bg-black/30 px-5 py-2.5 text-sm font-medium text-white"
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
                  className="min-h-[44px] rounded-lg bg-[#c4a574] px-4 py-2 text-sm font-bold text-stone-900"
                >
                  もう一度
                </button>
                <button
                  type="button"
                  onClick={() => setShowRyuukyoku(false)}
                  className="min-h-[44px] rounded-lg border border-white/30 px-3 py-2 text-xs text-white"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}

          {/* Hand + 解説 — single non-wrapping row */}
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
                    <span className="mx-0.5 w-px shrink-0 self-stretch bg-white/20" />
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
        </div>

        {/* Jev card: floating, closable, does not push/block the table hand */}
        {coach && (
          <section className="absolute bottom-20 left-2 right-2 z-50 mx-auto max-h-[40vh] max-w-lg overflow-y-auto rounded-xl border border-amber-400/40 bg-emerald-950/95 p-3 text-white shadow-2xl sm:bottom-24">
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
