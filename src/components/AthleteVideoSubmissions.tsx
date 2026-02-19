import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Video, Plus, Trash2, Loader2, Upload, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AthleteVideoSubmissionsProps {
  athleteId: string;
  /** If true, athlete can upload. If false, coach read-only view with feedback. */
  canUpload?: boolean;
  /** Coach ID — enables adding feedback */
  coachId?: string;
}

const AthleteVideoSubmissions = ({ athleteId, canUpload = false, coachId }: AthleteVideoSubmissionsProps) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);

  const [showForm, setShowForm] = useState(false);
  const [description, setDescription] = useState("");
  const [uploading, setUploading] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackVideoId, setFeedbackVideoId] = useState<string | null>(null);

  // Fetch submissions
  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["athlete-video-submissions", athleteId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("video_submissions")
        .select("*")
        .eq("athlete_id", athleteId)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch feedback for all submissions
  const submissionIds = submissions.map((s: any) => s.id);
  const { data: allFeedback = [] } = useQuery({
    queryKey: ["video-feedback", submissionIds],
    queryFn: async () => {
      if (!submissionIds.length) return [];
      const { data, error } = await supabase
        .from("video_feedback")
        .select("*")
        .in("video_submission_id", submissionIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: submissionIds.length > 0,
  });

  // Upload mutation
  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!selectedFile) throw new Error("No file selected");
      setUploading(true);

      const ext = selectedFile.name.split(".").pop();
      const path = `${athleteId}/submissions/${Date.now()}.${ext}`;

      const { error: uploadErr } = await supabase.storage
        .from("training-videos")
        .upload(path, selectedFile);
      if (uploadErr) throw uploadErr;

      const { data: { publicUrl } } = supabase.storage.from("training-videos").getPublicUrl(path);

      const { error: insertErr } = await supabase
        .from("video_submissions")
        .insert({
          athlete_id: athleteId,
          video_url: publicUrl,
          description: description.trim() || null,
        });
      if (insertErr) throw insertErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-video-submissions", athleteId] });
      setDescription("");
      setSelectedFile(null);
      setShowForm(false);
      setUploading(false);
      toast({ title: "Video submitted for review!" });
    },
    onError: (err: any) => {
      setUploading(false);
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    },
  });

  // Add feedback mutation (coach only)
  const addFeedbackMutation = useMutation({
    mutationFn: async ({ submissionId, text }: { submissionId: string; text: string }) => {
      if (!coachId) throw new Error("Not a coach");
      const { error } = await supabase.from("video_feedback").insert({
        video_submission_id: submissionId,
        coach_id: coachId,
        feedback_text: text.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["video-feedback"] });
      setFeedbackText("");
      setFeedbackVideoId(null);
      toast({ title: "Feedback added!" });
    },
    onError: (err: any) => toast({ title: "Error", description: err.message, variant: "destructive" }),
  });

  return (
    <Card>
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-sm flex items-center gap-2">
              <Video className="h-3.5 w-3.5 text-primary" /> Video Submissions
            </CardTitle>
            <CardDescription className="text-xs">
              {canUpload ? "Upload videos for your coach to review" : "Videos submitted by athlete for review"}
            </CardDescription>
          </div>
          {canUpload && !showForm && (
            <Button size="sm" variant="outline" onClick={() => setShowForm(true)}>
              <Plus className="h-3.5 w-3.5 mr-1" /> Submit Video
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="px-4 pb-4 space-y-3">
        {/* Upload Form */}
        {showForm && (
          <div className="rounded-lg border p-3 space-y-3 bg-secondary/30">
            <div className="space-y-1">
              <Label className="text-xs">What are you submitting? (optional)</Label>
              <Textarea
                placeholder="e.g. My batting swing from today's practice..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="min-h-[60px]"
                maxLength={500}
              />
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
                disabled={!selectedFile || uploading}
              >
                {uploading && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                Submit for Review
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setSelectedFile(null); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Submissions List */}
        {isLoading ? (
          <div className="flex justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : submissions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">
            {canUpload ? "No videos submitted yet. Upload one for your coach to review!" : "No videos submitted yet."}
          </p>
        ) : (
          submissions.map((sub: any) => {
            const feedback = allFeedback.filter((f: any) => f.video_submission_id === sub.id);
            return (
              <div key={sub.id} className="rounded-lg border p-3 space-y-2">
                <div className="flex items-start justify-between">
                  <div>
                    {sub.description && (
                      <p className="text-sm font-medium">{sub.description}</p>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Submitted {new Date(sub.submitted_at).toLocaleDateString()}
                    </p>
                  </div>
                  {feedback.length > 0 && (
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {feedback.length} {feedback.length === 1 ? "review" : "reviews"}
                    </Badge>
                  )}
                </div>

                <video
                  src={sub.video_url}
                  controls
                  className="w-full rounded-md max-h-48 bg-black"
                  preload="metadata"
                />

                {/* Feedback list */}
                {feedback.length > 0 && (
                  <div className="space-y-2 pt-1">
                    {feedback.map((fb: any) => (
                      <div key={fb.id} className="rounded-md bg-primary/5 border border-primary/10 p-2.5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <MessageSquare className="h-3 w-3 text-primary" />
                          <span className="text-[10px] font-medium text-primary">Coach Feedback</span>
                          <span className="text-[10px] text-muted-foreground ml-auto">
                            {new Date(fb.created_at).toLocaleDateString()}
                          </span>
                        </div>
                        <p className="text-xs">{fb.feedback_text}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Coach feedback form */}
                {coachId && feedbackVideoId === sub.id && (
                  <div className="pt-1 space-y-2">
                    <Textarea
                      placeholder="Write your feedback..."
                      value={feedbackText}
                      onChange={(e) => setFeedbackText(e.target.value)}
                      className="min-h-[60px] text-xs"
                      maxLength={1000}
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => addFeedbackMutation.mutate({ submissionId: sub.id, text: feedbackText })}
                        disabled={!feedbackText.trim() || addFeedbackMutation.isPending}
                      >
                        {addFeedbackMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                        Send Feedback
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => { setFeedbackVideoId(null); setFeedbackText(""); }}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {coachId && feedbackVideoId !== sub.id && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-xs h-7 gap-1"
                    onClick={() => setFeedbackVideoId(sub.id)}
                  >
                    <MessageSquare className="h-3 w-3" /> Add Feedback
                  </Button>
                )}
              </div>
            );
          })
        )}
      </CardContent>
    </Card>
  );
};

export default AthleteVideoSubmissions;
