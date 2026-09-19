import { NextRequest, NextResponse } from "next/server";
import { getDb, isTursoConfigured } from "@/lib/db";
import { PLAYER_COOKIE } from "@/lib/player";
import { isTileId } from "@/lib/tiles";

export const preferredRegion = 'hnd1';

export async function GET(req: NextRequest) {
  if (!isTursoConfigured()) {
    return NextResponse.json({ error: "Turso not configured", items: [] }, { status: 503 });
  }

  try {
    const url = new URL(req.url);
    const playerId =
      url.searchParams.get("player_id") ||
      req.cookies.get(PLAYER_COOKIE)?.value;

    if (!playerId) {
      return NextResponse.json({ items: [] });
    }

    const db = getDb();
    const limit = Math.min(
      Number(url.searchParams.get("limit") || 20) || 20,
      50
    );
    const rs = await db.execute({
      sql: `SELECT id, hand_json, discard, scores_json, explanation, created_at
            FROM consultations
            WHERE player_id = ?
            ORDER BY created_at DESC
            LIMIT ?`,
      args: [playerId, limit],
    });

    const items = rs.rows.map((row) => ({
      id: row.id,
      hand: JSON.parse(String(row.hand_json)),
      discard: row.discard,
      scores: JSON.parse(String(row.scores_json)),
      explanation: row.explanation,
      created_at: row.created_at,
    }));

    return NextResponse.json({ player_id: playerId, items });
  } catch (e) {
    console.error("GET /api/consultations", e);
    return NextResponse.json({ error: "Failed to load" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!isTursoConfigured()) {
    return NextResponse.json({ error: "Turso not configured" }, { status: 503 });
  }

  try {
    const body = await req.json();
    const playerId =
      (typeof body.player_id === "string" && body.player_id) ||
      req.cookies.get(PLAYER_COOKIE)?.value;

    if (!playerId) {
      return NextResponse.json({ error: "player_id required" }, { status: 400 });
    }

    const hand = body.hand;
    const discard = body.discard;
    const scores = body.scores;
    const explanation = body.explanation;

    if (!Array.isArray(hand) || hand.length !== 14) {
      return NextResponse.json({ error: "hand must be 14 tiles" }, { status: 400 });
    }
    if (typeof discard !== "string" || !isTileId(discard)) {
      return NextResponse.json({ error: "invalid discard" }, { status: 400 });
    }
    if (
      !scores ||
      typeof scores.efficiency !== "number" ||
      typeof scores.safety !== "number" ||
      typeof scores.wait !== "number"
    ) {
      return NextResponse.json(
        { error: "scores must be {efficiency,safety,wait}" },
        { status: 400 }
      );
    }
    if (typeof explanation !== "string") {
      return NextResponse.json({ error: "explanation required" }, { status: 400 });
    }

    const db = getDb();
    await db.execute({
      sql: "INSERT OR IGNORE INTO players (id) VALUES (?)",
      args: [playerId],
    });

    const scoresJson = JSON.stringify({
      efficiency: scores.efficiency,
      safety: scores.safety,
      wait: scores.wait,
    });

    const rs = await db.execute({
      sql: `INSERT INTO consultations (player_id, hand_json, discard, scores_json, explanation)
            VALUES (?, ?, ?, ?, ?)
            RETURNING id, created_at`,
      args: [playerId, JSON.stringify(hand), discard, scoresJson, explanation],
    });

    const row = rs.rows[0];
    return NextResponse.json({
      id: row?.id,
      player_id: playerId,
      created_at: row?.created_at,
    });
  } catch (e) {
    console.error("POST /api/consultations", e);
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }
}