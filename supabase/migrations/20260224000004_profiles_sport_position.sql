-- Add sport position to athlete profiles (e.g. Pitcher, Catcher, Outfielder, Guard, Forward)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sport_position TEXT;
