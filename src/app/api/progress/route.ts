import { NextRequest, NextResponse } from "next/server";
import { getDb, isTursoConfigured } from "@/lib/db";
import {
  defaultProgress,
  type LessonId,
  type LessonStatus,
} from "@/lib/lessons";
import { newPlayerId, PLAYER_COOKIE } from "@/lib/player";

const LESSON_IDS: LessonId[] = ["beginner", "intermediate", "advanced"];

function parseLessonId(v: unknown): LessonId | null {
  return LESSON_IDS.includes(v as LessonId) ? (v as LessonId) : null;
}

function parseStatus(v: unknown): LessonStatus | null {
  return v === "locked" || v === "in_progress" || v === "cleared"
    ? v
    : null;
}

async function ensurePlayer(playerId: string) {
  const db = getDb();
  await db.execute({
    sql: "INSERT OR IGNORE INTO players (id) VALUES (?)",
    args: [playerId],
  });
}

async function seedDefaultProgress(playerId: string) {
  const db = getDb();
  const defaults = defaultProgress();
  for (const id of LESSON_IDS) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO lesson_progress (player_id, lesson_id, status)
            VALUES (?, ?, ?)`,
      args: [playerId, id, defaults[id]],
    });
  }
}

async function loadProgress(playerId: string) {
  const db = getDb();
  const rs = await db.execute({
    sql: `SELECT lesson_id, status, updated_at FROM lesson_progress
          WHERE player_id = ?`,
    args: [playerId],
  });

  const progress = defaultProgress();
  for (const row of rs.rows) {
    const lid = parseLessonId(row.lesson_id);
    const st = parseStatus(row.status);
    if (lid && st) progress[lid] = st;
  }
  return progress;
}

function withPlayerCookie(res: NextResponse, playerId: string) {
  res.cookies.set(PLAYER_COOKIE, playerId, {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return res;
}

export async function GET(req: NextRequest) {
  if (!isTursoConfigured()) {
    return NextResponse.json(
      { error: "Turso not configured", progress: defaultProgress() },
      { status: 503 }
    );
  }

  try {
    const url = new URL(req.url);
    const playerId =
      url.searchParams.get("player_id") ||
      req.cookies.get(PLAYER_COOKIE)?.value ||
      null;

    if (!playerId) {
      return NextResponse.json({
        player_id: null,
        progress: defaultProgress(),
      });
    }

    await ensurePlayer(playerId);
    await seedDefaultProgress(playerId);
    const progress = await loadProgress(playerId);
    return withPlayerCookie(
      NextResponse.json({ player_id: playerId, progress }),
      playerId
    );
  } catch (e) {
    console.error("GET /api/progress", e);
    return NextResponse.json(
      { error: "Failed to load progress" },
      { status: 500 }
    );
  }
}

export async function PUT(req: NextRequest) {
  if (!isTursoConfigured()) {
    return NextResponse.json({ error: "Turso not configured" }, { status: 503 });
  }

  try {
    const body = await req.json().catch(() => ({}));
    const playerId: string =
      (typeof body.player_id === "string" && body.player_id) ||
      req.cookies.get(PLAYER_COOKIE)?.value ||
      newPlayerId();

    await ensurePlayer(playerId);
    await seedDefaultProgress(playerId);

    const lessonId = parseLessonId(body.lesson_id);
    const status = parseStatus(body.status);

    if (lessonId && status) {
      const db = getDb();
      await db.execute({
        sql: `INSERT INTO lesson_progress (player_id, lesson_id, status, updated_at)
              VALUES (?, ?, ?, datetime('now'))
              ON CONFLICT(player_id, lesson_id) DO UPDATE SET
                status = excluded.status,
                updated_at = datetime('now')`,
        args: [playerId, lessonId, status],
      });

      // Unlock next lesson when clearing
      if (status === "cleared") {
        const next =
          lessonId === "beginner"
            ? "intermediate"
            : lessonId === "intermediate"
              ? "advanced"
              : null;
        if (next) {
          await db.execute({
            sql: `INSERT INTO lesson_progress (player_id, lesson_id, status, updated_at)
                  VALUES (?, ?, 'in_progress', datetime('now'))
                  ON CONFLICT(player_id, lesson_id) DO UPDATE SET
                    status = CASE
                      WHEN lesson_progress.status = 'locked' THEN 'in_progress'
                      ELSE lesson_progress.status
                    END,
                    updated_at = datetime('now')`,
            args: [playerId, next],
          });
        }
      }
    }

    const progress = await loadProgress(playerId);
    return withPlayerCookie(
      NextResponse.json({ player_id: playerId, progress }),
      playerId
    );
  } catch (e) {
    console.error("PUT /api/progress", e);
    return NextResponse.json(
      { error: "Failed to save progress" },
      { status: 500 }
    );
  }
}
