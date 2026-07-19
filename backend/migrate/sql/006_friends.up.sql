-- FRIENDS — symmetric relation, canonical ordering avoids dupes
CREATE TYPE friend_status AS ENUM ('pending', 'accepted', 'blocked');

CREATE TABLE friends (
  id           BIGSERIAL PRIMARY KEY,
  pid_a        TEXT NOT NULL REFERENCES players(pid) ON DELETE CASCADE,
  pid_b        TEXT NOT NULL REFERENCES players(pid) ON DELETE CASCADE,
  status       friend_status NOT NULL DEFAULT 'pending',
  requested_by TEXT NOT NULL REFERENCES players(pid),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  CHECK (pid_a < pid_b),
  UNIQUE (pid_a, pid_b)
);

CREATE INDEX friends_a_idx ON friends (pid_a);
CREATE INDEX friends_b_idx ON friends (pid_b);
CREATE INDEX friends_requested_by_idx ON friends (requested_by);

CREATE OR REPLACE FUNCTION friends_normalize_order()
RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  tmp TEXT;
BEGIN
  IF NEW.pid_a > NEW.pid_b THEN
    tmp := NEW.pid_a;
    NEW.pid_a := NEW.pid_b;
    NEW.pid_b := tmp;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER friends_normalize_order_trigger
BEFORE INSERT ON friends
FOR EACH ROW EXECUTE FUNCTION friends_normalize_order();
