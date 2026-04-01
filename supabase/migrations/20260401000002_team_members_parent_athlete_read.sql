-- Allow athletes to see which teams they are members of
CREATE POLICY "Athletes can view own team memberships"
  ON public.team_members
  FOR SELECT TO authenticated
  USING (athlete_user_id = auth.uid());

-- Allow parents to see team memberships for their linked athlete
CREATE POLICY "Parents can view linked athlete team memberships"
  ON public.team_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.parent_athlete_links pal
      WHERE pal.parent_user_id = auth.uid()
        AND pal.athlete_user_id = team_members.athlete_user_id
    )
  );
