
-- Create schedule table for coach sessions with athletes
CREATE TABLE public.coach_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  coach_id UUID NOT NULL,
  athlete_id UUID NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  scheduled_date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  notes TEXT,
  color TEXT DEFAULT 'default',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.coach_schedule ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Coaches can view own schedule"
  ON public.coach_schedule FOR SELECT
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can create schedule entries"
  ON public.coach_schedule FOR INSERT
  WITH CHECK (coach_id = auth.uid() AND has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coaches can update own schedule"
  ON public.coach_schedule FOR UPDATE
  USING (coach_id = auth.uid());

CREATE POLICY "Coaches can delete own schedule"
  ON public.coach_schedule FOR DELETE
  USING (coach_id = auth.uid());

-- Athletes can view their own scheduled sessions
CREATE POLICY "Athletes can view their schedule"
  ON public.coach_schedule FOR SELECT
  USING (athlete_id = auth.uid());

CREATE TRIGGER update_coach_schedule_updated_at
  BEFORE UPDATE ON public.coach_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
