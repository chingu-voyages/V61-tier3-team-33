-- Players — identity root
CREATE TYPE player_role AS ENUM ('guest', 'member');
CREATE TYPE auth_provider AS ENUM ('guest', 'password', 'google');

CREATE TABLE players (
  id         BIGSERIAL PRIMARY KEY,
  pid        TEXT NOT NULL UNIQUE,
  username   TEXT NOT NULL,
  role       player_role NOT NULL,
  provider   auth_provider NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX players_username_idx
  ON players (lower(username)) WHERE provider <> 'guest';
