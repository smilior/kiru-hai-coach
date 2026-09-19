export type LessonId = "beginner" | "intermediate" | "advanced";
export type LessonStatus = "locked" | "in_progress" | "cleared";

export type Difficulty = LessonId;

export const LESSONS: {
  id: LessonId;
  title: string;
  subtitle: string;
  focus: string;
  tips: string[];
}[] = [
  {
    id: "beginner",
    title: "初級",
    subtitle: "効率を優先して切る",
    focus: "受け入れ（イーシャンテン・テンパイまでのスピード）を最優先。",
    tips: [
      "孤立した字牌や端牌から切ると形が整いやすいです。",
      "搭子（ターツ）を崩さないことを意識しましょう。",
      "まずは「何が来たら進むか」を数えてみます。",
    ],
  },
  {
    id: "intermediate",
    title: "中級",
    subtitle: "効率と安全のバランス",
    focus: "効率に加え、他家への危険度（安全度）も見ます。",
    tips: [
      "序盤は効率、中盤以降は安全も意識します。",
      "現物・筋・壁をざっくり頭に置きます。",
      "押しすぎず、降りすぎないバランスが目標です。",
    ],
  },
  {
    id: "advanced",
    title: "上級",
    subtitle: "押し引きと待ちの質",
    focus: "効率・安全に加え、待ちの広さ・良さ・押し引きを総合判断。",
    tips: [
      "良形テンパイと愚形の価値差を意識します。",
      "点数状況・親か子かで押し引きが変わります（V1は簡略）。",
      "1枚の切り方で待ちの質が大きく変わることがあります。",
    ],
  },
];

export function defaultProgress(): Record<LessonId, LessonStatus> {
  return {
    beginner: "in_progress",
    intermediate: "locked",
    advanced: "locked",
  };
}

export function nextLesson(id: LessonId): LessonId | null {
  if (id === "beginner") return "intermediate";
  if (id === "intermediate") return "advanced";
  return null;
}
