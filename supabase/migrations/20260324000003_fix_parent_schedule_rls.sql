-- Replace the parent schedule RLS policy with a simpler version that checks
-- coach_schedule.athlete_id directly against parent_athlete_links.
-- The old policy joined coach_athlete_links which could silently block parents.

DROP POLICY IF EXISTS "parent_view_athlete_schedule" ON public.coach_schedule;

CREATE POLICY "parent_view_athlete_schedule" ON public.coach_schedule
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_athlete_links pal
      WHERE pal.parent_user_id = auth.uid()
        AND pal.athlete_user_id = coach_schedule.athlete_id
    )
  );
