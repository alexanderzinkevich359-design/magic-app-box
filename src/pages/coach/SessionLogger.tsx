import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle, Users, User, CheckSquare, XSquare } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useSportConfigById } from "@/hooks/useSportConfig";

const SESSION_TYPES = ["practice", "lesson", "assessment", "conditioning"] as const;
const STATUSES = ["completed", "missed", "scheduled"] as const;

const RPE_LABELS: Record<number, { label: string; color: string }> = {
  1: { label: "Rest", color: "text-emerald-400" },
  2: { label: "Very Light", color: "text-emerald-400" },
  3: { label: "Light", color: "text-green-400" },
  4: { label: "Moderate", color: "text-green-400" },
  5: { label: "Moderate", color: "text-yellow-400" },
  6: { label: "Hard", color: "text-yellow-400" },
  7: { label: "Hard", color: "text-orange-400" },
  8: { label: "Very Hard", color: "text-orange-400" },
  9: { label: "Max Effort", color: "text-red-400" },
  10: { label: "All Out", color: "text-red-500" },
};

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

// ── Types ──────────────────────────────────────────────────────────────────────

type AthleteRow = {
  id: string;
  name: string;
  position: string | null;
  sport_id: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  memberIds: string[];
};

// ── Component ──────────────────────────────────────────────────────────────────

