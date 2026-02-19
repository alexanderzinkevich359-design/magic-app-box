import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

const SESSION_TYPES = ["practice", "game", "lesson", "assessment", "conditioning"] as const;
const STATUSES = ["completed", "missed", "scheduled"] as const;
const INTENSITIES = ["low", "medium", "high"] as const;

const PITCH_TYPES = ["Fastball", "Curveball", "Slider", "Changeup", "Cutter", "Sinker", "Splitter", "Knuckleball"] as const;

const SORENESS_AREAS = [
  "Shoulder", "Elbow", "Forearm/Wrist", "Upper Back", "Lower Back",
  "Hip/Groin", "Quad", "Hamstring", "Knee", "Calf/Ankle",
] as const;

const STRETCHING_SUGGESTIONS: Record<string, { name: string; description: string }[]> = {
  Shoulder: [
    { name: "Cross-body shoulder stretch", description: "Hold arm across chest for 30s each side" },
    { name: "Sleeper stretch", description: "Lie on side, press forearm down gently. 3×30s" },
    { name: "Wall angels", description: "Back against wall, slide arms up/down. 2×10 reps" },
    { name: "Band pull-aparts", description: "Light band, 3×15 at chest height" },
  ],
  Elbow: [
    { name: "Wrist flexor stretch", description: "Extend arm, pull fingers back. 3×30s" },
    { name: "Wrist extensor stretch", description: "Extend arm palm down, pull fingers toward you. 3×30s" },
    { name: "Pronation/supination", description: "Light weight, rotate forearm slowly. 2×15" },
    { name: "Reverse curls", description: "Very light weight, 2×12 to promote blood flow" },
  ],
  "Forearm/Wrist": [
    { name: "Wrist circles", description: "Slow circles both directions, 2×10 each" },
    { name: "Finger extensions with rubber band", description: "Spread fingers against band, 3×15" },
    { name: "Prayer stretch", description: "Palms together, press down. Hold 30s" },
  ],
  "Upper Back": [
    { name: "Cat-cow stretch", description: "Alternate arching and rounding. 2×10 reps" },
    { name: "Thoracic spine rotation", description: "Side-lying, rotate upper body. 2×10 each side" },
    { name: "Child's pose with reach", description: "Walk hands left/right to stretch lats. 30s each" },
  ],
  "Lower Back": [
    { name: "Knee-to-chest stretch", description: "Lying on back, pull knee to chest. 3×30s each" },
    { name: "Piriformis stretch", description: "Figure-4 position, pull through. 3×30s each" },
    { name: "Pelvic tilts", description: "Lying on back, flatten lower back to floor. 2×15" },
    { name: "Dead bug", description: "Core stability exercise, 2×10 each side" },
  ],
  "Hip/Groin": [
    { name: "90/90 hip stretch", description: "Sit with legs at 90°, rotate between sides. 2×10" },
    { name: "Butterfly stretch", description: "Sit with soles together, press knees down. 3×30s" },
    { name: "Kneeling hip flexor stretch", description: "Lunge position, push hips forward. 3×30s each" },
    { name: "Lateral lunge", description: "Side lunge with bodyweight, 2×8 each side" },
  ],
  Quad: [
    { name: "Standing quad stretch", description: "Pull heel to glute, keep knees together. 3×30s" },
    { name: "Couch stretch", description: "Rear foot on wall/bench, tall posture. 2×45s each" },
    { name: "Foam roll quads", description: "Slow rolls, pause on tender spots. 60s each leg" },
  ],
  Hamstring: [
    { name: "Standing toe touch", description: "Hinge at hips, reach for toes. 3×30s" },
    { name: "Seated hamstring stretch", description: "One leg extended, reach forward. 3×30s each" },
    { name: "RDL with bodyweight", description: "Single-leg hinge, 2×8 each side for eccentric load" },
    { name: "Foam roll hamstrings", description: "Slow rolls with cross-leg pressure. 60s each" },
  ],
  Knee: [
    { name: "Quad set", description: "Seated, tighten quad pressing knee flat. 3×10 with 5s hold" },
    { name: "Terminal knee extensions", description: "Band behind knee, extend fully. 3×12" },
    { name: "Wall sit", description: "Hold 30s, ensure knees don't pass toes" },
    { name: "Calf raises", description: "Slow and controlled, 2×15 to support knee stability" },
  ],
  "Calf/Ankle": [
    { name: "Standing calf stretch", description: "Wall lean, straight back leg. 3×30s each" },
    { name: "Soleus stretch", description: "Wall lean, bent back knee. 3×30s each" },
    { name: "Ankle circles", description: "Both directions, 2×10 each foot" },
    { name: "Banded ankle dorsiflexion", description: "Band around ankle, drive knee forward. 2×10" },
  ],
};

