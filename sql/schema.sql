-- 切る牌コーチ Turso schema
-- Run: turso db shell kiru-hai-coach < sql/schema.sql
-- Or: npm run db:migrate

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS lesson_progress (
  player_id TEXT NOT NULL,
  lesson_id TEXT NOT NULL CHECK (lesson_id IN ('beginner', 'intermediate', 'advanced')),
  status TEXT NOT NULL CHECK (status IN ('locked', 'in_progress', 'cleared')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (player_id, lesson_id),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE TABLE IF NOT EXISTS consultations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  player_id TEXT NOT NULL,
  hand_json TEXT NOT NULL,
  discard TEXT NOT NULL,
  scores_json TEXT NOT NULL,
  explanation TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (player_id) REFERENCES players(id)
);

CREATE INDEX IF NOT EXISTS idx_consultations_player
  ON consultations(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lesson_progress_player
  ON lesson_progress(player_id);
