-- Add team_id to coach_schedule so sessions for different teams with the
-- same title/time/color are stored and displayed independently.

ALTER TABLE public.coach_schedule
  ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS coach_schedule_team_id_idx ON public.coach_schedule (team_id);

-- Backfill: assign team_id from team_members for existing rows.
-- If an athlete is on multiple teams under the same coach, pick the first match.
UPDATE public.coach_schedule cs
SET team_id = (
  SELECT tm.team_id
  FROM public.team_members tm
  JOIN public.teams t ON t.id = tm.team_id
  WHERE tm.athlete_user_id = cs.athlete_id
    AND t.coach_id = cs.coach_id
  ORDER BY t.created_at
  LIMIT 1
)
WHERE cs.team_id IS NULL;
