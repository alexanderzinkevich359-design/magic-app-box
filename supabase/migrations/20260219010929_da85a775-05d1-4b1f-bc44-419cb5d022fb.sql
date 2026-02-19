-- Allow coaches to delete their own invites
CREATE POLICY "Coaches can delete their own invites"
ON public.team_invites
FOR DELETE
USING (coach_id = auth.uid());
