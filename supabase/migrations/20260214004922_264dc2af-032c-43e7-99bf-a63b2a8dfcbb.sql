
-- =============================================
-- ZINK PERFORMANCE - Phase 1 Database Schema
-- =============================================

-- 1. Role enum and user_roles table
CREATE TYPE public.app_role AS ENUM ('coach', 'athlete', 'parent');

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- 2. Sports table
CREATE TABLE public.sports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  slug TEXT NOT NULL UNIQUE,
  icon TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.sports ENABLE ROW LEVEL SECURITY;

-- 3. Profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  first_name TEXT NOT NULL DEFAULT '',
  last_name TEXT NOT NULL DEFAULT '',
  avatar_url TEXT,
  date_of_birth DATE,
  phone TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- 4. Parent-athlete relationship
CREATE TABLE public.parent_athlete_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (parent_user_id, athlete_user_id)
);
ALTER TABLE public.parent_athlete_links ENABLE ROW LEVEL SECURITY;

-- 5. Coach-athlete relationship
CREATE TABLE public.coach_athlete_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sport_id UUID REFERENCES public.sports(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coach_user_id, athlete_user_id)
);
ALTER TABLE public.coach_athlete_links ENABLE ROW LEVEL SECURITY;

-- 6. Programs
CREATE TABLE public.programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sport_id UUID REFERENCES public.sports(id) NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  position_type TEXT,
  skill_level TEXT NOT NULL DEFAULT 'beginner',
  duration_weeks INT,
  is_published BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;

-- 7. Workouts
CREATE TABLE public.workouts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  order_index INT NOT NULL DEFAULT 0,
  estimated_duration_min INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.workouts ENABLE ROW LEVEL SECURITY;

-- 8. Drills
CREATE TABLE public.drills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workout_id UUID REFERENCES public.workouts(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  instructions TEXT,
  coaching_cues TEXT,
  video_url TEXT,
  equipment TEXT,
  difficulty TEXT NOT NULL DEFAULT 'beginner',
  rep_scheme TEXT,
  skill_category TEXT,
  order_index INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.drills ENABLE ROW LEVEL SECURITY;

-- 9. Athlete program assignments
CREATE TABLE public.athlete_programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE NOT NULL,
  assigned_by UUID REFERENCES auth.users(id) NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE (athlete_id, program_id)
);
ALTER TABLE public.athlete_programs ENABLE ROW LEVEL SECURITY;

-- 10. Athlete metrics
CREATE TABLE public.athlete_metrics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sport_id UUID REFERENCES public.sports(id) NOT NULL,
  metric_type TEXT NOT NULL,
  metric_category TEXT NOT NULL,
  value NUMERIC NOT NULL,
  unit TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id),
  notes TEXT
);
ALTER TABLE public.athlete_metrics ENABLE ROW LEVEL SECURITY;

-- 11. Video submissions
CREATE TABLE public.video_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  drill_id UUID REFERENCES public.drills(id),
  video_url TEXT NOT NULL,
  description TEXT,
  submitted_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.video_submissions ENABLE ROW LEVEL SECURITY;

