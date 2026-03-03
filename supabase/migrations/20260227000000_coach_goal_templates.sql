CREATE TABLE public.coach_goal_templates (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id      UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title         TEXT NOT NULL,
  category      TEXT NOT NULL DEFAULT 'coach_assigned'
                CHECK (category IN ('skill','conditioning','mindset','coach_assigned')),
  is_measurable BOOLEAN NOT NULL DEFAULT true,
  target        TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_goal_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_goal_templates_all" ON public.coach_goal_templates
  FOR ALL USING (auth.uid() = coach_id) WITH CHECK (auth.uid() = coach_id);
