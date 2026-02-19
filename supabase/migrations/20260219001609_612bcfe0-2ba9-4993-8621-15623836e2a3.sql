
-- 1. Add position to coach_athlete_links
ALTER TABLE public.coach_athlete_links
  ADD COLUMN position TEXT DEFAULT NULL;

-- 2. Add tag and is_private to coach_notes
ALTER TABLE public.coach_notes
  ADD COLUMN tag TEXT DEFAULT NULL,
  ADD COLUMN is_private BOOLEAN NOT NULL DEFAULT true;

-- 3. Create training_sessions table for logging sessions & attendance
CREATE TABLE public.training_sessions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  sport_id UUID NOT NULL REFERENCES public.sports(id),
  session_date DATE NOT NULL,
  session_type TEXT NOT NULL DEFAULT 'practice',
  status TEXT NOT NULL DEFAULT 'scheduled',
  duration_min INTEGER,
  pitch_count INTEGER DEFAULT 0,
  throw_count INTEGER DEFAULT 0,
  drill_reps INTEGER DEFAULT 0,
  intensity TEXT DEFAULT 'medium',
  notes TEXT,
  soreness_flag BOOLEAN NOT NULL DEFAULT false,
  injury_note TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.training_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches view own sessions"
  ON public.training_sessions FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Athletes view own sessions"
  ON public.training_sessions FOR SELECT
  USING (athlete_id = auth.uid());

CREATE POLICY "Coaches create sessions"
  ON public.training_sessions FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coaches update own sessions"
  ON public.training_sessions FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches delete own sessions"
  ON public.training_sessions FOR DELETE
  USING (coach_id = auth.uid());

CREATE TRIGGER update_training_sessions_updated_at
  BEFORE UPDATE ON public.training_sessions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Create coach_alerts table
CREATE TABLE public.coach_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning',
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches view own alerts"
  ON public.coach_alerts FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches update own alerts"
  ON public.coach_alerts FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches delete own alerts"
  ON public.coach_alerts FOR DELETE
  USING (coach_id = auth.uid());

-- System can insert alerts (via service role in edge functions)
CREATE POLICY "System can create alerts"
  ON public.coach_alerts FOR INSERT
  WITH CHECK (coach_id = auth.uid() OR has_role(auth.uid(), 'coach'::app_role));
