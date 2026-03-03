-- Athlete-logged game records with batting & pitching stats
CREATE TABLE IF NOT EXISTS public.athlete_games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  game_date DATE NOT NULL,
  opponent TEXT NOT NULL,
  result TEXT CHECK (result IN ('W', 'L', 'T')),
  score_us INT,
  score_them INT,
  -- Batting stats
  at_bats INT,
  hits INT,
  rbis INT,
  runs INT,
  walks INT,
  strikeouts_batting INT,
  home_runs INT,
  -- Pitching stats (optional)
  innings_pitched NUMERIC(4,1),
  strikeouts_pitching INT,
  walks_pitching INT,
  earned_runs INT,
  -- General
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_games ENABLE ROW LEVEL SECURITY;

-- Athlete can fully manage their own games
CREATE POLICY "Athletes manage own games" ON public.athlete_games
  FOR ALL TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Coaches can view their linked athletes' games
CREATE POLICY "Coaches view linked athlete games" ON public.athlete_games
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_links
      WHERE coach_athlete_links.athlete_user_id = athlete_games.athlete_id
        AND coach_athlete_links.coach_user_id = auth.uid()
    )
  );
