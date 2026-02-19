import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Video, Plus, Trash2, Loader2, Upload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface ImprovementVideosProps {
  athleteId: string;
  coachId?: string; // if provided, coach mode (can upload)
  readOnly?: boolean;
}

const ImprovementVideos = ({ athleteId, coachId, readOnly = false }: ImprovementVideosProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const { data: videos = [], isLoading } = useQuery({
    queryKey: ["improvement-videos", athleteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("athlete_improvement_videos")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile || !coachId) throw new Error("Missing file or coach");

      setUploading(true);
      const ext = selectedFile.name.split(".").pop();
      const path = `improvements/${athleteId}/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("training-videos")
        .upload(path, selectedFile);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("training-videos").getPublicUrl(path);

      const { error: insertErr } = await supabase
        .from("athlete_improvement_videos")
        .insert({
          athlete_id: athleteId,
          coach_id: coachId,
          title: title.trim(),
          description: description.trim() || null,
          video_url: publicUrl,
        });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["improvement-videos", athleteId] });
      setTitle("");
      setDescription("");
      setSelectedFile(null);
      setShowForm(false);
      setUploading(false);
      toast({ title: "Video added to profile!" });
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (videoId: string) => {
      const { error } = await supabase.from("athlete_improvement_videos").delete().eq("id", videoId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["improvement-videos", athleteId] });
      toast({ title: "Video removed" });
    },
  });

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-3.5 w-3.5 text-primary" /> Improvement Videos
            </CardTitle>
            <CardDescription className="text-xs">Videos showing athlete progress & improvements</CardDescription>
          </div>
          {!readOnly && coachId && !showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Add Video
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {showForm && (
          <div className="rounded-lg border p-3 space-y-3 bg-secondary/30">
            <div className="space-y-1">
              <Label className="text-xs">Title</Label>
              <Input placeholder="e.g. Swing mechanics improvement" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Description (optional)</Label>
              <Textarea placeholder="What this video shows..." value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[60px]" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Video File</Label>
              <input
                ref={fileRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
              />
              <Button
                variant="outline"
                className="w-full justify-start text-muted-foreground"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="h-3.5 w-3.5 mr-2" />
                {selectedFile ? selectedFile.name : "Choose video file..."}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={() => uploadMutation.mutate()}
                disabled={!title.trim() || !selectedFile || uploading}
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Upload Video
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setSelectedFile(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : videos.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No improvement videos yet.</p>
        ) : (
          videos.map((video: any) => (
            <div key={video.id} className="rounded-lg border p-3 space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-sm font-medium">{video.title}</p>
                  {video.description && (
                    <p className="text-xs text-muted-foreground mt-0.5">{video.description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(video.created_at).toLocaleDateString()}
                  </p>
                </div>
                {!readOnly && coachId && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 text-muted-foreground hover:text-destructive"
                    onClick={() => deleteMutation.mutate(video.id)}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
              <video
                src={video.video_url}
                controls
                className="w-full rounded-md max-h-48 bg-black"
                preload="metadata"
              />
            </div>
          ))
        )}
      </CardContent>
    </Card>
  );
};

export default ImprovementVideos;
