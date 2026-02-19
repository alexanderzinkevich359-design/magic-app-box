-- Drop the problematic policies that reference auth.users
DROP POLICY IF EXISTS "Athletes can view invites for their email" ON public.team_invites;
DROP POLICY IF EXISTS "Athletes can respond to their invites" ON public.team_invites;

-- Recreate coach view policy (no change needed, it uses coach_id = auth.uid())
-- The coach policies don't reference auth.users, so they should work.
-- Let's check: the "Coaches can view their own invites" policy uses coach_id = auth.uid() which is fine.

-- Recreate athlete policies using auth.jwt() instead of querying auth.users
CREATE POLICY "Athletes can view invites for their email"
ON public.team_invites
FOR SELECT
USING (lower(athlete_email) = lower((auth.jwt() ->> 'email')::text));

CREATE POLICY "Athletes can respond to their invites"
ON public.team_invites
FOR UPDATE
USING (lower(athlete_email) = lower((auth.jwt() ->> 'email')::text));
