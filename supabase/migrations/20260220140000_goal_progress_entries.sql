-- Add measurability flag to athlete_goals
ALTER TABLE public.athlete_goals
  ADD COLUMN IF NOT EXISTS is_measurable BOOLEAN NOT NULL DEFAULT true;

-- Time-series progress entries for measurable goals (used to draw tracking chart)
CREATE TABLE IF NOT EXISTS public.goal_progress_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  goal_id UUID REFERENCES public.athlete_goals(id) ON DELETE CASCADE NOT NULL,
  value NUMERIC NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.goal_progress_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Goal entries viewable by involved" ON public.goal_progress_entries
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_goals g
      WHERE g.id = goal_progress_entries.goal_id
        AND (g.athlete_id = auth.uid() OR g.coach_id = auth.uid())
    )
  );

CREATE POLICY "Coaches insert goal progress entries" ON public.goal_progress_entries
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.athlete_goals g
      WHERE g.id = goal_progress_entries.goal_id
        AND g.coach_id = auth.uid()
    )
  );
