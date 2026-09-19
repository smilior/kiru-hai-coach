import { NextRequest, NextResponse } from "next/server";
import { evaluateDiscard } from "@/lib/coach";
import { isTileId, type TileId } from "@/lib/tiles";
import type { Difficulty } from "@/lib/lessons";

const DIFFS: Difficulty[] = ["beginner", "intermediate", "advanced"];

export async function POST(req: NextRequest) {
  try {
    // AI Gateway auth: AI_GATEWAY_API_KEY or Vercel OIDC (automatic on Vercel)
    const body = await req.json();
    const handRaw = body.hand;
    const difficulty: Difficulty = DIFFS.includes(body.difficulty)
      ? body.difficulty
      : "beginner";
    const riverRaw = Array.isArray(body.river) ? body.river : [];

    if (!Array.isArray(handRaw) || handRaw.length !== 14) {
      return NextResponse.json(
        { error: "hand must be an array of 14 tile ids" },
        { status: 400 }
      );
    }

    const hand: TileId[] = [];
    for (const t of handRaw) {
      if (typeof t !== "string" || !isTileId(t)) {
        return NextResponse.json({ error: `invalid tile: ${t}` }, { status: 400 });
      }
      hand.push(t);
    }

    const river: TileId[] = [];
    for (const t of riverRaw) {
      if (typeof t === "string" && isTileId(t)) river.push(t);
    }

    const result = await evaluateDiscard(hand, difficulty, river);

    return NextResponse.json({
      discard: result.discard,
      scores: result.scores,
      explanation: result.explanation,
    });
  } catch (e) {
    console.error("POST /api/coach", e);
    const message = e instanceof Error ? e.message : "Coach evaluation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
