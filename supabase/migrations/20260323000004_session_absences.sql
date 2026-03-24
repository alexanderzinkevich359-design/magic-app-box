-- Track when parents report their athlete will miss a session
CREATE TABLE IF NOT EXISTS public.session_absences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id UUID REFERENCES public.coach_schedule(id) ON DELETE CASCADE NOT NULL,
  athlete_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  reason TEXT,
  reported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(schedule_id, athlete_user_id)
);

ALTER TABLE public.session_absences ENABLE ROW LEVEL SECURITY;

-- Parents can manage their own absence reports
CREATE POLICY "parent_absence_all" ON public.session_absences
  FOR ALL USING (parent_user_id = auth.uid())
  WITH CHECK (parent_user_id = auth.uid());

-- Coaches can view absences for their own schedule entries
CREATE POLICY "coach_absence_select" ON public.session_absences
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.coach_schedule cs
      WHERE cs.id = session_absences.schedule_id
        AND cs.coach_id = auth.uid()
    )
  );
