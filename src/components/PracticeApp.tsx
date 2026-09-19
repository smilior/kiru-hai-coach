"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { TileButton } from "./TileButton";
import { ScoreBars } from "./ScoreBars";
import { TILE_NAME_JA, type TileId } from "@/lib/tiles";
import type { Scores } from "@/lib/explanation";
import {
  HUMAN_SEAT,
  SEAT_LABEL,
  allRivers,
  canTsumo,
  createMatch,
  cpuPickDiscard,
  declareRon,
  declareTsumo,
  discardFromTurn,
  drawForTurn,
  endPractice,
  ronCandidates,
  type MatchState,
  type Seat,
} from "@/lib/practice";

const PLAYER_KEY = "khc_player_id";
const CPU_DELAY_MS = 750;

type CoachResponse = {
  discard: TileId;
  scores: Scores;
  explanation: string;
};

function RiverRow({
  tiles,
  align = "center",
  last,
}: {
  tiles: TileId[];
  align?: "center" | "start" | "end";
  last?: TileId | null;
}) {
  const justify =
    align === "start"
      ? "justify-start"
      : align === "end"
        ? "justify-end"
        : "justify-center";
  if (tiles.length === 0) {
    return (
      <div className={`flex min-h-[38px] flex-wrap gap-0.5 ${justify}`}>
        <span className="text-[10px] text-emerald-800/40">（河なし）</span>
      </div>
    );
  }
  return (
    <div className={`flex max-w-full flex-wrap gap-0.5 ${justify}`}>
      {tiles.map((t, i) => (
        <TileButton
          key={`${t}-${i}`}
          tile={t}
          size="xs"
          faceOnly
          highlighted={Boolean(last && last === t && i === tiles.length - 1)}
        />
      ))}
    </div>
  );
}

function SeatBadge({
  seat,
  isTurn,
  isHuman,
}: {
  seat: Seat;
  isTurn: boolean;
  isHuman: boolean;
}) {
  return (
    <div
      className={[
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold",
        isTurn
          ? "bg-amber-400 text-stone-900 ring-2 ring-amber-200"
          : "bg-emerald-900/70 text-emerald-50",
      ].join(" ")}
    >
      <span>{SEAT_LABEL[seat]}</span>
      <span className="font-normal opacity-90">
        {isHuman ? "あなた" : "CPU"}
      </span>
      {isTurn && <span className="text-[10px]">手番</span>}
    </div>
  );
}

function CpuHandBacks({ count }: { count: number }) {
  return (
    <div className="flex justify-center gap-0.5 opacity-70" aria-hidden>
      {Array.from({ length: Math.min(count, 14) }).map((_, i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          key={i}
          src="/tiles/Back.png"
          alt=""
          width={18}
          height={24}
          className="rounded-sm"
          draggable={false}
        />
      ))}
    </div>
  );
}

