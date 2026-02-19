import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Users, Loader2, AlertTriangle, TrendingUp, Calendar, Target,
  StickyNote, Plus, ChevronRight, Activity, Heart, Clock
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

type AthleteSnapshot = {
  athlete_id: string;
  name: string;
  avatar_url: string | null;
  date_of_birth: string | null;
  position: string | null;
  sport_id: string | null;
  training_status: string;
  status_color: string;
  attendance_pct: number | null;
  sessions_this_week: number;
  weekly_pitch_count: number;
  last_session_date: string | null;
  next_session: { date: string; time: string | null; title: string } | null;
  soreness_flag: boolean;
  injury_note: string | null;
  latest_note: { text: string; tag: string | null; date: string } | null;
  active_goals: number;
  total_sessions: number;
};

const NOTE_TAGS = ["mechanics", "mindset", "effort", "injury"] as const;

const STATUS_STYLES: Record<string, string> = {
  green: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  yellow: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  orange: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  red: "bg-red-500/15 text-red-400 border-red-500/30",
};

const CoachDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteTag, setNoteTag] = useState<string>("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  // Fetch snapshots from edge function
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["athlete-snapshots", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("athlete-snapshot");
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return (data?.athletes || []) as AthleteSnapshot[];
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  const selected = snapshots.find((s) => s.athlete_id === selectedId) || null;

  // Fetch notes & goals for selected athlete
  const { data: detailNotes = [] } = useQuery({
    queryKey: ["detail-notes", selectedId, user?.id],
    queryFn: async () => {
      if (!user || !selectedId) return [];
      const { data } = await supabase
        .from("coach_notes")
        .select("*")
        .eq("coach_id", user.id)
        .eq("athlete_id", selectedId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedId && !!user,
  });

  const { data: detailGoals = [] } = useQuery({
    queryKey: ["detail-goals", selectedId, user?.id],
    queryFn: async () => {
      if (!user || !selectedId) return [];
      const { data } = await supabase
        .from("athlete_goals")
        .select("*")
        .eq("coach_id", user.id)
        .eq("athlete_id", selectedId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!selectedId && !!user,
  });

  // Recent sessions for selected athlete
  const { data: detailSessions = [] } = useQuery({
    queryKey: ["detail-sessions", selectedId, user?.id],
    queryFn: async () => {
      if (!user || !selectedId) return [];
      const { data } = await supabase
        .from("training_sessions")
        .select("*")
        .eq("coach_id", user.id)
        .eq("athlete_id", selectedId)
        .order("session_date", { ascending: false })
        .limit(10);
      return data || [];
    },
    enabled: !!selectedId && !!user,
  });

  // Mutations
  const addNoteMut = useMutation({
    mutationFn: async () => {
      if (!user || !selectedId || !noteText.trim()) return;
      const { error } = await supabase.from("coach_notes").insert({
        coach_id: user.id,
        athlete_id: selectedId,
        note: noteText.trim(),
        tag: noteTag || null,
        is_private: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText(""); setNoteTag("");
      queryClient.invalidateQueries({ queryKey: ["detail-notes"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-snapshots"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addGoalMut = useMutation({
    mutationFn: async () => {
      if (!user || !selectedId) return;
      const activeGoals = detailGoals.filter((g) => !g.completed_at).length;
      if (activeGoals >= 3) throw new Error("Max 3 active goals per athlete");
      const { error } = await supabase.from("athlete_goals").insert({
        coach_id: user.id,
        athlete_id: selectedId,
        title: goalTitle.trim(),
        target: goalTarget.trim(),
        deadline: goalDeadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGoalTitle(""); setGoalTarget(""); setGoalDeadline(""); setShowGoalForm(false);
      queryClient.invalidateQueries({ queryKey: ["detail-goals"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-snapshots"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateProgressMut = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const { error } = await supabase.from("athlete_goals").update({ progress: Math.min(100, Math.max(0, progress)) }).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["detail-goals"] }),
  });

  // Summary stats
  const onTrack = snapshots.filter((s) => s.status_color === "green").length;
  const needsAttention = snapshots.filter((s) => s.status_color === "yellow" || s.status_color === "orange").length;
  const injured = snapshots.filter((s) => s.soreness_flag).length;

  return (
    <DashboardLayout role="coach">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Athlete Snapshots</h1>
        <p className="text-muted-foreground mt-1">Assess athlete status at a glance — tap a card for details</p>
      </div>

      {/* Summary strip */}
      <div className="grid gap-3 grid-cols-2 md:grid-cols-4 mb-8">
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Users className="h-5 w-5 text-primary" />
          <div><p className="text-2xl font-bold font-['Space_Grotesk']">{snapshots.length}</p><p className="text-xs text-muted-foreground">Athletes</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <TrendingUp className="h-5 w-5 text-emerald-400" />
          <div><p className="text-2xl font-bold font-['Space_Grotesk']">{onTrack}</p><p className="text-xs text-muted-foreground">On Track</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400" />
          <div><p className="text-2xl font-bold font-['Space_Grotesk']">{needsAttention}</p><p className="text-xs text-muted-foreground">Needs Attention</p></div>
        </CardContent></Card>
        <Card><CardContent className="p-4 flex items-center gap-3">
          <Heart className="h-5 w-5 text-red-400" />
          <div><p className="text-2xl font-bold font-['Space_Grotesk']">{injured}</p><p className="text-xs text-muted-foreground">Injured / Sore</p></div>
        </CardContent></Card>
      </div>

      {/* Athlete cards */}
      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : snapshots.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="font-semibold text-lg">No athletes linked</h3>
          <p className="text-muted-foreground text-sm mt-1">Add athletes from the Athletes page to see their snapshots here.</p>
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {snapshots.map((athlete) => (
            <Card
              key={athlete.athlete_id}
              className="cursor-pointer transition-all hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              onClick={() => setSelectedId(athlete.athlete_id)}
            >
              <CardContent className="p-5 space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="h-11 w-11 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm shrink-0">
                      {athlete.avatar_url ? (
                        <img src={athlete.avatar_url} alt="" className="h-full w-full rounded-full object-cover" />
                      ) : (
                        athlete.name.split(" ").map((n) => n[0]).join("")
                      )}
                    </div>
                    <div>
                      <p className="font-medium leading-tight">{athlete.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {athlete.position || "No position"} · Baseball
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] shrink-0 ${STATUS_STYLES[athlete.status_color] || STATUS_STYLES.yellow}`}>
                    {athlete.training_status}
                  </Badge>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-lg bg-secondary/50 p-2">
                    <p className="text-lg font-bold font-['Space_Grotesk']">{athlete.attendance_pct ?? "—"}%</p>
                    <p className="text-[10px] text-muted-foreground">Attendance</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-2">
                    <p className="text-lg font-bold font-['Space_Grotesk']">{athlete.sessions_this_week}</p>
                    <p className="text-[10px] text-muted-foreground">This Week</p>
                  </div>
                  <div className="rounded-lg bg-secondary/50 p-2">
                    <p className="text-lg font-bold font-['Space_Grotesk']">{athlete.active_goals}</p>
                    <p className="text-[10px] text-muted-foreground">Goals</p>
                  </div>
                </div>

                {/* Flags & info */}
                <div className="space-y-1.5 text-xs">
                  {athlete.soreness_flag && (
                    <div className="flex items-center gap-2 text-red-400">
                      <Heart className="h-3 w-3" />
                      <span>{athlete.injury_note || "Soreness reported"}</span>
                    </div>
                  )}
                  {athlete.last_session_date && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Clock className="h-3 w-3" />
                      <span>Last session: {format(new Date(athlete.last_session_date), "MMM d")}</span>
                    </div>
                  )}
                  {athlete.next_session && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      <span>Next: {format(new Date(athlete.next_session.date), "MMM d")}
                        {athlete.next_session.time && ` at ${athlete.next_session.time.slice(0, 5)}`}
                      </span>
                    </div>
                  )}
                  {athlete.latest_note && (
                    <div className="flex items-start gap-2 text-muted-foreground">
                      <StickyNote className="h-3 w-3 mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{athlete.latest_note.text}</span>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelectedId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selected && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-3">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {selected.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <DialogTitle className="font-['Space_Grotesk'] text-xl">{selected.name}</DialogTitle>
                    <DialogDescription>
                      {selected.position || "No position"} · Baseball
                      <Badge variant="outline" className={`ml-2 text-[10px] ${STATUS_STYLES[selected.status_color] || ""}`}>
                        {selected.training_status}
                      </Badge>
                    </DialogDescription>
                  </div>
                </div>
              </DialogHeader>

              {/* Quick stats bar */}
              <div className="grid grid-cols-4 gap-2 my-4">
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-xl font-bold font-['Space_Grotesk']">{selected.attendance_pct ?? "—"}%</p>
                  <p className="text-[10px] text-muted-foreground">Attendance</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-xl font-bold font-['Space_Grotesk']">{selected.sessions_this_week}</p>
                  <p className="text-[10px] text-muted-foreground">Sessions/Wk</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-xl font-bold font-['Space_Grotesk']">{selected.weekly_pitch_count}</p>
                  <p className="text-[10px] text-muted-foreground">Pitches/Wk</p>
                </div>
                <div className="rounded-lg bg-secondary/50 p-3 text-center">
                  <p className="text-xl font-bold font-['Space_Grotesk']">{selected.total_sessions}</p>
                  <p className="text-[10px] text-muted-foreground">Total (4wk)</p>
                </div>
              </div>

              {selected.soreness_flag && (
                <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 flex items-center gap-2 text-sm text-red-400">
                  <Heart className="h-4 w-4" />
                  <span className="font-medium">Injury/Soreness:</span>
                  <span>{selected.injury_note || "Soreness reported in recent session"}</span>
                </div>
              )}

              <Tabs defaultValue="sessions" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="sessions" className="flex-1 gap-1.5"><Activity className="h-3.5 w-3.5" /> Sessions</TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1 gap-1.5"><StickyNote className="h-3.5 w-3.5" /> Notes</TabsTrigger>
                  <TabsTrigger value="goals" className="flex-1 gap-1.5"><Target className="h-3.5 w-3.5" /> Goals</TabsTrigger>
                </TabsList>

                {/* Sessions tab */}
                <TabsContent value="sessions" className="mt-4 space-y-2">
                  {detailSessions.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No sessions logged yet.</p>
                  ) : (
                    detailSessions.map((s: any) => (
                      <div key={s.id} className="rounded-lg border p-3 flex items-center justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-medium">{format(new Date(s.session_date), "MMM d, yyyy")}</p>
                            <Badge variant="outline" className={`text-[10px] ${
                              s.status === "completed" ? "text-emerald-400 border-emerald-500/30"
                              : s.status === "missed" ? "text-red-400 border-red-500/30"
                              : "text-muted-foreground"
                            }`}>{s.status}</Badge>
                            {s.soreness_flag && <Heart className="h-3 w-3 text-red-400" />}
                          </div>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {s.session_type} · {s.duration_min ? `${s.duration_min}min` : "—"} · {s.pitch_count || 0} pitches
                          </p>
                        </div>
                        <div className="text-right text-xs text-muted-foreground">
                          <p>{s.intensity} intensity</p>
                        </div>
                      </div>
                    ))
                  )}
                </TabsContent>

                {/* Notes tab */}
                <TabsContent value="notes" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Select value={noteTag} onValueChange={setNoteTag}>
                        <SelectTrigger className="w-32">
                          <SelectValue placeholder="Tag" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No tag</SelectItem>
                          {NOTE_TAGS.map((t) => (
                            <SelectItem key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      placeholder="Write a private note..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="min-h-[70px]"
                    />
                    <Button onClick={() => addNoteMut.mutate()} disabled={!noteText.trim() || addNoteMut.isPending} size="sm">
                      {addNoteMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Add Note
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {detailNotes.map((note: any) => (
                      <div key={note.id} className="rounded-lg border bg-secondary/30 p-3">
                        <div className="flex items-center gap-2 mb-1">
                          {note.tag && (
                            <Badge variant="outline" className="text-[10px]">{note.tag}</Badge>
                          )}
                          <span className="text-[10px] text-muted-foreground">{format(new Date(note.created_at), "MMM d, yyyy")}</span>
                        </div>
                        <p className="text-sm">{note.note}</p>
                      </div>
                    ))}
                    {detailNotes.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No notes yet.</p>
                    )}
                  </div>
                </TabsContent>

                {/* Goals tab */}
                <TabsContent value="goals" className="mt-4 space-y-4">
                  {!showGoalForm ? (
                    <Button
                      onClick={() => setShowGoalForm(true)}
                      size="sm"
                      variant="outline"
                      disabled={detailGoals.filter((g: any) => !g.completed_at).length >= 3}
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Set Goal {detailGoals.filter((g: any) => !g.completed_at).length >= 3 && "(max 3)"}
                    </Button>
                  ) : (
                    <Card><CardContent className="p-4 space-y-3">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Goal Title</Label>
                          <Input placeholder="e.g. Exit velocity" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Target</Label>
                          <Input placeholder="e.g. 85 mph" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">Deadline</Label>
                        <Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
                      </div>
                      <div className="flex gap-2">
                        <Button onClick={() => addGoalMut.mutate()} size="sm" disabled={!goalTitle.trim() || !goalTarget.trim() || addGoalMut.isPending}>
                          {addGoalMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                          Save
                        </Button>
                        <Button onClick={() => setShowGoalForm(false)} size="sm" variant="ghost">Cancel</Button>
                      </div>
                    </CardContent></Card>
                  )}
                  <div className="space-y-2">
                    {detailGoals.map((goal: any) => (
                      <div key={goal.id} className="rounded-lg border p-3 space-y-2">
                        <div className="flex items-start justify-between">
                          <div>
                            <p className="font-medium text-sm">{goal.title}</p>
                            <p className="text-xs text-muted-foreground">Target: {goal.target} · {goal.deadline || "No deadline"}</p>
                          </div>
                          <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                        </div>
                        <Progress value={goal.progress} className="h-2" />
                        <div className="flex items-center gap-2">
                          <Input
                            type="number" min={0} max={100}
                            value={goal.progress}
                            onChange={(e) => updateProgressMut.mutate({ goalId: goal.id, progress: parseInt(e.target.value) || 0 })}
                            className="w-20 h-7 text-xs"
                          />
                          <span className="text-[10px] text-muted-foreground">%</span>
                        </div>
                      </div>
                    ))}
                    {detailGoals.length === 0 && (
                      <p className="text-sm text-muted-foreground text-center py-4">No goals set yet.</p>
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachDashboard;
