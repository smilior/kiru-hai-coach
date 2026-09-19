"use client";

import { LESSONS, type LessonId, type LessonStatus } from "@/lib/lessons";

type Props = {
  progress: Record<LessonId, LessonStatus>;
  current: LessonId;
  onSelect: (id: LessonId) => void;
};

const STATUS_LABEL: Record<LessonStatus, string> = {
  locked: "ロック",
  in_progress: "学習中",
  cleared: "クリア",
};

export function LessonPath({ progress, current, onSelect }: Props) {
  return (
    <section className="w-full">
      <h2 className="mb-2 text-sm font-semibold text-stone-600">レッスン進路</h2>
      <ol className="flex gap-2 overflow-x-auto pb-1">
        {LESSONS.map((lesson, i) => {
          const status = progress[lesson.id];
          const locked = status === "locked";
          const active = current === lesson.id;
          return (
            <li key={lesson.id} className="min-w-[9.5rem] flex-1">
              <button
                type="button"
                disabled={locked}
                onClick={() => onSelect(lesson.id)}
                className={[
                  "w-full rounded-xl border px-3 py-2.5 text-left transition",
                  active
                    ? "border-amber-500 bg-amber-50 shadow-sm"
                    : "border-stone-200 bg-white",
                  locked ? "opacity-50 cursor-not-allowed" : "hover:border-amber-300",
                ].join(" ")}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-xs text-stone-500">
                    {i + 1}. {lesson.title}
                  </span>
                  <span
                    className={[
                      "rounded-full px-1.5 py-0.5 text-[10px] font-medium",
                      status === "cleared"
                        ? "bg-emerald-100 text-emerald-700"
                        : status === "in_progress"
                          ? "bg-sky-100 text-sky-700"
                          : "bg-stone-100 text-stone-500",
                    ].join(" ")}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <p className="mt-1 text-sm font-medium text-stone-800 leading-tight">
                  {lesson.subtitle}
                </p>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
