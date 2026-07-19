-- Tokens — 30-day auth bearer tokens, 1:N with players
CREATE TABLE tokens (
  token      TEXT PRIMARY KEY,
  pid        TEXT NOT NULL REFERENCES players(pid) ON DELETE CASCADE,
  issued_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX tokens_pid_idx ON tokens (pid);