const SessionLogger = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // ── Tab state ────────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"individual" | "team">("individual");

  // ── Individual form state ────────────────────────────────────────────────────
  const [submitted, setSubmitted] = useState(false);
  const [athleteId, setAthleteId] = useState("");
  const [sessionDate, setSessionDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [sessionType, setSessionType] = useState<string>("practice");
  const [status, setStatus] = useState<string>("completed");
  const [durationMin, setDurationMin] = useState("");
  const [throwCount, setThrowCount] = useState("");
  const [drillReps, setDrillReps] = useState("");
  const [intensity, setIntensity] = useState<string>("5");
  const [notes, setNotes] = useState("");
  const [sorenessFlag, setSorenessFlag] = useState(false);
  const [injuryNote, setInjuryNote] = useState("");
  const [sorenessAreas, setSorenessAreas] = useState<string[]>([]);
  const [pitchCounts, setPitchCounts] = useState<Record<string, string>>({});

  // ── Team attendance state ─────────────────────────────────────────────────────
  const [taTeamId, setTaTeamId] = useState("");
  const [taDate, setTaDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [taType, setTaType] = useState<string>("practice");
  const [taDuration, setTaDuration] = useState("");
  const [taRpe, setTaRpe] = useState<string>("5");
  const [taNotes, setTaNotes] = useState("");
  // athleteId → "present" | "absent"
  const [attendance, setAttendance] = useState<Record<string, "present" | "absent">>({});
  const [taSubmitted, setTaSubmitted] = useState(false);

  // ── Shared data ───────────────────────────────────────────────────────────────

  const { data: athletes = [] } = useQuery<AthleteRow[]>({
    queryKey: ["coach-athletes-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id, position, sport_id")
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
          position: link?.position || null,
          sport_id: link?.sport_id || null,
        };
      });
    },
    enabled: !!user,
  });

  const { data: teams = [] } = useQuery<TeamOption[]>({
    queryKey: ["coach-teams-attendance", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: teamsData } = await (supabase as any)
        .from("teams")
        .select("id, name")
        .eq("coach_id", user.id);
      if (!teamsData?.length) return [];
      const { data: members } = await (supabase as any)
        .from("team_members")
        .select("team_id, athlete_user_id")
        .in("team_id", teamsData.map((t: any) => t.id));
      return teamsData.map((t: any) => ({
        id: t.id,
        name: t.name,
        memberIds: (members || [])
          .filter((m: any) => m.team_id === t.id)
          .map((m: any) => m.athlete_user_id as string),
      }));
    },
    enabled: !!user,
  });

  // ── Individual form derived ───────────────────────────────────────────────────

  const selectedAthlete = athletes.find((a) => a.id === athleteId);
  const position = selectedAthlete?.position || null;
  const { data: sportConfig } = useSportConfigById(selectedAthlete?.sport_id ?? null);
  const sessionCfg = sportConfig?.session_config;
  const isPitchCountPos = !!position && (sessionCfg?.pitchCountPositions ?? []).includes(position);
  const pitchTypes = sessionCfg?.pitchTypes ?? [];
  const hasPitchTypeUI = pitchTypes.length > 0 && isPitchCountPos;
  const effectiveThrowLabel = (position && sessionCfg?.throwLabelByPosition?.[position]) ?? sessionCfg?.throwLabel ?? null;
  const effectiveRepsLabel = (position && sessionCfg?.repsLabelByPosition?.[position]) ?? "Drill Reps";

  const totalPitchCount = useMemo(() => {
    return Object.values(pitchCounts).reduce((sum, v) => sum + (parseInt(v) || 0), 0);
  }, [pitchCounts]);

  const updatePitchCount = (type: string, value: string) => {
    setPitchCounts((prev) => ({ ...prev, [type]: value }));
  };

  // ── Team attendance derived ───────────────────────────────────────────────────

  // Roster: team members if team selected, else all athletes
  const taRoster: AthleteRow[] = useMemo(() => {
    if (taTeamId) {
      const team = teams.find((t) => t.id === taTeamId);
      if (team) {
        return athletes.filter((a) => team.memberIds.includes(a.id));
      }
    }
    return athletes;
  }, [taTeamId, teams, athletes]);

  // Initialise / extend attendance map when roster changes
  const ensureAttendance = (roster: AthleteRow[]) => {
    setAttendance((prev) => {
      const next = { ...prev };
      roster.forEach((a) => {
        if (!(a.id in next)) next[a.id] = "present";
      });
      return next;
    });
  };

  const handleTeamChange = (teamId: string) => {
    setTaTeamId(teamId);
    const team = teams.find((t) => t.id === teamId);
    const roster = team ? athletes.filter((a) => team.memberIds.includes(a.id)) : athletes;
    setAttendance({});
    ensureAttendance(roster);
  };

  // When roster first loads (no team selected), seed defaults
  useMemo(() => {
    if (!taTeamId && athletes.length > 0) {
      ensureAttendance(athletes);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [athletes.length]);

  const presentCount = taRoster.filter((a) => attendance[a.id] === "present").length;
  const absentCount = taRoster.length - presentCount;

  const markAll = (status: "present" | "absent") => {
    const next: Record<string, "present" | "absent"> = {};
    taRoster.forEach((a) => { next[a.id] = status; });
    setAttendance((prev) => ({ ...prev, ...next }));
  };

  const toggleAttendance = (id: string) => {
    setAttendance((prev) => ({
      ...prev,
      [id]: prev[id] === "present" ? "absent" : "present",
    }));
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !athleteId) throw new Error("Missing required fields");
      const finalPitchCount = isPitchCountPos ? totalPitchCount : 0;
      let fullNotes = notes || "";
      if (isPitchCountPos && totalPitchCount > 0) {
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
        sport_id: selectedAthlete?.sport_id ?? null,
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

  const taSubmitMut = useMutation({
    mutationFn: async () => {
      if (!user || taRoster.length === 0) throw new Error("No athletes to log");
      // First athlete's sport_id as the session's sport — acceptable approximation for team sessions
      const sportId = taRoster[0]?.sport_id ?? null;
      const rows = taRoster.map((a) => ({
        coach_id: user.id,
        athlete_id: a.id,
        sport_id: a.sport_id ?? sportId,
        session_date: taDate,
        session_type: taType,
        status: attendance[a.id] === "absent" ? "missed" : "completed",
        duration_min: taDuration ? parseInt(taDuration) : null,
        pitch_count: 0,
        throw_count: 0,
        drill_reps: 0,
        intensity: taRpe,
        notes: taNotes || null,
        soreness_flag: false,
        injury_note: null,
      }));
      const { error } = await supabase.from("training_sessions").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-snapshots"] });
      queryClient.invalidateQueries({ queryKey: ["detail-sessions"] });
      setTaSubmitted(true);
      toast({ title: `Attendance logged — ${presentCount} present, ${absentCount} absent.` });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Resets ────────────────────────────────────────────────────────────────────

  const resetForm = () => {
    setAthleteId("");
    setSessionDate(format(new Date(), "yyyy-MM-dd"));
    setSessionType("practice");
    setStatus("completed");
    setDurationMin("");
    setThrowCount("");
    setDrillReps("");
    setIntensity("5");
    setNotes("");
    setSorenessFlag(false);
    setInjuryNote("");
    setSorenessAreas([]);
    setPitchCounts({});
    setSubmitted(false);
  };

  const resetTeamForm = () => {
    setTaDate(format(new Date(), "yyyy-MM-dd"));
    setTaType("practice");
    setTaDuration("");
    setTaRpe("5");
    setTaNotes("");
    setAttendance({});
    ensureAttendance(taRoster);
    setTaSubmitted(false);
  };

  // ── Success screens ───────────────────────────────────────────────────────────

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

  if (taSubmitted) {
    return (
      <DashboardLayout role="coach">
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <div className="h-16 w-16 rounded-full bg-emerald-500/15 flex items-center justify-center mb-4">
            <CheckCircle className="h-8 w-8 text-emerald-400" />
          </div>
          <h2 className="text-2xl font-bold font-['Space_Grotesk'] mb-2">Attendance Logged!</h2>
          <p className="text-muted-foreground mb-6">
            {presentCount} present · {absentCount} absent
          </p>
          <div className="flex gap-3">
            <Button onClick={resetTeamForm}>Log Another</Button>
            <Button variant="outline" onClick={() => window.history.back()}>Back</Button>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="coach">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Log Training Session</h1>
        <p className="text-muted-foreground mt-1">Record attendance, workload, and athlete status</p>
      </div>

      {/* ── Tab switcher ── */}
      <div className="flex gap-1 mb-6 rounded-xl border bg-secondary/30 p-1 w-fit">
        <button
          onClick={() => setTab("individual")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "individual"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <User className="h-4 w-4" /> Individual
        </button>
        <button
          onClick={() => setTab("team")}
          className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            tab === "team"
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <Users className="h-4 w-4" /> Team Attendance
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════
          INDIVIDUAL TAB (existing form)
      ════════════════════════════════════════════════════════════ */}
      {tab === "individual" && (
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

            {/* Type & status */}
            <div className="grid grid-cols-2 gap-4">
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
            </div>

            {/* RPE Scale */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <Label>RPE (Rate of Perceived Exertion)</Label>
                <div className="flex items-center gap-2">
                  <span className={`text-lg font-bold font-['Space_Grotesk'] ${RPE_LABELS[parseInt(intensity)]?.color || ""}`}>
                    {intensity}
                  </span>
                  <span className={`text-xs ${RPE_LABELS[parseInt(intensity)]?.color || "text-muted-foreground"}`}>
                    {RPE_LABELS[parseInt(intensity)]?.label || ""}
                  </span>
                </div>
              </div>
              <Slider
                value={[parseInt(intensity)]}
                onValueChange={(v) => setIntensity(String(v[0]))}
                min={1} max={10} step={1}
                className="w-full"
              />
              <div className="flex justify-between text-[10px] text-muted-foreground px-1">
                <span>1 - Rest</span>
                <span>5 - Moderate</span>
                <span>10 - All Out</span>
              </div>
            </div>

            {/* Pitch/serve breakdown (sport config driven) */}
            {hasPitchTypeUI && (
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
                    {pitchTypes.map((type) => (
                      <div key={type} className="space-y-1">
                        <Label className="text-xs text-muted-foreground">{type}</Label>
                        <Input
                          type="number" min={0} placeholder="0"
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

            {/* General workload */}
            {athleteId && (
              <div className="space-y-2">
                <Label className="text-sm font-medium">
                  Workload {position && <span className="text-xs text-muted-foreground font-normal ml-1">({position})</span>}
                </Label>
                <div className="grid gap-4 grid-cols-2 sm:grid-cols-3">
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">Duration (min)</Label>
                    <Input type="number" min={0} placeholder="60" value={durationMin} onChange={(e) => setDurationMin(e.target.value)} />
                  </div>
                  {effectiveThrowLabel !== null && (
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">{effectiveThrowLabel}</Label>
                      <Input type="number" min={0} placeholder="0" value={throwCount} onChange={(e) => setThrowCount(e.target.value)} />
                    </div>
                  )}
                  <div className="space-y-1">
                    <Label className="text-xs text-muted-foreground">{effectiveRepsLabel}</Label>
                    <Input type="number" min={0} placeholder="0" value={drillReps} onChange={(e) => setDrillReps(e.target.value)} />
                  </div>
                </div>
              </div>
            )}

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
                      placeholder="e.g. Describe any soreness or discomfort"
                      value={injuryNote}
                      onChange={(e) => setInjuryNote(e.target.value)}
                    />
                  </div>
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
      )}

      {/* ════════════════════════════════════════════════════════════
          TEAM ATTENDANCE TAB
      ════════════════════════════════════════════════════════════ */}
      {tab === "team" && (
        <div className="max-w-2xl space-y-4">
          {/* Session details card */}
          <Card>
            <CardContent className="p-6 space-y-5">
              {/* Team selector (only if coach has teams) */}
              {teams.length > 0 && (
                <div className="space-y-2">
                  <Label>Team</Label>
                  <Select value={taTeamId} onValueChange={handleTeamChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="All athletes (no team filter)" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Date + type row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Date</Label>
                  <Input type="date" value={taDate} onChange={(e) => setTaDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>Session Type</Label>
                  <Select value={taType} onValueChange={setTaType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SESSION_TYPES.map((t) => (
                        <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Duration + RPE row */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Duration (min, optional)</Label>
                  <Input type="number" min={0} placeholder="90" value={taDuration} onChange={(e) => setTaDuration(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Group RPE</Label>
                    <span className={`text-sm font-bold font-['Space_Grotesk'] ${RPE_LABELS[parseInt(taRpe)]?.color || ""}`}>
                      {taRpe} — {RPE_LABELS[parseInt(taRpe)]?.label}
                    </span>
                  </div>
                  <Slider
                    value={[parseInt(taRpe)]}
                    onValueChange={(v) => setTaRpe(String(v[0]))}
                    min={1} max={10} step={1}
                    className="w-full"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label>Session Notes (optional)</Label>
                <Textarea
                  placeholder="General notes for this session..."
                  value={taNotes}
                  onChange={(e) => setTaNotes(e.target.value)}
                  className="min-h-[60px]"
                />
              </div>
            </CardContent>
          </Card>

          {/* Attendance roster card */}
          <Card>
            <CardHeader className="pb-3 pt-4 px-5">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-['Space_Grotesk'] flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    Attendance
                    {taRoster.length > 0 && (
                      <span className="text-xs font-normal text-muted-foreground">
                        ({taRoster.length} athletes)
                      </span>
                    )}
                  </CardTitle>
                  {taRoster.length > 0 && (
                    <p className="text-xs text-muted-foreground mt-0.5">
                      <span className="text-emerald-400 font-medium">{presentCount} present</span>
                      {absentCount > 0 && (
                        <> · <span className="text-red-400 font-medium">{absentCount} absent</span></>
                      )}
                    </p>
                  )}
                </div>
                {taRoster.length > 0 && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => markAll("present")}
                      className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 border border-emerald-500/30 rounded-lg px-2.5 py-1.5 hover:bg-emerald-500/10 transition-colors"
                    >
                      <CheckSquare className="h-3.5 w-3.5" /> All Present
                    </button>
                    <button
                      onClick={() => markAll("absent")}
                      className="flex items-center gap-1 text-xs text-muted-foreground hover:text-red-400 border border-border rounded-lg px-2.5 py-1.5 hover:bg-red-500/10 hover:border-red-500/30 transition-colors"
                    >
                      <XSquare className="h-3.5 w-3.5" /> All Absent
                    </button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="px-5 pb-5">
              {taRoster.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {teams.length > 0 ? "Select a team above, or add athletes to a team." : "No athletes linked yet."}
                </p>
              ) : (
                <div className="rounded-xl border divide-y overflow-hidden">
                  {taRoster.map((a) => {
                    const isPresent = attendance[a.id] !== "absent";
                    return (
                      <div
                        key={a.id}
                        className={`flex items-center gap-3 px-4 py-3 transition-colors ${
                          isPresent ? "bg-background" : "bg-secondary/30"
                        }`}
                      >
                        {/* Avatar */}
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                          isPresent
                            ? "bg-emerald-500/15 text-emerald-400"
                            : "bg-secondary text-muted-foreground"
                        }`}>
                          {a.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()}
                        </div>

                        {/* Name + position */}
                        <div className="flex-1 min-w-0">
                          <p className={`text-sm font-medium truncate ${!isPresent ? "text-muted-foreground line-through" : ""}`}>
                            {a.name}
                          </p>
                          {a.position && (
                            <p className="text-[11px] text-muted-foreground">{a.position}</p>
                          )}
                        </div>

                        {/* Toggle button */}
                        <button
                          onClick={() => toggleAttendance(a.id)}
                          className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold border transition-all ${
                            isPresent
                              ? "bg-emerald-500/15 border-emerald-500/40 text-emerald-400 hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-400"
                              : "bg-secondary border-border text-muted-foreground hover:bg-emerald-500/10 hover:border-emerald-500/30 hover:text-emerald-400"
                          }`}
                        >
                          {isPresent ? "✓ Present" : "✗ Absent"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {taRoster.length > 0 && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Tap a name to toggle present / absent
                  </p>
                  <Button
                    onClick={() => taSubmitMut.mutate()}
                    disabled={taRoster.length === 0 || !taDate || taSubmitMut.isPending}
                  >
                    {taSubmitMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    Log Attendance ({presentCount} present)
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default SessionLogger;
