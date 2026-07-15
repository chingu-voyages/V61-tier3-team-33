-- Creds — password accounts, 1:1 with players
CREATE TABLE creds (
  pid        TEXT PRIMARY KEY REFERENCES players(pid) ON DELETE CASCADE,
  email      TEXT NOT NULL,
  hash       TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX creds_email_idx ON creds (lower(email));
