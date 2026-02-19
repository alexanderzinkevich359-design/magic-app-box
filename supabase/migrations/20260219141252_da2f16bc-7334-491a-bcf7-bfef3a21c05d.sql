
-- Create public avatars bucket for profile photos
INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Allow anyone to view avatars (public bucket)
CREATE POLICY "Avatars are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'avatars');

-- Users can upload their own avatar (folder = their user id)
CREATE POLICY "Users can upload own avatar"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can update their own avatar
CREATE POLICY "Users can update own avatar"
ON storage.objects FOR UPDATE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Users can delete their own avatar
CREATE POLICY "Users can delete own avatar"
ON storage.objects FOR DELETE
USING (bucket_id = 'avatars' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Coaches can also upload avatars for their athletes
CREATE POLICY "Coaches can upload athlete avatar"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'avatars' 
  AND has_role(auth.uid(), 'coach'::app_role)
  AND is_coach_of_athlete(auth.uid(), (storage.foldername(name))[1]::uuid)
);

-- Create athlete_improvement_videos table
CREATE TABLE public.athlete_improvement_videos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  athlete_id UUID NOT NULL,
  coach_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  video_url TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.athlete_improvement_videos ENABLE ROW LEVEL SECURITY;

-- Coaches can insert videos for their athletes
CREATE POLICY "Coaches insert improvement videos"
ON public.athlete_improvement_videos FOR INSERT
WITH CHECK (
  coach_id = auth.uid() 
  AND has_role(auth.uid(), 'coach'::app_role)
  AND is_coach_of_athlete(auth.uid(), athlete_id)
);

-- Coaches can view videos they uploaded
CREATE POLICY "Coaches view own improvement videos"
ON public.athlete_improvement_videos FOR SELECT
USING (coach_id = auth.uid());

-- Athletes can view their own improvement videos
CREATE POLICY "Athletes view own improvement videos"
ON public.athlete_improvement_videos FOR SELECT
USING (athlete_id = auth.uid());

-- Coaches can delete their own videos
CREATE POLICY "Coaches delete improvement videos"
ON public.athlete_improvement_videos FOR DELETE
USING (coach_id = auth.uid());

-- Make training-videos bucket public so videos can be viewed
UPDATE storage.buckets SET public = true WHERE id = 'training-videos';

-- Storage policies for training-videos (for improvement video uploads)
CREATE POLICY "Training videos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'training-videos');

CREATE POLICY "Coaches can upload training videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'training-videos' AND has_role(auth.uid(), 'coach'::app_role));

CREATE POLICY "Coaches can delete training videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'training-videos' AND has_role(auth.uid(), 'coach'::app_role));
