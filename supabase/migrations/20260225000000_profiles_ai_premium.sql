-- AI Premium add-on flag per coach profile
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS ai_premium BOOLEAN NOT NULL DEFAULT FALSE;
