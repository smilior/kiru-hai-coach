"use client";

import { formatPct, type Scores } from "@/lib/explanation";
import type { Difficulty } from "@/lib/lessons";

type Props = {
  scores: Scores;
  difficulty: Difficulty;
};

export function ScoreBars({ scores, difficulty }: Props) {
  const items: { key: keyof Scores; label: string; show: boolean }[] = [
    { key: "efficiency", label: "効率", show: true },
    {
      key: "safety",
      label: "安全",
      show: difficulty !== "beginner",
    },
    {
      key: "wait",
      label: "待ち",
      show: difficulty === "advanced",
    },
  ];

  return (
    <div className="space-y-2">
      {items
        .filter((i) => i.show)
        .map((i) => {
          const pct = Number(formatPct(scores[i.key]));
          return (
            <div key={i.key}>
              <div className="mb-0.5 flex justify-between text-xs text-stone-600">
                <span>{i.label}</span>
                <span className="font-mono">{pct}</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-stone-200">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-amber-400 to-emerald-500 transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
    </div>
  );
}
