"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { TileButton } from "./TileButton";
import { LessonPath } from "./LessonPath";
import { ScoreBars } from "./ScoreBars";
import { ModeTabs, type AppMode } from "./ModeTabs";
import { PracticeApp } from "./PracticeApp";
import {
  dealHand14,
  sortHand,
  TILE_NAME_JA,
  type TileId,
} from "@/lib/tiles";
import {
  LESSONS,
  defaultProgress,
  type LessonId,
  type LessonStatus,
} from "@/lib/lessons";
import type { Scores } from "@/lib/explanation";

const PLAYER_KEY = "khc_player_id";

type CoachResponse = {
  discard: TileId;
  scores: Scores;
  explanation: string;
};

type CoachAppProps = {
  /** When true, AppShell already shows header + mode tabs; render lesson only. */
  embedded?: boolean;
};

export function CoachApp({ embedded = false }: CoachAppProps) {
  const [mode, setMode] = useState<AppMode>("lesson");
  const [hand, setHand] = useState<TileId[]>(() => sortHand(dealHand14()));
  const [selected, setSelected] = useState<TileId | null>(null);
  const [difficulty, setDifficulty] = useState<LessonId>("beginner");
  const [progress, setProgress] = useState<Record<LessonId, LessonStatus>>(
    defaultProgress()
  );
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CoachResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<
    { discard: string; explanation: string; created_at: string }[]
  >([]);

  const lesson = useMemo(
    () => LESSONS.find((l) => l.id === difficulty)!,
    [difficulty]
  );

  const deal = useCallback(() => {
    setHand(sortHand(dealHand14()));
    setSelected(null);
    setResult(null);
    setError(null);
  }, []);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(PLAYER_KEY) : null;

    async function boot() {
      try {
        const putRes = await fetch("/api/progress", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ player_id: stored || undefined }),
        });
        if (putRes.ok) {
          const data = await putRes.json();
          if (data.player_id) {
            setPlayerId(data.player_id);
            localStorage.setItem(PLAYER_KEY, data.player_id);
          }
          if (data.progress) setProgress(data.progress);
        } else {
          const getRes = await fetch(
            `/api/progress${stored ? `?player_id=${stored}` : ""}`
          );
          if (getRes.ok) {
            const data = await getRes.json();
            if (data.player_id) {
              setPlayerId(data.player_id);
              localStorage.setItem(PLAYER_KEY, data.player_id);
            }
            if (data.progress) setProgress(data.progress);
          }
        }

        if (stored) {
          const c = await fetch(`/api/consultations?player_id=${stored}&limit=5`);
          if (c.ok) {
            const data = await c.json();
            setHistory(data.items || []);
          }
        }
      } catch {
        /* offline / turso missing — UI still works for dealing */
      }
    }
    boot();
  }, []);

  async function askCoach() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hand, difficulty, river: [] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "コーチ呼び出しに失敗しました");

      // Keep discard consistent with hand + highlight
      const discard: TileId = hand.includes(data.discard)
        ? data.discard
        : hand[hand.length - 1];
      const scores: Scores = {
        efficiency: Number(data.scores?.efficiency ?? 0),
        safety: Number(data.scores?.safety ?? 0),
        wait: Number(data.scores?.wait ?? 0),
      };
      const explanation =
        typeof data.explanation === "string"
          ? data.explanation
          : `推奨は「${TILE_NAME_JA[discard]}」です。`;

      const normalized: CoachResponse = { discard, scores, explanation };
      setResult(normalized);
      setSelected(discard);

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
            discard,
            scores,
            explanation,
          }),
        });
        const c = await fetch(`/api/consultations?player_id=${pid}&limit=5`);
        if (c.ok) {
          const cd = await c.json();
          setHistory(cd.items || []);
        }
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "エラーが発生しました");
    } finally {
      setLoading(false);
    }
  }

  async function clearLesson() {
    const res = await fetch("/api/progress", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        player_id: playerId || undefined,
        lesson_id: difficulty,
        status: "cleared",
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.player_id) {
        setPlayerId(data.player_id);
        localStorage.setItem(PLAYER_KEY, data.player_id);
      }
      if (data.progress) {
        setProgress(data.progress);
        // Auto-advance to newly unlocked lesson
        if (
          difficulty === "beginner" &&
          data.progress.intermediate !== "locked"
        ) {
          setDifficulty("intermediate");
          setResult(null);
        } else if (
          difficulty === "intermediate" &&
          data.progress.advanced !== "locked"
        ) {
          setDifficulty("advanced");
          setResult(null);
        }
      }
    }
  }

  const closed = hand.slice(0, 13);
  const tsumo = hand[13];

  const lessonBody = (
        <>
          <LessonPath
            progress={progress}
            current={difficulty}
            onSelect={(id) => {
              setDifficulty(id);
              setResult(null);
              setError(null);
            }}
          />

          <section className="rounded-2xl border border-stone-200 bg-white p-4 shadow-sm">
            <h2 className="text-sm font-semibold text-stone-800">
              {lesson.title} — {lesson.subtitle}
            </h2>
            <p className="mt-1 text-sm text-stone-600">{lesson.focus}</p>
            <ul className="mt-2 list-disc space-y-0.5 pl-5 text-xs text-stone-500">
              {lesson.tips.map((t) => (
                <li key={t}>{t}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-2xl border border-emerald-100 bg-gradient-to-b from-emerald-50 to-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-stone-800">
                手牌（14枚）
              </h2>
              <button
                type="button"
                onClick={deal}
                className="rounded-full bg-stone-800 px-3 py-1 text-xs font-medium text-white active:scale-95"
              >
                配り直し
              </button>
            </div>

            <p className="mb-2 text-xs text-stone-500">切る牌をタップ（任意）</p>
            <div className="flex flex-wrap justify-center gap-1.5">
              {closed.map((t, i) => (
                <TileButton
                  key={`${t}-${i}`}
                  tile={t}
                  size="md"
                  selected={selected === t && !result}
                  recommended={result?.discard === t}
                  dimmed={Boolean(result && result.discard !== t)}
                  onClick={() => setSelected(t)}
                />
              ))}
            </div>

            {tsumo && (
              <div className="mt-4 flex flex-col items-center gap-1">
                <span className="text-xs font-medium text-stone-500">ツモ</span>
                <TileButton
                  tile={tsumo}
                  size="lg"
                  selected={selected === tsumo && !result}
                  recommended={result?.discard === tsumo}
                  dimmed={Boolean(result && result.discard !== tsumo)}
                  onClick={() => setSelected(tsumo)}
                />
              </div>
            )}
          </section>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={askCoach}
              disabled={loading || hand.length !== 14}
              className="flex-1 rounded-xl bg-amber-500 py-3.5 text-base font-bold text-white shadow-md disabled:opacity-50 active:scale-[0.98]"
            >
              {loading ? "考え中…" : "コーチに聞く"}
            </button>
            <button
              type="button"
              onClick={clearLesson}
              className="rounded-xl border border-stone-300 bg-white px-3 py-3 text-xs font-medium text-stone-700"
            >
              クリア
            </button>
          </div>

          {error && (
            <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          {result && (
            <section className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm space-y-3">
              <h2 className="text-sm font-semibold text-emerald-800">
                推奨: {TILE_NAME_JA[result.discard]}（{result.discard}）
              </h2>
              <ScoreBars scores={result.scores} difficulty={difficulty} />
              <p className="text-sm leading-relaxed text-stone-700">
                {result.explanation}
              </p>
              {selected && selected !== result.discard && (
                <p className="text-xs text-stone-500">
                  あなたの選択: {TILE_NAME_JA[selected]} —
                  コーチ推奨と比較してみましょう。
                </p>
              )}
            </section>
          )}

          {history.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-stone-600">
                最近の相談
              </h2>
              <ul className="space-y-2">
                {history.map((h, i) => (
                  <li
                    key={`${h.created_at}-${i}`}
                    className="rounded-xl border border-stone-100 bg-white px-3 py-2 text-xs text-stone-600"
                  >
                    <span className="font-medium text-stone-800">
                      {TILE_NAME_JA[h.discard as TileId] || h.discard}
                    </span>
                    <span className="mx-1 text-stone-300">·</span>
                    <span className="line-clamp-2">{h.explanation}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
  );

  if (embedded) {
    return (
      <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5 pb-24">
        {lessonBody}
      </div>
    );
  }

  if (mode === "practice") {
    return <PracticeApp onExit={() => setMode("lesson")} />;
  }

  return (
    <div className="mx-auto flex w-full max-w-lg flex-col gap-5 px-4 py-5 pb-24">
      <header className="text-center">
        <p className="text-xs font-medium tracking-widest text-amber-700">
          KIRU HAI COACH
        </p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">切る牌コーチ</h1>
        <p className="mt-1 text-sm text-stone-600">
          迷ったらタップ。Jevが切る牌と理由を教えます。
        </p>
      </header>

      <ModeTabs mode={mode} onChange={setMode} />

      {lessonBody}
    </div>
  );
}
