"use client";

export type AppMode = "lesson" | "practice";

type Props = {
  mode: AppMode;
  onChange: (mode: AppMode) => void;
};

export function ModeTabs({ mode, onChange }: Props) {
  return (
    <div
      role="tablist"
      aria-label="モード切替"
      className="flex rounded-2xl border border-stone-200 bg-stone-200/60 p-1"
    >
      <button
        type="button"
        role="tab"
        aria-selected={mode === "lesson"}
        onClick={() => onChange("lesson")}
        className={[
          "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
          mode === "lesson"
            ? "bg-white text-stone-900 shadow-sm"
            : "text-stone-600 active:bg-white/50",
        ].join(" ")}
      >
        レッスンコーチ
      </button>
      <button
        type="button"
        role="tab"
        aria-selected={mode === "practice"}
        onClick={() => onChange("practice")}
        className={[
          "flex-1 rounded-xl py-2.5 text-sm font-semibold transition",
          mode === "practice"
            ? "bg-white text-stone-900 shadow-sm"
            : "text-stone-600 active:bg-white/50",
        ].join(" ")}
      >
        実戦練習
      </button>
    </div>
  );
}
