-- Coach type: 'private' = individual/private training, 'team' = school/club/organized team
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS coach_type TEXT
  CHECK (coach_type IN ('private', 'team'));
