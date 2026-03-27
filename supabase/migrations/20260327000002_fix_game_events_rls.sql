-- Fix infinite recursion in game_events RLS.
-- ge_athlete_select and ge_parent_select previously queried game_athlete_stats,
-- whose gas_coach_all policy queries back into game_events — circular reference.
-- Replace with direct lookups through the link tables.

DROP POLICY IF EXISTS "ge_athlete_select" ON public.game_events;
DROP POLICY IF EXISTS "ge_parent_select"  ON public.game_events;

-- Athletes see events from coaches they are linked to
CREATE POLICY "ge_athlete_select" ON public.game_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_athlete_links cal
      WHERE cal.coach_user_id   = game_events.coach_id
        AND cal.athlete_user_id = auth.uid()
    )
  );

-- Parents see events from the coach linked to their athlete
CREATE POLICY "ge_parent_select" ON public.game_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.parent_athlete_links pal
      JOIN  public.coach_athlete_links cal
        ON  cal.athlete_user_id = pal.athlete_user_id
      WHERE pal.parent_user_id  = auth.uid()
        AND cal.coach_user_id   = game_events.coach_id
    )
  );