export function PracticeApp() {
  const [match, setMatch] = useState<MatchState>(() => createMatch());
  const [selected, setSelected] = useState<TileId | null>(null);
  const [coachLoading, setCoachLoading] = useState(false);
  const [coach, setCoach] = useState<CoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem(PLAYER_KEY);
  });
  /** lastDiscard key the human chose to pass on. */
  const [ronPassKey, setRonPassKey] = useState<string | null>(null);
  const cpuTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastDiscardKey = match.lastDiscard
    ? `${match.lastDiscard.seat}-${match.lastDiscard.tile}-${match.seats[match.lastDiscard.seat].river.length}`
    : "";

  const humanCanRon = useMemo(() => {
    if (match.phase !== "playing" || match.hasDrawn) return false;
    if (ronPassKey && ronPassKey === lastDiscardKey) return false;
    return ronCandidates(match).includes(HUMAN_SEAT);
  }, [match, ronPassKey, lastDiscardKey]);

  const statusLine = useMemo(() => {
    if (match.phase === "ended") return match.endReason || "練習終了";
    if (humanCanRon && match.lastDiscard) {
      return `${SEAT_LABEL[match.lastDiscard.seat]}の${TILE_NAME_JA[match.lastDiscard.tile]} — ロンできます`;
    }
    if (!match.hasDrawn) {
      return match.turn === HUMAN_SEAT
        ? "あなたがツモります…"
        : `${SEAT_LABEL[match.turn]}（CPU）の番です…`;
    }
    if (match.turn === HUMAN_SEAT) {
      if (canTsumo(match)) return "形が揃いました。ツモできます。";
      return "あなたの番です。切る牌を選んでください。";
    }
    if (match.lastDiscard) {
      const { seat, tile } = match.lastDiscard;
      return `${SEAT_LABEL[seat]} が ${TILE_NAME_JA[tile]} を切りました`;
    }
    return `${SEAT_LABEL[match.turn]}（CPU）が考えています…`;
  }, [match, humanCanRon]);

  const restart = useCallback(() => {
    if (cpuTimer.current) clearTimeout(cpuTimer.current);
    setMatch(createMatch());
    setSelected(null);
    setCoach(null);
    setError(null);
    setRonPassKey(null);
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

  // Draw + CPU auto-play (paused while human can ron)
  useEffect(() => {
    if (match.phase !== "playing") return;
    if (humanCanRon) return;

    const isHuman = match.turn === HUMAN_SEAT;

    if (!match.hasDrawn) {
      const t = setTimeout(() => {
        setMatch((m) => {
          if (m.phase !== "playing" || m.hasDrawn) return m;
          // Caller already cleared humanCanRon via ronPassKey; do not re-block here.
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
    if (!match.seats.S.hand.includes(tile)) return;
    setMatch((m) => discardFromTurn(m, tile));
    setSelected(null);
    setCoach(null);
    setError(null);
  }

  async function askCoach() {
    if (match.turn !== HUMAN_SEAT || !match.hasDrawn) return;
    const hand = match.seats.S.hand;
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

  const human = match.seats.S;
  const humanTurn =
    match.phase === "playing" &&
    match.turn === HUMAN_SEAT &&
    match.hasDrawn;
  const drawn = match.drawnTile;
  const closed = humanTurn && drawn ? human.hand.slice(0, -1) : human.hand;
  const lastDisc = match.lastDiscard;
  const humanCanTsumo = humanTurn && canTsumo(match);

  return (
    <div className="flex w-full flex-col gap-3 py-1 pb-28">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-stone-600">
          山あと{" "}
          <span className="font-mono font-semibold">{match.wall.length}</span>{" "}
          枚
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setMatch((m) => endPractice(m))}
            disabled={match.phase === "ended"}
            className="rounded-full border border-stone-300 bg-white px-3 py-1 text-xs font-medium text-stone-700 disabled:opacity-40"
          >
            練習終了
          </button>
          <button
            type="button"
            onClick={restart}
            className="rounded-full bg-stone-800 px-3 py-1 text-xs font-medium text-white active:scale-95"
          >
            配り直し
          </button>
        </div>
      </div>

      <div className="relative overflow-hidden rounded-3xl border border-emerald-900/20 bg-gradient-to-b from-emerald-800 to-emerald-950 p-3 shadow-inner">
        <div className="mb-2 flex flex-col items-center gap-1">
          <SeatBadge
            seat="N"
            isTurn={match.turn === "N" && match.phase === "playing"}
            isHuman={false}
          />
          <CpuHandBacks count={match.seats.N.hand.length} />
          <RiverRow
            tiles={match.seats.N.river}
            last={lastDisc?.seat === "N" ? lastDisc.tile : null}
          />
        </div>

        <div className="mb-2 grid grid-cols-[1fr_auto_1fr] items-start gap-2">
          <div className="flex flex-col items-start gap-1">
            <SeatBadge
              seat="W"
              isTurn={match.turn === "W" && match.phase === "playing"}
              isHuman={false}
            />
            <CpuHandBacks count={match.seats.W.hand.length} />
            <RiverRow
              tiles={match.seats.W.river}
              align="start"
              last={lastDisc?.seat === "W" ? lastDisc.tile : null}
            />
          </div>
          <div className="flex h-16 w-16 flex-col items-center justify-center rounded-full border border-emerald-600/40 bg-emerald-900/50 text-center">
            <span className="text-[10px] text-emerald-200/80">場</span>
            <span className="text-xs font-bold text-amber-200">
              {match.phase === "ended" ? "終局" : `${SEAT_LABEL[match.turn]}番`}
            </span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <SeatBadge
              seat="E"
              isTurn={match.turn === "E" && match.phase === "playing"}
              isHuman={false}
            />
            <CpuHandBacks count={match.seats.E.hand.length} />
            <RiverRow
              tiles={match.seats.E.river}
              align="end"
              last={lastDisc?.seat === "E" ? lastDisc.tile : null}
            />
          </div>
        </div>

        <div className="flex flex-col items-center gap-1 border-t border-emerald-700/40 pt-2">
          <SeatBadge
            seat="S"
            isTurn={match.turn === "S" && match.phase === "playing"}
            isHuman
          />
          <RiverRow
            tiles={match.seats.S.river}
            last={lastDisc?.seat === "S" ? lastDisc.tile : null}
          />
        </div>
      </div>

      <p className="text-center text-sm text-stone-600">{statusLine}</p>

      {humanCanRon && lastDisc && (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 p-3 text-center shadow-sm">
          <p className="text-sm font-semibold text-rose-800">
            ロンできます！（{TILE_NAME_JA[lastDisc.tile]}）
          </p>
          <div className="mt-2 flex justify-center gap-2">
            <button
              type="button"
              onClick={() => setMatch((m) => declareRon(m, HUMAN_SEAT))}
              className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              ロン
            </button>
            <button
              type="button"
              onClick={() => setRonPassKey(lastDiscardKey)}
              className="rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-medium text-stone-700"
            >
              スルー
            </button>
          </div>
          <p className="mt-1 text-[10px] text-stone-500">
            点数計算なし・形完成のみ
          </p>
        </div>
      )}

      {match.phase === "ended" && (
        <div className="rounded-2xl border border-stone-200 bg-white p-4 text-center shadow-sm">
          <p className="text-sm font-medium text-stone-800">
            {match.endReason || "練習終了"}
          </p>
          <p className="mt-1 text-xs text-stone-500">
            ※ V1.5は簡易ルール（役・点数・鳴きなし。形完成のツモ/ロンのみ）。河を見ながら切る感覚の練習です。
          </p>
          <button
            type="button"
            onClick={restart}
            className="mt-3 rounded-xl bg-amber-500 px-5 py-2.5 text-sm font-bold text-white"
          >
            もう一度
          </button>
        </div>
      )}

      <section className="rounded-2xl border border-stone-200 bg-white p-3 shadow-sm">
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-stone-800">
            あなたの手牌（{human.hand.length}枚）
          </h2>
          {humanTurn && (
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              切る牌をタップ
            </span>
          )}
        </div>

        <div className="flex flex-wrap justify-center gap-1.5">
          {closed.map((t, i) => (
            <TileButton
              key={`${t}-${i}-h`}
              tile={t}
              size="md"
              selected={humanTurn && selected === t && coach?.discard !== t}
              recommended={Boolean(coach && coach.discard === t)}
              dimmed={Boolean(coach && coach.discard !== t)}
              onClick={humanTurn ? () => setSelected(t) : undefined}
            />
          ))}
        </div>

        {humanTurn && drawn && (
          <div className="mt-3 flex flex-col items-center gap-1">
            <span className="text-xs font-medium text-stone-500">ツモ</span>
            <TileButton
              tile={drawn}
              size="lg"
              selected={selected === drawn && coach?.discard !== drawn}
              recommended={Boolean(coach && coach.discard === drawn)}
              dimmed={Boolean(coach && coach.discard !== drawn)}
              onClick={() => setSelected(drawn)}
            />
          </div>
        )}
      </section>

      {humanTurn && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-stone-100/95 px-3 py-3 backdrop-blur">
          <div className="mx-auto flex max-w-lg gap-2">
            {humanCanTsumo && (
              <button
                type="button"
                onClick={() => setMatch((m) => declareTsumo(m))}
                className="rounded-xl bg-rose-600 px-3 py-3.5 text-sm font-bold text-white active:scale-[0.98]"
              >
                ツモ
              </button>
            )}
            <button
              type="button"
              onClick={() => selected && humanDiscard(selected)}
              disabled={!selected}
              className="flex-[1.2] rounded-xl bg-stone-900 py-3.5 text-base font-bold text-white disabled:opacity-40 active:scale-[0.98]"
            >
              切る
            </button>
            <button
              type="button"
              onClick={askCoach}
              disabled={coachLoading}
              className="flex-1 rounded-xl bg-amber-500 py-3.5 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98]"
            >
              {coachLoading ? "考え中…" : "コーチに聞く"}
            </button>
            <button
              type="button"
              onClick={() => drawn && humanDiscard(drawn)}
              disabled={!drawn}
              className="rounded-xl border border-stone-300 bg-white px-3 py-3.5 text-xs font-semibold text-stone-700 disabled:opacity-40 active:scale-[0.98]"
            >
              ツモ切
            </button>
          </div>
        </div>
      )}

      {error && (
        <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {coach && (
        <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm space-y-3">
          <h2 className="text-sm font-semibold text-emerald-800">
            推奨: {TILE_NAME_JA[coach.discard]}（{coach.discard}）
          </h2>
          <ScoreBars scores={coach.scores} difficulty="advanced" />
          <p className="text-sm leading-relaxed text-stone-700">
            {coach.explanation}
          </p>
          {humanTurn && (
            <button
              type="button"
              onClick={() => humanDiscard(coach.discard)}
              className="w-full rounded-xl bg-emerald-600 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
            >
              推奨牌を切る
            </button>
          )}
        </section>
      )}
    </div>
  );
}
