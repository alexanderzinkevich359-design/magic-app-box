-- Add category field to athlete_goals for skill/conditioning/mindset/coach_assigned grouping
ALTER TABLE public.athlete_goals
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'skill'
  CHECK (category IN ('skill', 'conditioning', 'mindset', 'coach_assigned'));
