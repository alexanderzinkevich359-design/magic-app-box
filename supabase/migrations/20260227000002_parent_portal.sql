-- Parent Portal Migration
-- Creates parent_invites, parent_support_questions tables,
-- adds visible_to_parent to coach_notes,
-- tightens parent_athlete_links RLS.

-- ─── 1. parent_invites ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_invites (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id         UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_name      TEXT NOT NULL,
  parent_email     TEXT NOT NULL,
  token            TEXT UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  status           TEXT NOT NULL DEFAULT 'pending'
                   CHECK (status IN ('pending','accepted','expired')),
  expires_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.parent_invites ENABLE ROW LEVEL SECURITY;

-- Coaches fully manage their own invites
DROP POLICY IF EXISTS "coach_parent_invites_all" ON public.parent_invites;
CREATE POLICY "coach_parent_invites_all" ON public.parent_invites
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- Token lookup must work before account creation (anon and authenticated)
DROP POLICY IF EXISTS "parent_invites_read_all" ON public.parent_invites;
CREATE POLICY "parent_invites_read_all" ON public.parent_invites
  FOR SELECT TO anon, authenticated
  USING (true);

-- ─── 2. parent_support_questions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.parent_support_questions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id   UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_user_id  UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  week_start       DATE NOT NULL,
  question         TEXT NOT NULL,
  coach_reply      TEXT,
  replied_by       UUID REFERENCES auth.users(id),
  replied_at       TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, week_start)
);

ALTER TABLE public.parent_support_questions ENABLE ROW LEVEL SECURITY;

-- Parents manage their own questions
DROP POLICY IF EXISTS "psq_parent" ON public.parent_support_questions;
CREATE POLICY "psq_parent" ON public.parent_support_questions
  FOR ALL
  USING  (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

-- Coaches can read questions for their athletes
DROP POLICY IF EXISTS "psq_coach_select" ON public.parent_support_questions;
CREATE POLICY "psq_coach_select" ON public.parent_support_questions
  FOR SELECT
  USING (is_coach_of_athlete(auth.uid(), athlete_user_id));

-- Coaches can reply (UPDATE) to questions for their athletes
DROP POLICY IF EXISTS "psq_coach_reply" ON public.parent_support_questions;
CREATE POLICY "psq_coach_reply" ON public.parent_support_questions
  FOR UPDATE
  USING (is_coach_of_athlete(auth.uid(), athlete_user_id));

-- ─── 3. coach_notes: add visible_to_parent ───────────────────────────────────
ALTER TABLE public.coach_notes
  ADD COLUMN IF NOT EXISTS visible_to_parent BOOLEAN NOT NULL DEFAULT false;

-- Parents can read notes explicitly shared with them
DROP POLICY IF EXISTS "parent_notes_select" ON public.coach_notes;
CREATE POLICY "parent_notes_select" ON public.coach_notes
  FOR SELECT
  USING (
    visible_to_parent = true
    AND is_parent_of_athlete(auth.uid(), athlete_id)
  );

-- ─── 4. parent_athlete_links: tighten dev policy ─────────────────────────────
DROP POLICY IF EXISTS "Dev: all authenticated can view parent_athlete_links"
  ON public.parent_athlete_links;
DROP POLICY IF EXISTS "pal_select" ON public.parent_athlete_links;
DROP POLICY IF EXISTS "pal_insert" ON public.parent_athlete_links;

CREATE POLICY "pal_select" ON public.parent_athlete_links
  FOR SELECT
  USING (
    parent_user_id = auth.uid()
    OR athlete_user_id = auth.uid()
    OR is_coach_of_athlete(auth.uid(), athlete_user_id)
  );

CREATE POLICY "pal_insert" ON public.parent_athlete_links
  FOR INSERT
  WITH CHECK (parent_user_id = auth.uid());
