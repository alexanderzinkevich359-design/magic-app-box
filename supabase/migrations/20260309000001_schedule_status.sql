-- Add status column to coach_schedule to support canceling sessions
-- without deleting them (so athletes see "Canceled" instead of sessions disappearing)
ALTER TABLE public.coach_schedule
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active'
  CHECK (status IN ('active', 'canceled'));
