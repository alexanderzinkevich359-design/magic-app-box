CREATE TABLE public.athlete_weekly_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_weekly_goals ENABLE ROW LEVEL SECURITY;

-- Athletes fully manage their own goals
CREATE POLICY "awg_athlete_all" ON public.athlete_weekly_goals
  FOR ALL TO authenticated
  USING (athlete_user_id = auth.uid())
  WITH CHECK (athlete_user_id = auth.uid());

-- Linked coaches can read only (no parents)
CREATE POLICY "awg_coach_read" ON public.athlete_weekly_goals
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_links cal
      WHERE cal.coach_user_id = auth.uid()
        AND cal.athlete_user_id = athlete_weekly_goals.athlete_user_id
    )
  );
