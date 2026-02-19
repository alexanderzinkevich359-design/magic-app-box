
-- Add throw_hand and bat_hand to coach_athlete_links
ALTER TABLE public.coach_athlete_links
  ADD COLUMN IF NOT EXISTS throw_hand text,
  ADD COLUMN IF NOT EXISTS bat_hand text;

-- Allow coaches to update their own links (needed for hand dominance)
CREATE POLICY "Coaches can update own links"
  ON public.coach_athlete_links
  FOR UPDATE
  USING (coach_user_id = auth.uid());

-- Table for tracking which drills an athlete has completed (checklist)
CREATE TABLE public.athlete_drill_completions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id uuid NOT NULL,
  drill_id uuid NOT NULL REFERENCES public.drills(id) ON DELETE CASCADE,
  program_id uuid NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  completed_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(athlete_id, drill_id)
);

ALTER TABLE public.athlete_drill_completions ENABLE ROW LEVEL SECURITY;

-- Athletes can view their own completions
CREATE POLICY "Athletes view own completions"
  ON public.athlete_drill_completions
  FOR SELECT
  USING (athlete_id = auth.uid());

-- Athletes can insert their own completions
CREATE POLICY "Athletes insert own completions"
  ON public.athlete_drill_completions
  FOR INSERT
  WITH CHECK (athlete_id = auth.uid());

-- Athletes can delete own completions (uncheck)
CREATE POLICY "Athletes delete own completions"
  ON public.athlete_drill_completions
  FOR DELETE
  USING (athlete_id = auth.uid());

-- Coaches can view completions for their athletes
CREATE POLICY "Coaches view athlete completions"
  ON public.athlete_drill_completions
  FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.coach_athlete_links
    WHERE coach_user_id = auth.uid() AND athlete_user_id = athlete_drill_completions.athlete_id
  ));
