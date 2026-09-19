import { CoachApp } from "@/components/CoachApp";

export default function Home() {
  return (
    <main className="flex-1">
      <CoachApp />
      <footer className="px-4 pb-8 text-center text-[11px] text-stone-400">
        牌画像: FluffyStuff / riichi-mahjong-tiles（CC0 / Public Domain）
        <br />
        V1.5: レッスンコーチ ＋ 実戦練習（東家卓UI・CPU3・簡易ルール）
      </footer>
    </main>
  );
}
