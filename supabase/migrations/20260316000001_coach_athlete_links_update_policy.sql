-- Add missing UPDATE policy on coach_athlete_links.
-- Without this, coaches cannot update position, throw_hand, bat_hand,
-- jersey_number, height, weight, school, etc. — all silently fail.

CREATE POLICY "Coaches can update own links"
  ON public.coach_athlete_links
  FOR UPDATE TO authenticated
  USING (coach_user_id = auth.uid())
  WITH CHECK (coach_user_id = auth.uid());
