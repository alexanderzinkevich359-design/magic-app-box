ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS hud_layout_preferences JSONB NOT NULL DEFAULT '{}';
