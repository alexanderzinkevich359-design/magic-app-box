import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Loader2, Plus, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SESSION_TYPES = ["practice", "game", "lesson", "assessment", "conditioning"] as const;
const STATUSES = ["completed", "missed", "scheduled"] as const;
const INTENSITIES = ["low", "medium", "high"] as const;

const SessionLogger = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [submitted, setSubmitted] = useState(false);

  // Form state
  const [athleteId, setAthleteId] = useState("");
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sessionType, setSessionType] = useState<string>("practice");
  const [status, setStatus] = useState<string>("completed");
  const [durationMin, setDurationMin] = useState("");
  const [pitchCount, setPitchCount] = useState("");
  const [throwCount, setThrowCount] = useState("");
  const [drillReps, setDrillReps] = useState("");
  const [intensity, setIntensity] = useState<string>("medium");
  const [notes, setNotes] = useState("");
  const [sorenessFlag, setSorenessFlag] = useState(false);
  const [injuryNote, setInjuryNote] = useState("");

  // Fetch athletes
  const { data: athletes = [] } = useQuery({
    queryKey: ["coach-athletes-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id")
        .eq("coach_user_id", user.id);
      if (!links?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", links.map((l) => l.athlete_user_id));
      return (profiles || []).map((p) => ({
        id: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim(),
      }));
    },
    enabled: !!user,
  });

  // Get baseball sport ID
  const { data: baseballSportId } = useQuery({
    queryKey: ["baseball-sport-id"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id").eq("slug", "baseball").single();
      return data?.id || null;
    },
  });

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !athleteId || !baseballSportId) throw new Error("Missing required fields");
      const { error } = await supabase.from("training_sessions").insert({
        coach_id: user.id,
        athlete_id: athleteId,
        sport_id: baseballSportId,
        session_date: sessionDate,
        session_type: sessionType,
        status,
        duration_min: durationMin ? parseInt(durationMin) : null,
        pitch_count: pitchCount ? parseInt(pitchCount) : 0,
        throw_count: throwCount ? parseInt(throwCount) : 0,
        drill_reps: drillReps ? parseInt(drillReps) : 0,
        intensity,
        notes: notes || null,
        soreness_flag: sorenessFlag,
        injury_note: sorenessFlag && injuryNote ? injuryNote : null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["detail-sessions"] });
      setSubmitted(true);
      toast({ title: "Session logged!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resetForm = () => {
    setAthleteId("");
    setSessionDate(format(new Date(), "yyyy-MM-dd"));
    setSessionType("practice");
    setStatus("completed");
    setDurationMin("");
    setPitchCount("");
    setThrowCount("");
    setDrillReps("");
    setIntensity("medium");
    setNotes("");
    setSorenessFlag(false);
    setInjuryNote("");
    setSubmitted(false);
  };

  if (submitted) {
    return (
      <DashboardLayout role="coach">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-2">Session Logged!</h2>
          <p className="text-muted-foreground mb-6">The training session has been recorded.</p>
          <div className="flex gap-3">
            <Button onClick={resetForm}>Log Another Session</Button>
            <Button variant="outline" onClick={() => window.history.back()}>Back</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="coach">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Log Training Session</h1>
        <p className="text-muted-foreground mt-1">Record attendance, workload, and athlete status</p>
      </div>

      <Card className="max-w-2xl">
        <CardContent className="p-6 space-y-6">
          {/* Athlete & date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Athlete</Label>
              <Select value={athleteId} onValueChange={setAthleteId}>
                <SelectTrigger><SelectValue placeholder="Select athlete" /></SelectTrigger>
                <SelectContent>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={sessionDate} onChange={(e) => setSessionDate(e.target.value)} />
            </div>
          </div>

          {/* Type, status, intensity */}
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select value={sessionType} onValueChange={setSessionType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SESSION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Intensity</Label>
              <Select value={intensity} onValueChange={setIntensity}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INTENSITIES.map((i) => (
                    <SelectItem key={i} value={i}>{i.charAt(0).toUpperCase() + i.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Workload */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Duration (min)</Label>
              <Input type="number" min={0} placeholder="60" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Pitch Count</Label>
              <Input type="number" min={0} placeholder="0" value={pitchCount} onChange={(e) => setPitchCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Throw Count</Label>
              <Input type="number" min={0} placeholder="0" value={throwCount} onChange={(e) => setThrowCount(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Drill Reps</Label>
              <Input type="number" min={0} placeholder="0" value={drillReps} onChange={(e) => setDrillReps(e.target.value)} />
            </div>
          </div>

          {/* Soreness */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={sorenessFlag} onCheckedChange={setSorenessFlag} />
              <Label>Athlete reported soreness / injury</Label>
            </div>
            {sorenessFlag && (
              <div className="space-y-2">
                <Label>Injury / Soreness Details</Label>
                <Input placeholder="e.g. Sore right shoulder" value={injuryNote} onChange={(e) => setInjuryNote(e.target.value)} />
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <Label>Session Notes (optional)</Label>
            <Textarea placeholder="How did the session go?" value={notes} onChange={(e) => setNotes(e.target.value)} className="min-h-[80px]" />
          </div>

          <Button
            onClick={() => saveMut.mutate()}
            disabled={!athleteId || !sessionDate || saveMut.isPending}
            className="w-full sm:w-auto"
          >
            {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
            Log Session
          </Button>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default SessionLogger;
