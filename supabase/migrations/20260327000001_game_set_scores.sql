-- Add per-set score tracking for set-based sports (volleyball, tennis)
ALTER TABLE public.game_events
  ADD COLUMN IF NOT EXISTS set_scores JSONB;

-- Mark volleyball as a set-based sport
UPDATE public.sports
  SET session_config = session_config || '{"hasSets": true, "maxSets": 5}'::jsonb
  WHERE slug = 'volleyball';

-- Mark tennis as a set-based sport (best of 3 default; coaches can enter more)
UPDATE public.sports
  SET session_config = session_config || '{"hasSets": true, "maxSets": 5}'::jsonb
  WHERE slug = 'tennis';