type Position = "Pitcher" | "Catcher" | "Infielder" | "Outfielder" | "Hitter";

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
  const [throwCount, setThrowCount] = useState("");
  const [drillReps, setDrillReps] = useState("");
  const [intensity, setIntensity] = useState<string>("medium");
  const [notes, setNotes] = useState("");
  const [sorenessFlag, setSorenessFlag] = useState(false);
  const [injuryNote, setInjuryNote] = useState("");
  const [sorenessAreas, setSorenessAreas] = useState<string[]>([]);

  // Pitcher-specific: pitch type counts
  const [pitchCounts, setPitchCounts] = useState<Record<string, string>>({});

  // Fetch athletes with positions
  const { data: athletes = [] } = useQuery({
    queryKey: ["coach-athletes-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id, position")
        .eq("coach_user_id", user.id);
      if (!links?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", links.map((l) => l.athlete_user_id));
      return (profiles || []).map((p) => {
        const link = links.find((l) => l.athlete_user_id === p.user_id);
        return {
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`.trim(),
          position: (link?.position as Position) || null,
        };
      });
    },
    enabled: !!user,
  });

  const { data: baseballSportId } = useQuery({
    queryKey: ["baseball-sport-id"],
    queryFn: async () => {
      const { data } = await supabase.from("sports").select("id").eq("slug", "baseball").single();
      return data?.id || null;
    },
  });

  const selectedAthlete = athletes.find((a) => a.id === athleteId);
  const position = selectedAthlete?.position || null;

  // Compute total pitch count from individual pitch type counts
  const totalPitchCount = useMemo(() => {
    return Object.values(pitchCounts).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  }, [pitchCounts]);

  const updatePitchCount = (type: string, value: string) => {
    setPitchCounts((prev) => ({ ...prev, [type]: value }));
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !athleteId || !baseballSportId) throw new Error("Missing required fields");

      const finalPitchCount = position === "Pitcher" ? totalPitchCount : 0;

      // Build notes with pitch breakdown for pitchers
      let fullNotes = notes || "";
      if (position === "Pitcher" && totalPitchCount > 0) {
        const breakdown = Object.entries(pitchCounts)
          .filter(([, v]) => parseInt(v) > 0)
          .map(([type, count]) => `${type}: ${count}`)
          .join(", ");
        if (breakdown) {
          fullNotes = fullNotes
            ? `${fullNotes}\n\nPitch Breakdown: ${breakdown}`
            : `Pitch Breakdown: ${breakdown}`;
        }
      }

      const { error } = await supabase.from("training_sessions").insert({
        coach_id: user.id,
        athlete_id: athleteId,
        sport_id: baseballSportId,
        session_date: sessionDate,
        session_type: sessionType,
        status,
        duration_min: durationMin ? parseInt(durationMin) : null,
        pitch_count: finalPitchCount,
        throw_count: throwCount ? parseInt(throwCount) : 0,
        drill_reps: drillReps ? parseInt(drillReps) : 0,
        intensity,
        notes: fullNotes || null,
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
    setThrowCount("");
    setDrillReps("");
    setIntensity("medium");
    setNotes("");
    setSorenessFlag(false);
    setInjuryNote("");
    setSorenessAreas([]);
    setPitchCounts({});
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
              <Select value={athleteId} onValueChange={(v) => { setAthleteId(v); setPitchCounts({}); }}>
                <SelectTrigger><SelectValue placeholder="Select athlete" /></SelectTrigger>
                <SelectContent>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.name}{a.position ? ` · ${a.position}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {position && (
                <Badge variant="outline" className="text-xs">{position}</Badge>
              )}
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

          {/* Position-specific workload section */}
          {position === "Pitcher" && (
            <Card className="border-primary/20 bg-primary/5">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-sm font-['Space_Grotesk'] flex items-center justify-between">
                  Pitch Breakdown
                  <Badge variant="secondary" className="font-mono text-sm">
                    Total: {totalPitchCount}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {PITCH_TYPES.map((type) => (
                    <div key={type} className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{type}</Label>
                      <Input
                        type="number"
                        min={0}
                        placeholder="0"
                        value={pitchCounts[type] || ""}
                        onChange={(e) => updatePitchCount(type, e.target.value)}
                        className="h-8 text-sm"
                      />
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* General workload — adapts by position */}
          <div className="space-y-2">
            <Label className="text-sm font-medium">Workload</Label>
            <div className={`grid gap-4 ${position === "Pitcher" ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4"}`}>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                <Input type="number" min={0} placeholder="60" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
              </div>

              {position !== "Pitcher" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">
                    {position === "Catcher" ? "Throws to 2B" : position === "Outfielder" ? "Throws" : "Throw Count"}
                  </Label>
                  <Input type="number" min={0} placeholder="0" value={throwCount} onChange={(e) => setThrowCount(e.target.value)} />
                </div>
              )}

              {position === "Pitcher" && (
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Throw Count (warmup)</Label>
                  <Input type="number" min={0} placeholder="0" value={throwCount} onChange={(e) => setThrowCount(e.target.value)} />
                </div>
              )}

              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">
                  {position === "Hitter" ? "Swings / At-Bats" :
                   position === "Catcher" ? "Blocking Reps" :
                   position === "Infielder" ? "Fielding Reps" :
                   position === "Outfielder" ? "Fly Ball Reps" :
                   "Drill Reps"}
                </Label>
                <Input type="number" min={0} placeholder="0" value={drillReps} onChange={(e) => setDrillReps(e.target.value)} />
              </div>
            </div>
          </div>

          {/* Soreness */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Switch checked={sorenessFlag} onCheckedChange={(v) => { setSorenessFlag(v); if (!v) setSorenessAreas([]); }} />
              <Label>Athlete reported soreness / injury</Label>
            </div>
            {sorenessFlag && (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Injury / Soreness Details</Label>
                  <Input
                    placeholder={
                      position === "Pitcher" ? "e.g. Sore right shoulder, elbow tightness" :
                      position === "Catcher" ? "e.g. Sore knees, hip tightness" :
                      "e.g. Sore right shoulder"
                    }
                    value={injuryNote}
                    onChange={(e) => setInjuryNote(e.target.value)}
                  />
                </div>

                {/* Soreness area selector */}
                <div className="space-y-2">
                  <Label className="text-sm">Where is the soreness?</Label>
                  <div className="flex flex-wrap gap-2">
                    {SORENESS_AREAS.map((area) => {
                      const isSelected = sorenessAreas.includes(area);
                      return (
                        <Badge
                          key={area}
                          variant={isSelected ? "default" : "outline"}
                          className={`cursor-pointer text-xs transition-colors ${isSelected ? "" : "hover:bg-secondary"}`}
                          onClick={() =>
                            setSorenessAreas((prev) =>
                              isSelected ? prev.filter((a) => a !== area) : [...prev, area]
                            )
                          }
                        >
                          {area}
                        </Badge>
                      );
                    })}
                  </div>
                </div>

                {/* Stretching suggestions based on selected soreness areas */}
                {sorenessAreas.length > 0 && (
                  <Card className="border-amber-500/20 bg-amber-500/5">
                    <CardHeader className="pb-2 pt-3 px-4">
                      <CardTitle className="text-sm font-['Space_Grotesk']">
                        💪 Suggested Stretches & Recovery
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {sorenessAreas.map((area) => {
                        const stretches = STRETCHING_SUGGESTIONS[area];
                        if (!stretches) return null;
                        return (
                          <div key={area}>
                            <p className="text-xs font-semibold text-foreground mb-1.5">{area}</p>
                            <div className="space-y-1.5">
                              {stretches.map((s, idx) => (
                                <div key={idx} className="rounded-md border bg-background/50 px-3 py-2">
                                  <p className="text-sm font-medium">{s.name}</p>
                                  <p className="text-xs text-muted-foreground">{s.description}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        );
                      })}
                    </CardContent>
                  </Card>
                )}
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
