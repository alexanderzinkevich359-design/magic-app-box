ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS time_format TEXT NOT NULL DEFAULT '12h'
    CHECK (time_format IN ('12h', '24h'));
