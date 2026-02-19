
-- Allow athletes to upload videos to training-videos bucket
CREATE POLICY "Athletes can upload training videos"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'training-videos' AND has_role(auth.uid(), 'athlete'::app_role));

-- Allow athletes to delete their own uploads
CREATE POLICY "Athletes can delete own training videos"
ON storage.objects FOR DELETE
USING (bucket_id = 'training-videos' AND auth.uid()::text = (storage.foldername(name))[1]);
