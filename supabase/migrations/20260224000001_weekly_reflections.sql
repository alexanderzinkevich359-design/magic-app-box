-- Weekly reflection journal for athletes, with optional coach comment
CREATE TABLE public.weekly_reflections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  what_went_well TEXT,
  needs_improvement TEXT,
  self_rating INT CHECK (self_rating BETWEEN 1 AND 10),
  coach_comment TEXT,
  commented_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, week_start)
);

ALTER TABLE public.weekly_reflections ENABLE ROW LEVEL SECURITY;

-- Athlete: full control over own reflections
CREATE POLICY "Athletes manage own reflections"
  ON public.weekly_reflections
  FOR ALL
  TO authenticated
  USING (athlete_id = auth.uid())
  WITH CHECK (athlete_id = auth.uid());

-- Coach: SELECT for linked athletes
CREATE POLICY "Coaches read linked athlete reflections"
  ON public.weekly_reflections
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_links
      WHERE coach_athlete_links.coach_user_id = auth.uid()
        AND coach_athlete_links.athlete_user_id = weekly_reflections.athlete_id
    )
  );

-- Coach: UPDATE to add comment on linked athletes
CREATE POLICY "Coaches comment on reflections"
  ON public.weekly_reflections
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_links
      WHERE coach_athlete_links.coach_user_id = auth.uid()
        AND coach_athlete_links.athlete_user_id = weekly_reflections.athlete_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_links
      WHERE coach_athlete_links.coach_user_id = auth.uid()
        AND coach_athlete_links.athlete_user_id = weekly_reflections.athlete_id
    )
  );

-- Auto-update updated_at on row change
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER weekly_reflections_updated_at
  BEFORE UPDATE ON public.weekly_reflections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
