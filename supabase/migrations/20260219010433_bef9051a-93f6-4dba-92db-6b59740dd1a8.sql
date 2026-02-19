
-- Create team_invites table for coach-to-athlete invitations
CREATE TABLE public.team_invites (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_email TEXT NOT NULL,
  athlete_name TEXT NOT NULL,
  position TEXT,
  throw_hand TEXT,
  bat_hand TEXT,
  sport_id UUID REFERENCES public.sports(id),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  responded_at TIMESTAMP WITH TIME ZONE,
  UNIQUE (coach_id, athlete_email, status)
);

-- Enable RLS
ALTER TABLE public.team_invites ENABLE ROW LEVEL SECURITY;

-- Coaches can view and create their own invites
CREATE POLICY "Coaches can view their own invites"
ON public.team_invites FOR SELECT
TO authenticated
USING (coach_id = auth.uid());

CREATE POLICY "Coaches can create invites"
ON public.team_invites FOR INSERT
TO authenticated
WITH CHECK (coach_id = auth.uid());

CREATE POLICY "Coaches can update their own invites"
ON public.team_invites FOR UPDATE
TO authenticated
USING (coach_id = auth.uid());

-- Athletes can view invites sent to their email
CREATE POLICY "Athletes can view invites for their email"
ON public.team_invites FOR SELECT
TO authenticated
USING (
  athlete_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);

-- Athletes can update (accept/decline) invites sent to their email
CREATE POLICY "Athletes can respond to their invites"
ON public.team_invites FOR UPDATE
TO authenticated
USING (
  athlete_email = (SELECT email FROM auth.users WHERE id = auth.uid())
);
