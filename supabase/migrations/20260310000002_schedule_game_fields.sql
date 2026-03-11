-- Add game-specific fields to coach_schedule
ALTER TABLE public.coach_schedule
  ADD COLUMN IF NOT EXISTS session_type TEXT NOT NULL DEFAULT 'regular',
  ADD COLUMN IF NOT EXISTS game_opponent TEXT,
  ADD COLUMN IF NOT EXISTS game_location TEXT,
  ADD COLUMN IF NOT EXISTS game_home_away TEXT;
