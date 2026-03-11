-- Add game_stat_groups config to sports table
ALTER TABLE public.sports ADD COLUMN IF NOT EXISTS game_stat_groups JSONB NOT NULL DEFAULT '{}';

-- Game events (games, practices, scrimmages, tournaments)
CREATE TABLE IF NOT EXISTS public.game_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id     UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  team_id      UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  sport_id     UUID REFERENCES public.sports(id) ON DELETE SET NULL,
  event_type   TEXT NOT NULL CHECK (event_type IN ('game','practice','scrimmage','tournament')),
  event_date   DATE NOT NULL,
  opponent     TEXT,
  location     TEXT,
  result       TEXT CHECK (result IN ('W','L','T')),
  score_us     INT,
  score_them   INT,
  notes        TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_events_coach_id_idx ON public.game_events (coach_id);
CREATE INDEX IF NOT EXISTS game_events_event_date_idx ON public.game_events (event_date);

ALTER TABLE public.game_events ENABLE ROW LEVEL SECURITY;

-- Coach: full access to their own events
CREATE POLICY "ge_coach_all" ON public.game_events
  FOR ALL USING (coach_id = auth.uid()) WITH CHECK (coach_id = auth.uid());

-- NOTE: ge_athlete_select and ge_parent_select are created below,
-- after game_athlete_stats is defined (they reference that table).

-- Per-athlete per-event stats (flat key-value)
CREATE TABLE IF NOT EXISTS public.game_athlete_stats (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id    UUID REFERENCES public.game_events(id) ON DELETE CASCADE NOT NULL,
  athlete_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  stat_group  TEXT NOT NULL,
  stat_key    TEXT NOT NULL,
  value       NUMERIC NOT NULL,
  UNIQUE (event_id, athlete_id, stat_group, stat_key)
);

CREATE INDEX IF NOT EXISTS gas_event_id_idx    ON public.game_athlete_stats (event_id);
CREATE INDEX IF NOT EXISTS gas_athlete_id_idx  ON public.game_athlete_stats (athlete_id);

ALTER TABLE public.game_athlete_stats ENABLE ROW LEVEL SECURITY;

-- Coach: full access via parent event
CREATE POLICY "gas_coach_all" ON public.game_athlete_stats
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.game_events ge
      WHERE ge.id = event_id AND ge.coach_id = auth.uid()
    )
  ) WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.game_events ge
      WHERE ge.id = event_id AND ge.coach_id = auth.uid()
    )
  );

-- Athlete: read their own stats
CREATE POLICY "gas_athlete_select" ON public.game_athlete_stats
  FOR SELECT USING (athlete_id = auth.uid());

-- Parent: read stats for their linked athlete
CREATE POLICY "gas_parent_select" ON public.game_athlete_stats
  FOR SELECT USING (is_parent_of_athlete(auth.uid(), athlete_id));

-- Athlete: read events where they have a stat row
CREATE POLICY "ge_athlete_select" ON public.game_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.game_athlete_stats gas
      WHERE gas.event_id = id AND gas.athlete_id = auth.uid()
    )
  );

-- Parent: read events for their linked athlete
CREATE POLICY "ge_parent_select" ON public.game_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.game_athlete_stats gas
      WHERE gas.event_id = id
        AND is_parent_of_athlete(auth.uid(), gas.athlete_id)
    )
  );

-- ─── Seed game_stat_groups ───────────────────────────────────────────────────

UPDATE public.sports
SET game_stat_groups = '{
  "batting": [
    {"key":"ab",  "label":"AB",  "full":"At-Bats",       "sortOrder":1},
    {"key":"h",   "label":"H",   "full":"Hits",           "sortOrder":2},
    {"key":"bb",  "label":"BB",  "full":"Walks",          "sortOrder":3},
    {"key":"k",   "label":"K",   "full":"Strikeouts",     "sortOrder":4},
    {"key":"rbi", "label":"RBI", "full":"RBI",            "sortOrder":5},
    {"key":"r",   "label":"R",   "full":"Runs",           "sortOrder":6},
    {"key":"hr",  "label":"HR",  "full":"Home Runs",      "sortOrder":7},
    {"key":"sb",  "label":"SB",  "full":"Stolen Bases",   "sortOrder":8}
  ],
  "pitching": [
    {"key":"ip",  "label":"IP",  "full":"Innings Pitched","sortOrder":1,"positions":["Pitcher"]},
    {"key":"so",  "label":"SO",  "full":"Strikeouts",     "sortOrder":2,"positions":["Pitcher"]},
    {"key":"bb_p","label":"BB",  "full":"Walks",          "sortOrder":3,"positions":["Pitcher"]},
    {"key":"h_a", "label":"H",   "full":"Hits Allowed",   "sortOrder":4,"positions":["Pitcher"]},
    {"key":"er",  "label":"ER",  "full":"Earned Runs",    "sortOrder":5,"positions":["Pitcher"]}
  ],
  "fielding": [
    {"key":"po",  "label":"PO",  "full":"Putouts",        "sortOrder":1},
    {"key":"ast", "label":"A",   "full":"Assists",        "sortOrder":2},
    {"key":"e",   "label":"E",   "full":"Errors",         "sortOrder":3}
  ],
  "derived": [
    {"key":"avg", "label":"AVG", "formula":"h/ab",               "precision":3},
    {"key":"obp", "label":"OBP", "formula":"(h+bb)/(ab+bb)",     "precision":3},
    {"key":"era", "label":"ERA", "formula":"(er/ip)*9",          "precision":2}
  ]
}'::jsonb
WHERE slug = 'baseball';

