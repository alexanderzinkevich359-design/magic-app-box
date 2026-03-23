-- Allow parents to view coach_schedule entries for their linked athlete's coach
CREATE POLICY "parent_view_athlete_schedule" ON public.coach_schedule
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.parent_athlete_links pal
      JOIN public.coach_athlete_links cal
        ON cal.athlete_user_id = pal.athlete_user_id
      WHERE pal.parent_user_id = auth.uid()
        AND cal.coach_user_id = coach_schedule.coach_id
    )
  );
