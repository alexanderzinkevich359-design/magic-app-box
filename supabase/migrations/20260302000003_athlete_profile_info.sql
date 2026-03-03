-- Athlete profile context fields
-- Stored on coach_athlete_links so coaches can manage them (RLS: coach owns the row)
ALTER TABLE public.coach_athlete_links
  ADD COLUMN IF NOT EXISTS jersey_number TEXT,
  ADD COLUMN IF NOT EXISTS height        TEXT,
  ADD COLUMN IF NOT EXISTS weight_lbs    SMALLINT,
  ADD COLUMN IF NOT EXISTS school        TEXT,
  ADD COLUMN IF NOT EXISTS grad_year     SMALLINT,
  ADD COLUMN IF NOT EXISTS hometown      TEXT,
  ADD COLUMN IF NOT EXISTS bio           TEXT,
  ADD COLUMN IF NOT EXISTS fun_facts     TEXT;
