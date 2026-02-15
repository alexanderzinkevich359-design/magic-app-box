
-- Drop restrictive SELECT policies and replace with open ones for dev/testing

-- profiles: already has open SELECT, skip

-- coach_athlete_links
DROP POLICY IF EXISTS "Coach links viewable by involved" ON public.coach_athlete_links;
CREATE POLICY "Dev: all authenticated can view links"
  ON public.coach_athlete_links FOR SELECT
  TO authenticated
  USING (true);

-- coach_notes
DROP POLICY IF EXISTS "Coaches view own notes" ON public.coach_notes;
CREATE POLICY "Dev: all authenticated can view notes"
  ON public.coach_notes FOR SELECT
  TO authenticated
  USING (true);

-- athlete_goals
DROP POLICY IF EXISTS "Goals viewable by involved" ON public.athlete_goals;
CREATE POLICY "Dev: all authenticated can view goals"
  ON public.athlete_goals FOR SELECT
  TO authenticated
  USING (true);

-- athlete_metrics
DROP POLICY IF EXISTS "Metrics viewable by involved" ON public.athlete_metrics;
CREATE POLICY "Dev: all authenticated can view metrics"
  ON public.athlete_metrics FOR SELECT
  TO authenticated
  USING (true);

-- athlete_programs
DROP POLICY IF EXISTS "Athlete program select" ON public.athlete_programs;
CREATE POLICY "Dev: all authenticated can view athlete_programs"
  ON public.athlete_programs FOR SELECT
  TO authenticated
  USING (true);

-- programs: keep coach's own + add open read
DROP POLICY IF EXISTS "Athletes view assigned programs" ON public.programs;
DROP POLICY IF EXISTS "Parents view child programs" ON public.programs;
DROP POLICY IF EXISTS "Coaches select own programs" ON public.programs;
CREATE POLICY "Dev: all authenticated can view programs"
  ON public.programs FOR SELECT
  TO authenticated
  USING (true);

-- workouts
DROP POLICY IF EXISTS "Workout select follows program" ON public.workouts;
CREATE POLICY "Dev: all authenticated can view workouts"
  ON public.workouts FOR SELECT
  TO authenticated
  USING (true);

-- drills
DROP POLICY IF EXISTS "Drill select follows workout" ON public.drills;
CREATE POLICY "Dev: all authenticated can view drills"
  ON public.drills FOR SELECT
  TO authenticated
  USING (true);

-- video_submissions
DROP POLICY IF EXISTS "Video subs viewable by involved" ON public.video_submissions;
CREATE POLICY "Dev: all authenticated can view video_submissions"
  ON public.video_submissions FOR SELECT
  TO authenticated
  USING (true);

-- video_feedback
DROP POLICY IF EXISTS "Feedback viewable by involved" ON public.video_feedback;
CREATE POLICY "Dev: all authenticated can view video_feedback"
  ON public.video_feedback FOR SELECT
  TO authenticated
  USING (true);

-- workload_tracking
DROP POLICY IF EXISTS "Workload viewable by involved" ON public.workload_tracking;
CREATE POLICY "Dev: all authenticated can view workload_tracking"
  ON public.workload_tracking FOR SELECT
  TO authenticated
  USING (true);

-- parent_athlete_links
DROP POLICY IF EXISTS "Parent links viewable by involved" ON public.parent_athlete_links;
CREATE POLICY "Dev: all authenticated can view parent_athlete_links"
  ON public.parent_athlete_links FOR SELECT
  TO authenticated
  USING (true);

-- user_roles
DROP POLICY IF EXISTS "Users can view own roles" ON public.user_roles;
CREATE POLICY "Dev: all authenticated can view user_roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (true);