UPDATE public.sports
SET game_stat_groups = '{
  "batting": [
    {"key":"ab",  "label":"AB",  "full":"At-Bats",       "sortOrder":1},
    {"key":"h",   "label":"H",   "full":"Hits",           "sortOrder":2},
    {"key":"bb",  "label":"BB",  "full":"Walks",          "sortOrder":3},
    {"key":"k",   "label":"K",   "full":"Strikeouts",     "sortOrder":4},
    {"key":"rbi", "label":"RBI", "full":"RBI",            "sortOrder":5},
    {"key":"r",   "label":"R",   "full":"Runs",           "sortOrder":6},
    {"key":"hr",  "label":"HR",  "full":"Home Runs",      "sortOrder":7},
    {"key":"sb",  "label":"SB",  "full":"Stolen Bases",   "sortOrder":8}
  ],
  "pitching": [
    {"key":"ip",  "label":"IP",  "full":"Innings Pitched","sortOrder":1,"positions":["Pitcher"]},
    {"key":"so",  "label":"SO",  "full":"Strikeouts",     "sortOrder":2,"positions":["Pitcher"]},
    {"key":"bb_p","label":"BB",  "full":"Walks",          "sortOrder":3,"positions":["Pitcher"]},
    {"key":"h_a", "label":"H",   "full":"Hits Allowed",   "sortOrder":4,"positions":["Pitcher"]},
    {"key":"er",  "label":"ER",  "full":"Earned Runs",    "sortOrder":5,"positions":["Pitcher"]}
  ],
  "fielding": [
    {"key":"po",  "label":"PO",  "full":"Putouts",        "sortOrder":1},
    {"key":"ast", "label":"A",   "full":"Assists",        "sortOrder":2},
    {"key":"e",   "label":"E",   "full":"Errors",         "sortOrder":3}
  ],
  "derived": [
    {"key":"avg", "label":"AVG", "formula":"h/ab",               "precision":3},
    {"key":"obp", "label":"OBP", "formula":"(h+bb)/(ab+bb)",     "precision":3},
    {"key":"era", "label":"ERA", "formula":"(er/ip)*9",          "precision":2}
  ]
}'::jsonb
WHERE slug = 'softball';

UPDATE public.sports
SET game_stat_groups = '{
  "match": [
    {"key":"sets_w",  "label":"Sets W",  "full":"Sets Won",          "sortOrder":1},
    {"key":"sets_l",  "label":"Sets L",  "full":"Sets Lost",         "sortOrder":2},
    {"key":"aces",    "label":"Aces",    "full":"Aces",              "sortOrder":3},
    {"key":"df",      "label":"DF",      "full":"Double Faults",     "sortOrder":4},
    {"key":"winners", "label":"Win",     "full":"Winners",           "sortOrder":5},
    {"key":"ue",      "label":"UE",      "full":"Unforced Errors",   "sortOrder":6}
  ],
  "derived": [
    {"key":"win_pct", "label":"Win%", "formula":"sets_w/(sets_w+sets_l)", "precision":3}
  ]
}'::jsonb
WHERE slug = 'tennis';

UPDATE public.sports
SET game_stat_groups = '{
  "attacking": [
    {"key":"kills",  "label":"K",    "full":"Kills",             "sortOrder":1},
    {"key":"att",    "label":"Att",  "full":"Attempts",          "sortOrder":2},
    {"key":"errors", "label":"E",    "full":"Attack Errors",     "sortOrder":3}
  ],
  "serving": [
    {"key":"aces",   "label":"Ace",  "full":"Service Aces",      "sortOrder":1},
    {"key":"svc_e",  "label":"SE",   "full":"Service Errors",    "sortOrder":2}
  ],
  "defense": [
    {"key":"digs",   "label":"Dig",  "full":"Digs",              "sortOrder":1},
    {"key":"blocks", "label":"Blk",  "full":"Block Solos+Assists","sortOrder":2},
    {"key":"ast",    "label":"Ast",  "full":"Assists",           "sortOrder":3}
  ],
  "derived": [
    {"key":"hit_pct", "label":"Hit%", "formula":"(kills-errors)/att", "precision":3}
  ]
}'::jsonb
WHERE slug = 'volleyball';
