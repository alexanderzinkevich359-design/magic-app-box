ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS game_highlight_stats JSONB NOT NULL DEFAULT '{}';
