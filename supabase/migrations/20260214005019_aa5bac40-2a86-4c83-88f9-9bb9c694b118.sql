
-- Create storage bucket for training videos
INSERT INTO storage.buckets (id, name, public) VALUES ('training-videos', 'training-videos', false);

-- Athletes can upload to their own folder
CREATE POLICY "Athletes upload videos" ON storage.objects FOR INSERT TO authenticated 
  WITH CHECK (bucket_id = 'training-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Athletes can view their own videos
CREATE POLICY "Athletes view own videos" ON storage.objects FOR SELECT TO authenticated 
  USING (bucket_id = 'training-videos' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Coaches can view athlete videos (via coach_athlete_links)
CREATE POLICY "Coaches view athlete videos" ON storage.objects FOR SELECT TO authenticated 
  USING (
    bucket_id = 'training-videos' 
    AND public.is_coach_of_athlete(auth.uid(), (storage.foldername(name))[1]::uuid)
  );

-- Parents can view their child's videos
CREATE POLICY "Parents view child videos" ON storage.objects FOR SELECT TO authenticated 
  USING (
    bucket_id = 'training-videos' 
    AND public.is_parent_of_athlete(auth.uid(), (storage.foldername(name))[1]::uuid)
  );
