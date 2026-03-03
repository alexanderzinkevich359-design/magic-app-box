-- Team Spotlight Studio Migration
-- Creates social_connections, spotlight_posts tables,
-- storage bucket for spotlight media, and pg_cron schedule.

-- ─── 1. social_connections ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.social_connections (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id              UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  facebook_page_id      TEXT NOT NULL,
  facebook_page_name    TEXT,
  facebook_access_token TEXT NOT NULL,   -- page-level token (never expires)
  instagram_account_id  TEXT,
  instagram_username    TEXT,
  connected_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.social_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sc_coach_all" ON public.social_connections;
CREATE POLICY "sc_coach_all" ON public.social_connections
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ─── 2. spotlight_posts ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.spotlight_posts (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id                    UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  post_type                   TEXT NOT NULL CHECK (post_type IN (
                                'athlete_spotlight','team_development',
                                'tournament_recap','weekly_progress'
                              )),
  status                      TEXT NOT NULL DEFAULT 'draft' CHECK (status IN (
                                'draft','scheduled','published','failed'
                              )),
  athlete_ids                 UUID[] DEFAULT '{}',
  context_data                JSONB DEFAULT '{}',
  media_url                   TEXT,
  media_type                  TEXT CHECK (media_type IN ('photo','video')),
  platforms                   TEXT[] DEFAULT '{}',  -- ['instagram','facebook']
  instagram_caption           TEXT,
  facebook_caption            TEXT,
  hashtags                    TEXT[],
  tone                        TEXT NOT NULL DEFAULT 'professional',
  use_emoji                   BOOLEAN NOT NULL DEFAULT false,
  scheduled_at                TIMESTAMPTZ,
  published_at                TIMESTAMPTZ,
  instagram_post_id           TEXT,
  facebook_post_id            TEXT,
  publish_error               TEXT,
  media_permission_confirmed  BOOLEAN NOT NULL DEFAULT false,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.spotlight_posts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "sp_coach_all" ON public.spotlight_posts;
CREATE POLICY "sp_coach_all" ON public.spotlight_posts
  FOR ALL
  USING  (coach_id = auth.uid())
  WITH CHECK (coach_id = auth.uid());

-- ─── 3. storage bucket ────────────────────────────────────────────────────────
INSERT INTO storage.buckets (id, name, public)
VALUES ('spotlight-media', 'spotlight-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "spotlight_media_coach_upload" ON storage.objects;
CREATE POLICY "spotlight_media_coach_upload" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'spotlight-media');

DROP POLICY IF EXISTS "spotlight_media_public_read" ON storage.objects;
CREATE POLICY "spotlight_media_public_read" ON storage.objects
  FOR SELECT
  USING (bucket_id = 'spotlight-media');

DROP POLICY IF EXISTS "spotlight_media_coach_delete" ON storage.objects;
CREATE POLICY "spotlight_media_coach_delete" ON storage.objects
  FOR DELETE TO authenticated
  USING (bucket_id = 'spotlight-media');

-- ─── 4. pg_cron schedule ──────────────────────────────────────────────────────
-- IMPORTANT: Requires pg_cron and pg_net extensions enabled in Supabase Dashboard
-- → Database → Extensions → enable pg_cron and pg_net BEFORE running this migration.
-- If extensions are not enabled, comment out this block and run manually after enabling.

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    PERFORM cron.schedule(
      'publish-scheduled-posts',
      '*/5 * * * *',
      $$SELECT net.http_post(
        url := 'https://inrjsvwmnldfjykmkoan.supabase.co/functions/v1/publish-scheduled-posts',
        headers := '{"Content-Type":"application/json"}'::jsonb,
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );$$
    );
  END IF;
END $$;
