-- OAuth — google (and future provider) accounts, 1:1 with players
CREATE TABLE oauth (
  pid        TEXT PRIMARY KEY REFERENCES players(pid) ON DELETE CASCADE,
  provider   TEXT NOT NULL,
  sub        TEXT NOT NULL,
  email      TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (provider, sub)
);
