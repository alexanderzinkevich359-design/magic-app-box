-- Allow athletes to insert their own coach_athlete_link when accepting an invite.
-- The athlete must be inserting a row where they are the athlete (athlete_user_id = auth.uid())
-- and a valid pending invite exists from that coach to the athlete's email.
CREATE POLICY "Athletes can accept invites" ON public.coach_athlete_links
  FOR INSERT TO authenticated
  WITH CHECK (
    athlete_user_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.team_invites
      WHERE team_invites.coach_id = coach_athlete_links.coach_user_id
        AND team_invites.athlete_email = auth.email()
        AND team_invites.status = 'pending'
    )
  );
