-- Coach-managed teams with athlete roster
CREATE TABLE public.teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  sport TEXT,
  season TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE public.team_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  athlete_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  UNIQUE(team_id, athlete_user_id)
);

-- RLS for teams: coaches manage their own
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage own teams"
  ON public.teams
  FOR ALL
  TO authenticated
  USING (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- RLS for team_members: coaches manage via team ownership
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches manage team members"
  ON public.team_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = team_members.team_id
        AND teams.coach_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.teams
      WHERE teams.id = team_members.team_id
        AND teams.coach_id = auth.uid()
    )
  );
