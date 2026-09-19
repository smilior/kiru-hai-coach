"use client";

import { formatPct, type Scores } from "@/lib/explanation";

type Props = {
  scores: Scores;
  /** Kept for call-site compatibility; all three scores always display. */
  difficulty?: string;
  /** Practice overlay sits on dark felt — use light labels. */
  variant?: "default" | "onDark";
};

const ITEMS: { key: keyof Scores; label: string }[] = [
  { key: "efficiency", label: "効率" },
  { key: "safety", label: "安全" },
  { key: "wait", label: "待ち" },
];

export function ScoreBars({ scores, variant = "default" }: Props) {
  const labelCls =
    variant === "onDark"
      ? "mb-0.5 flex justify-between text-xs text-white/90"
      : "mb-0.5 flex justify-between text-xs text-stone-600";
  const trackCls =
    variant === "onDark"
      ? "h-2 overflow-hidden rounded-full bg-white/20"
      : "h-2 overflow-hidden rounded-full bg-stone-200";
  return (
    <div className="space-y-2">
      {ITEMS.map((i) => {
        const pct = Number(formatPct(scores[i.key] ?? 0));
        return (
          <div key={i.key}>
            <div className={labelCls}>
              <span>{i.label}</span>
              <span className="font-mono">{pct}</span>
            </div>
            <div className={trackCls}>
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