-- 12. Video feedback
CREATE TABLE public.video_feedback (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  video_submission_id UUID REFERENCES public.video_submissions(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  feedback_text TEXT NOT NULL,
  timestamp_seconds INT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.video_feedback ENABLE ROW LEVEL SECURITY;

-- 13. Workload tracking
CREATE TABLE public.workload_tracking (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  sport_id UUID REFERENCES public.sports(id) NOT NULL,
  pitch_count INT DEFAULT 0,
  throw_count INT DEFAULT 0,
  session_duration_min INT,
  intensity_level TEXT,
  notes TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  recorded_by UUID REFERENCES auth.users(id)
);
ALTER TABLE public.workload_tracking ENABLE ROW LEVEL SECURITY;

-- 14. Coach notes
CREATE TABLE public.coach_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  note TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.coach_notes ENABLE ROW LEVEL SECURITY;

-- 15. Athlete goals
CREATE TABLE public.athlete_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  athlete_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  coach_id UUID REFERENCES auth.users(id),
  title TEXT NOT NULL,
  target TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  deadline DATE,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.athlete_goals ENABLE ROW LEVEL SECURITY;

-- =============================================
-- HELPER FUNCTIONS
-- =============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

CREATE OR REPLACE FUNCTION public.is_coach_of_athlete(_coach_id UUID, _athlete_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coach_athlete_links
    WHERE coach_user_id = _coach_id AND athlete_user_id = _athlete_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_parent_of_athlete(_parent_id UUID, _athlete_id UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.parent_athlete_links
    WHERE parent_user_id = _parent_id AND athlete_user_id = _athlete_id
  )
$$;

-- =============================================
-- RLS POLICIES
-- =============================================

-- user_roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid());

-- sports
CREATE POLICY "Sports are publicly readable" ON public.sports FOR SELECT USING (true);

-- profiles
CREATE POLICY "Profiles readable by authenticated" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own profile" ON public.profiles FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());

-- parent_athlete_links
CREATE POLICY "Parent links viewable by involved" ON public.parent_athlete_links FOR SELECT TO authenticated 
  USING (parent_user_id = auth.uid() OR athlete_user_id = auth.uid());
CREATE POLICY "Parents can create links" ON public.parent_athlete_links FOR INSERT TO authenticated 
  WITH CHECK (parent_user_id = auth.uid() AND public.has_role(auth.uid(), 'parent'));

-- coach_athlete_links
CREATE POLICY "Coach links viewable by involved" ON public.coach_athlete_links FOR SELECT TO authenticated 
  USING (coach_user_id = auth.uid() OR athlete_user_id = auth.uid());
CREATE POLICY "Coaches can create links" ON public.coach_athlete_links FOR INSERT TO authenticated 
  WITH CHECK (coach_user_id = auth.uid() AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches can delete own links" ON public.coach_athlete_links FOR DELETE TO authenticated 
  USING (coach_user_id = auth.uid());

-- programs: separate policies per operation to avoid ambiguous id
CREATE POLICY "Coaches select own programs" ON public.programs FOR SELECT TO authenticated 
  USING (coach_id = auth.uid());
CREATE POLICY "Athletes view assigned programs" ON public.programs FOR SELECT TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.athlete_programs ap WHERE ap.program_id = programs.id AND ap.athlete_id = auth.uid())
    OR is_published = true
  );
CREATE POLICY "Parents view child programs" ON public.programs FOR SELECT TO authenticated 
  USING (
    EXISTS (
      SELECT 1 FROM public.athlete_programs ap 
      JOIN public.parent_athlete_links pal ON pal.athlete_user_id = ap.athlete_id
      WHERE ap.program_id = programs.id AND pal.parent_user_id = auth.uid()
    )
  );
CREATE POLICY "Coaches insert programs" ON public.programs FOR INSERT TO authenticated 
  WITH CHECK (coach_id = auth.uid() AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches update own programs" ON public.programs FOR UPDATE TO authenticated 
  USING (coach_id = auth.uid());
CREATE POLICY "Coaches delete own programs" ON public.programs FOR DELETE TO authenticated 
  USING (coach_id = auth.uid());

-- workouts
CREATE POLICY "Workout select follows program" ON public.workouts FOR SELECT TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.programs p WHERE p.id = workouts.program_id AND (
      p.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.athlete_programs ap WHERE ap.program_id = p.id AND ap.athlete_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.athlete_programs ap JOIN public.parent_athlete_links pal ON pal.athlete_user_id = ap.athlete_id WHERE ap.program_id = p.id AND pal.parent_user_id = auth.uid())
    ))
  );
CREATE POLICY "Coaches insert workouts" ON public.workouts FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = workouts.program_id AND p.coach_id = auth.uid()));
CREATE POLICY "Coaches update workouts" ON public.workouts FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = workouts.program_id AND p.coach_id = auth.uid()));
CREATE POLICY "Coaches delete workouts" ON public.workouts FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.programs p WHERE p.id = workouts.program_id AND p.coach_id = auth.uid()));

-- drills
CREATE POLICY "Drill select follows workout" ON public.drills FOR SELECT TO authenticated 
  USING (
    EXISTS (SELECT 1 FROM public.workouts w JOIN public.programs p ON p.id = w.program_id WHERE w.id = drills.workout_id AND (
      p.coach_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.athlete_programs ap WHERE ap.program_id = p.id AND ap.athlete_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.athlete_programs ap JOIN public.parent_athlete_links pal ON pal.athlete_user_id = ap.athlete_id WHERE ap.program_id = p.id AND pal.parent_user_id = auth.uid())
    ))
  );
CREATE POLICY "Coaches insert drills" ON public.drills FOR INSERT TO authenticated 
  WITH CHECK (EXISTS (SELECT 1 FROM public.workouts w JOIN public.programs p ON p.id = w.program_id WHERE w.id = drills.workout_id AND p.coach_id = auth.uid()));
CREATE POLICY "Coaches update drills" ON public.drills FOR UPDATE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.workouts w JOIN public.programs p ON p.id = w.program_id WHERE w.id = drills.workout_id AND p.coach_id = auth.uid()));
CREATE POLICY "Coaches delete drills" ON public.drills FOR DELETE TO authenticated 
  USING (EXISTS (SELECT 1 FROM public.workouts w JOIN public.programs p ON p.id = w.program_id WHERE w.id = drills.workout_id AND p.coach_id = auth.uid()));

