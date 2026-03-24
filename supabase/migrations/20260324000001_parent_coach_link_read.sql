-- Allow parents to read coach_athlete_links for their linked athlete
-- Without this, parents can't resolve the coach_id needed to fetch the schedule
CREATE POLICY "Parents can view athlete coach links" ON public.coach_athlete_links
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_athlete_links pal
      WHERE pal.parent_user_id = auth.uid()
        AND pal.athlete_user_id = coach_athlete_links.athlete_user_id
    )
  );
