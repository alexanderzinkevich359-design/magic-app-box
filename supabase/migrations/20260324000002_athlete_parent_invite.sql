-- Allow athletes to create parent invites for themselves.
-- coach_id is resolved by the frontend from coach_athlete_links.
CREATE POLICY "Athletes can insert parent invites" ON public.parent_invites
  FOR INSERT TO authenticated
  WITH CHECK (athlete_user_id = auth.uid());
