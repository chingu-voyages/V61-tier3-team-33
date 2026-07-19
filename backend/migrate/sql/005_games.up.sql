-- Games — finished game history, written once at game-end
CREATE TABLE games (
  id          BIGSERIAL PRIMARY KEY,
  gid         TEXT NOT NULL UNIQUE,       -- runtime Game.id
  white       TEXT REFERENCES players(pid) ON DELETE SET NULL,
  black       TEXT REFERENCES players(pid) ON DELETE SET NULL,
  mode        TEXT NOT NULL,
  clock       TEXT NOT NULL,
  result      TEXT NOT NULL,
  winner      TEXT,
  end_reason  TEXT NOT NULL,
  moves       JSONB NOT NULL,             -- [{ san, from, to, promoteTo, captured, fen }, ...]
  created_at  TIMESTAMPTZ NOT NULL,
  finished_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX games_white_idx ON games (white);
CREATE INDEX games_black_idx ON games (black);