-- athlete_programs
CREATE POLICY "Athlete program select" ON public.athlete_programs FOR SELECT TO authenticated 
  USING (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_parent_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Coaches assign programs" ON public.athlete_programs FOR INSERT TO authenticated 
  WITH CHECK (public.has_role(auth.uid(), 'coach') AND assigned_by = auth.uid());
CREATE POLICY "Coaches update assignments" ON public.athlete_programs FOR UPDATE TO authenticated 
  USING (public.is_coach_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Coaches delete assignments" ON public.athlete_programs FOR DELETE TO authenticated 
  USING (public.is_coach_of_athlete(auth.uid(), athlete_id));

-- athlete_metrics
CREATE POLICY "Metrics viewable by involved" ON public.athlete_metrics FOR SELECT TO authenticated 
  USING (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_parent_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Athletes coaches insert metrics" ON public.athlete_metrics FOR INSERT TO authenticated 
  WITH CHECK (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Athletes coaches update metrics" ON public.athlete_metrics FOR UPDATE TO authenticated 
  USING (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id));

-- video_submissions
CREATE POLICY "Video subs viewable by involved" ON public.video_submissions FOR SELECT TO authenticated 
  USING (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_parent_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Athletes upload videos" ON public.video_submissions FOR INSERT TO authenticated 
  WITH CHECK (athlete_id = auth.uid());

-- video_feedback
CREATE POLICY "Feedback viewable by involved" ON public.video_feedback FOR SELECT TO authenticated 
  USING (
    coach_id = auth.uid() 
    OR EXISTS (SELECT 1 FROM public.video_submissions vs WHERE vs.id = video_feedback.video_submission_id AND vs.athlete_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.video_submissions vs JOIN public.parent_athlete_links pal ON pal.athlete_user_id = vs.athlete_id WHERE vs.id = video_feedback.video_submission_id AND pal.parent_user_id = auth.uid())
  );
CREATE POLICY "Coaches add feedback" ON public.video_feedback FOR INSERT TO authenticated 
  WITH CHECK (coach_id = auth.uid() AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches update feedback" ON public.video_feedback FOR UPDATE TO authenticated 
  USING (coach_id = auth.uid());

-- workload_tracking
CREATE POLICY "Workload viewable by involved" ON public.workload_tracking FOR SELECT TO authenticated 
  USING (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_parent_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Athletes coaches log workload" ON public.workload_tracking FOR INSERT TO authenticated 
  WITH CHECK (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id));

-- coach_notes (private to coach)
CREATE POLICY "Coaches view own notes" ON public.coach_notes FOR SELECT TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "Coaches create notes" ON public.coach_notes FOR INSERT TO authenticated WITH CHECK (coach_id = auth.uid() AND public.has_role(auth.uid(), 'coach'));
CREATE POLICY "Coaches update notes" ON public.coach_notes FOR UPDATE TO authenticated USING (coach_id = auth.uid());
CREATE POLICY "Coaches delete notes" ON public.coach_notes FOR DELETE TO authenticated USING (coach_id = auth.uid());

-- athlete_goals
CREATE POLICY "Goals viewable by involved" ON public.athlete_goals FOR SELECT TO authenticated 
  USING (athlete_id = auth.uid() OR public.is_coach_of_athlete(auth.uid(), athlete_id) OR public.is_parent_of_athlete(auth.uid(), athlete_id));
CREATE POLICY "Athletes coaches create goals" ON public.athlete_goals FOR INSERT TO authenticated 
  WITH CHECK (athlete_id = auth.uid() OR (coach_id = auth.uid() AND public.is_coach_of_athlete(auth.uid(), athlete_id)));
CREATE POLICY "Athletes coaches update goals" ON public.athlete_goals FOR UPDATE TO authenticated 
  USING (athlete_id = auth.uid() OR coach_id = auth.uid());

-- =============================================
-- TRIGGERS
-- =============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_programs_updated_at BEFORE UPDATE ON public.programs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (user_id, first_name, last_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'first_name', ''), COALESCE(NEW.raw_user_meta_data->>'last_name', ''));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Auto-assign role on signup
CREATE OR REPLACE FUNCTION public.handle_new_user_role()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'athlete'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_role AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_role();

-- =============================================
-- SEED: Baseball sport
-- =============================================
INSERT INTO public.sports (name, slug, icon) VALUES ('Baseball', 'baseball', '⚾');
