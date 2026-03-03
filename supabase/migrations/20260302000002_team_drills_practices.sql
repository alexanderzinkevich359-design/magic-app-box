-- Team Coach: Drill Library + Practice Planner
-- Creates coach_drills, team_practices, and practice_blocks tables.

-- ─── 1. coach_drills — reusable drill library per coach ───────────────────────
CREATE TABLE IF NOT EXISTS public.coach_drills (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name          TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'skill'
                CHECK (category IN ('warmup','skill','conditioning','scrimmage','cooldown','other')),
  duration_min  INTEGER,
  description   TEXT,
  coaching_cues TEXT,
  equipment     TEXT,
  rep_scheme    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_drills ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "coach_drills_owner" ON public.coach_drills;
CREATE POLICY "coach_drills_owner" ON public.coach_drills
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ─── 2. team_practices — one practice session per date per coach ──────────────
CREATE TABLE IF NOT EXISTS public.team_practices (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  practice_date DATE NOT NULL,
  title         TEXT NOT NULL DEFAULT 'Practice',
  duration_min  INTEGER DEFAULT 90,
  notes         TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.team_practices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "team_practices_owner" ON public.team_practices;
CREATE POLICY "team_practices_owner" ON public.team_practices
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ─── 3. practice_blocks — ordered segments within a practice ─────────────────
CREATE TABLE IF NOT EXISTS public.practice_blocks (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  practice_id  UUID REFERENCES public.team_practices(id) ON DELETE CASCADE NOT NULL,
  drill_id     UUID REFERENCES public.coach_drills(id) ON DELETE SET NULL,
  title        TEXT NOT NULL,
  block_type   TEXT NOT NULL DEFAULT 'skill'
               CHECK (block_type IN ('warmup','skill','conditioning','scrimmage','cooldown','other')),
  duration_min INTEGER,
  notes        TEXT,
  order_index  INTEGER NOT NULL DEFAULT 0
);

ALTER TABLE public.practice_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "practice_blocks_owner" ON public.practice_blocks;
CREATE POLICY "practice_blocks_owner" ON public.practice_blocks
  FOR ALL
  USING (
    practice_id IN (
      SELECT id FROM public.team_practices WHERE coach_id = auth.uid()
    )
  )
  WITH CHECK (
    practice_id IN (
      SELECT id FROM public.team_practices WHERE coach_id = auth.uid()
    )
  );
