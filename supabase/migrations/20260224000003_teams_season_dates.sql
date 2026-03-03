-- Add season date range to teams so the app can detect in-season vs off-season
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS season_start DATE,
  ADD COLUMN IF NOT EXISTS season_end DATE;
