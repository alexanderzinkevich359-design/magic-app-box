-- Allow parents to see schedule sessions for any team their linked athlete is a member of.
-- Previously only sessions with athlete_id directly matching were visible.

DROP POLICY IF EXISTS "parent_view_athlete_schedule" ON public.coach_schedule;

CREATE POLICY "parent_view_athlete_schedule" ON public.coach_schedule
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_athlete_links pal
      WHERE pal.parent_user_id = auth.uid()
        AND (
          -- Direct athlete assignment
          pal.athlete_user_id = coach_schedule.athlete_id
          OR
          -- Team-based: athlete is a member of the session's team
          (coach_schedule.team_id IS NOT NULL AND EXISTS (
            SELECT 1 FROM public.team_members tm
            WHERE tm.team_id = coach_schedule.team_id
              AND tm.athlete_user_id = pal.athlete_user_id
          ))
        )
    )
  );
