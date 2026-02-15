import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, StickyNote, Target, ChevronRight, Loader2, Sparkles, Dumbbell, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const POSITIONS = ["Pitcher", "Catcher", "Infielder", "Outfielder", "Hitter"] as const;
type Position = typeof POSITIONS[number];

const POSITION_METRICS: Record<Position, { label: string; key: string; unit: string }[]> = {
  Pitcher: [
    { label: "Fastball Velocity (mph)", key: "fastball_velocity", unit: "mph" },
    { label: "Pitch Count (weekly avg)", key: "pitch_count_avg", unit: "pitches" },
    { label: "ERA", key: "era", unit: "" },
    { label: "Strikeout Rate (%)", key: "strikeout_rate", unit: "%" },
  ],
  Catcher: [
    { label: "Pop Time (sec)", key: "pop_time", unit: "sec" },
    { label: "Framing Rate (%)", key: "framing_rate", unit: "%" },
    { label: "Blocking Percentage (%)", key: "blocking_pct", unit: "%" },
    { label: "Throw Velocity (mph)", key: "throw_velocity", unit: "mph" },
  ],
  Infielder: [
    { label: "Fielding Percentage (%)", key: "fielding_pct", unit: "%" },
    { label: "Range Factor", key: "range_factor", unit: "" },
    { label: "Double Play Turns", key: "dp_turns", unit: "" },
    { label: "Throw Velocity (mph)", key: "throw_velocity", unit: "mph" },
  ],
  Outfielder: [
    { label: "Sprint Speed (ft/s)", key: "sprint_speed", unit: "ft/s" },
    { label: "Route Efficiency (%)", key: "route_efficiency", unit: "%" },
    { label: "Throw Accuracy (%)", key: "throw_accuracy", unit: "%" },
    { label: "Arm Strength (mph)", key: "arm_strength", unit: "mph" },
  ],
  Hitter: [
    { label: "Exit Velocity (mph)", key: "exit_velocity", unit: "mph" },
    { label: "Bat Speed (mph)", key: "bat_speed", unit: "mph" },
    { label: "Batting Average", key: "batting_avg", unit: "" },
    { label: "On-Base Percentage", key: "obp", unit: "" },
  ],
};

type AthleteWithDetails = {
  id: string;
  athlete_user_id: string;
  sport_id: string;
  position?: string;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
  notes: { id: string; note: string; created_at: string }[];
  goals: { id: string; title: string; target: string; progress: number; deadline: string | null; completed_at: string | null }[];
};

const CoachAthletes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Dialog states
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAthlete, setSelectedAthlete] = useState<AthleteWithDetails | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showAiPlan, setShowAiPlan] = useState(false);

  // Add athlete form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPosition, setNewPosition] = useState<Position | "">("");
  const [positionMetrics, setPositionMetrics] = useState<Record<string, string>>({});

  // Note form
  const [noteText, setNoteText] = useState("");

  // Goal form
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  // AI recommendation
  const [aiPlan, setAiPlan] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Fetch athletes linked to this coach
  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["coach-athletes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links, error } = await supabase
        .from("coach_athlete_links")
        .select("id, athlete_user_id, sport_id")
        .eq("coach_user_id", user.id);
      if (error) throw error;
      if (!links?.length) return [];

      const athleteIds = links.map((l) => l.athlete_user_id);
      const [profilesRes, notesRes, goalsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", athleteIds),
        supabase.from("coach_notes").select("id, athlete_id, note, created_at").eq("coach_id", user.id).in("athlete_id", athleteIds).order("created_at", { ascending: false }),
        supabase.from("athlete_goals").select("id, athlete_id, title, target, progress, deadline, completed_at").in("athlete_id", athleteIds),
      ]);

      return links.map((link) => ({
        id: link.id,
        athlete_user_id: link.athlete_user_id,
        sport_id: link.sport_id || "",
        profile: profilesRes.data?.find((p) => p.user_id === link.athlete_user_id) || null,
        notes: notesRes.data?.filter((n) => n.athlete_id === link.athlete_user_id) || [],
        goals: goalsRes.data?.filter((g) => g.athlete_id === link.athlete_user_id) || [],
      })) as AthleteWithDetails[];
    },
    enabled: !!user,
  });

  // Add note mutation
  const addNoteMutation = useMutation({
    mutationFn: async ({ athleteId, note }: { athleteId: string; note: string }) => {
      const { error } = await supabase.from("coach_notes").insert({
        coach_id: user!.id,
        athlete_id: athleteId,
        note,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setNoteText("");
      toast({ title: "Note added" });
    },
  });

  // Add goal mutation
  const addGoalMutation = useMutation({
    mutationFn: async ({ athleteId, title, target, deadline }: { athleteId: string; title: string; target: string; deadline: string }) => {
      const { error } = await supabase.from("athlete_goals").insert({
        athlete_id: athleteId,
        coach_id: user!.id,
        title,
        target,
        deadline: deadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setGoalTitle("");
      setGoalTarget("");
      setGoalDeadline("");
      setShowGoalForm(false);
      toast({ title: "Goal set" });
    },
  });

  // Update goal progress
  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const { error } = await supabase.from("athlete_goals").update({ progress }).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-athletes"] }),
  });

  // AI recommend
  const getAiRecommendation = async () => {
    if (!selectedAthlete) return;
    setAiLoading(true);
    setShowAiPlan(true);
    try {
      const { data, error } = await supabase.functions.invoke("recommend-workout", {
        body: {
          position: newPosition || "Hitter",
          goals: selectedAthlete.goals.map((g) => ({ title: g.title, target: g.target, progress: g.progress })),
          metrics: positionMetrics,
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiPlan(data.plan);
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(false);
    }
  };

  // Create program from AI plan
  const createFromAiPlan = useMutation({
    mutationFn: async () => {
      if (!aiPlan || !user) throw new Error("No plan");
      // Look up baseball sport id
      const { data: sportData } = await supabase.from("sports").select("id").eq("slug", "baseball").single();
      const sportId = sportData?.id;
      if (!sportId) throw new Error("Baseball sport not found");

      // Create program
      const { data: program, error: progErr } = await supabase
        .from("programs")
        .insert({
          coach_id: user.id,
          sport_id: sportId,
          name: aiPlan.plan_name,
          description: aiPlan.description,
          duration_weeks: aiPlan.duration_weeks,
          skill_level: "intermediate",
        })
        .select("id")
        .single();
      if (progErr) throw progErr;

      // Create workouts and drills
      for (let i = 0; i < aiPlan.workouts.length; i++) {
        const w = aiPlan.workouts[i];
        const { data: workout, error: wErr } = await supabase
          .from("workouts")
          .insert({
            program_id: program.id,
            title: w.title,
            description: w.description,
            order_index: i,
          })
          .select("id")
          .single();
        if (wErr) throw wErr;

        for (let j = 0; j < w.drills.length; j++) {
          const d = w.drills[j];
          await supabase.from("drills").insert({
            workout_id: workout.id,
            name: d.name,
            rep_scheme: d.rep_scheme,
            skill_category: d.skill_category,
            equipment: d.equipment,
            coaching_cues: d.coaching_cues,
            difficulty: d.difficulty,
            order_index: j,
          });
        }
      }

      return program.id;
    },
    onSuccess: (programId) => {
      toast({ title: "Program created from AI plan!" });
      setShowAiPlan(false);
      setAiPlan(null);
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const resetAddForm = () => {
    setNewFirstName("");
    setNewLastName("");
    setNewEmail("");
    setNewPosition("");
    setPositionMetrics({});
    setShowAddDialog(false);
  };

  // Placeholder: In a real app, you'd look up the athlete by email.
  // For now, we create a coach_athlete_link manually (requires athlete to already exist).
  const addAthleteByEmail = useMutation({
    mutationFn: async () => {
      if (!user || !newEmail || !newPosition) throw new Error("Missing fields");
      // Find athlete user by email via profiles (simplified approach)
      const { data: authUsers } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .or(`first_name.ilike.%${newFirstName}%,last_name.ilike.%${newLastName}%`);

      // For MVP, just link by looking up user via a simplified search
      // In production, you'd use invite codes or email-based lookup
      if (!authUsers?.length) throw new Error("Athlete not found. They need to create an account first.");

      const athleteUser = authUsers[0];
      const { data: sportData } = await supabase.from("sports").select("id").eq("slug", "baseball").single();

      const { error } = await supabase.from("coach_athlete_links").insert({
        coach_user_id: user.id,
        athlete_user_id: athleteUser.user_id,
        sport_id: sportData?.id || null,
      });
      if (error) throw error;

      // Store initial metrics if any
      if (sportData?.id && Object.keys(positionMetrics).length > 0) {
        const metricInserts = Object.entries(positionMetrics)
          .filter(([, v]) => v)
          .map(([key, value]) => ({
            athlete_id: athleteUser.user_id,
            sport_id: sportData.id,
            metric_type: key,
            metric_category: newPosition,
            value: parseFloat(value) || 0,
            recorded_by: user.id,
          }));
        if (metricInserts.length > 0) {
          await supabase.from("athlete_metrics").insert(metricInserts);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      resetAddForm();
      toast({ title: "Athlete linked!" });
    },
    onError: (e: any) => {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    },
  });

  const openAthleteDetail = (athlete: AthleteWithDetails) => {
    setSelectedAthlete(athlete);
    setShowAiPlan(false);
    setAiPlan(null);
  };

  return (
    <DashboardLayout role="coach">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Athletes</h1>
          <p className="text-muted-foreground mt-1">Manage your roster, set goals, and get AI recommendations</p>
        </div>
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Athlete
        </Button>
      </div>

      {/* Athlete list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : athletes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No athletes yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Link athletes to your roster to start coaching</p>
            <Button onClick={() => setShowAddDialog(true)}>
              <Plus className="h-4 w-4 mr-2" /> Add Athlete
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {athletes.map((athlete) => (
                <button
                  key={athlete.id}
                  onClick={() => openAthleteDetail(athlete)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
                >
                  <div className="flex items-center gap-4">
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {athlete.profile ? `${athlete.profile.first_name[0]}${athlete.profile.last_name[0]}` : "??"}
                    </div>
                    <div>
                      <p className="font-medium">
                        {athlete.profile ? `${athlete.profile.first_name} ${athlete.profile.last_name}` : "Unknown"}
                      </p>
                      <p className="text-sm text-muted-foreground">Baseball</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">
                        {athlete.notes.length} notes · {athlete.goals.length} goals
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Add Athlete Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && resetAddForm()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Add Athlete</DialogTitle>
            <DialogDescription>Link an existing athlete to your roster</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>First Name</Label>
                <Input placeholder="John" value={newFirstName} onChange={(e) => setNewFirstName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Last Name</Label>
                <Input placeholder="Doe" value={newLastName} onChange={(e) => setNewLastName(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Email</Label>
              <Input type="email" placeholder="athlete@email.com" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Sport</Label>
              <Input value="Baseball" disabled className="bg-muted" />
            </div>
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={newPosition} onValueChange={(v) => { setNewPosition(v as Position); setPositionMetrics({}); }}>
                <SelectTrigger>
                  <SelectValue placeholder="Select position..." />
                </SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => (
                    <SelectItem key={p} value={p}>{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Position-specific metrics */}
            {newPosition && (
              <div className="space-y-3 p-4 rounded-lg border bg-secondary/30">
                <p className="text-sm font-medium">{newPosition} Metrics</p>
                <div className="grid grid-cols-2 gap-3">
                  {POSITION_METRICS[newPosition as Position].map((metric) => (
                    <div key={metric.key} className="space-y-1">
                      <Label className="text-xs">{metric.label}</Label>
                      <Input
                        type="number"
                        step="any"
                        placeholder={metric.unit || "Value"}
                        value={positionMetrics[metric.key] || ""}
                        onChange={(e) => setPositionMetrics((prev) => ({ ...prev, [metric.key]: e.target.value }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetAddForm}>Cancel</Button>
            <Button
              onClick={() => addAthleteByEmail.mutate()}
              disabled={!newPosition || !newFirstName || addAthleteByEmail.isPending}
            >
              {addAthleteByEmail.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Athlete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Athlete Detail Dialog */}
      <Dialog open={!!selectedAthlete} onOpenChange={(open) => { if (!open) { setSelectedAthlete(null); setShowAiPlan(false); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAthlete && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Space_Grotesk'] text-xl">
                  {selectedAthlete.profile ? `${selectedAthlete.profile.first_name} ${selectedAthlete.profile.last_name}` : "Athlete"}
                </DialogTitle>
                <DialogDescription>Baseball · {selectedAthlete.goals.length} goals · {selectedAthlete.notes.length} notes</DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="goals" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="goals" className="flex-1 gap-2">
                    <Target className="h-3.5 w-3.5" /> Goals
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1 gap-2">
                    <StickyNote className="h-3.5 w-3.5" /> Notes
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex-1 gap-2">
                    <Sparkles className="h-3.5 w-3.5" /> AI Plan
                  </TabsTrigger>
                </TabsList>

                {/* Goals Tab */}
                <TabsContent value="goals" className="space-y-4 mt-4">
                  {!showGoalForm ? (
                    <Button onClick={() => setShowGoalForm(true)} size="sm" variant="outline">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Set New Goal
                    </Button>
                  ) : (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Goal Title</Label>
                            <Input placeholder="e.g. Increase exit velocity" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target</Label>
                            <Input placeholder="e.g. 90 mph" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Deadline</Label>
                          <Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => addGoalMutation.mutate({
                              athleteId: selectedAthlete.athlete_user_id,
                              title: goalTitle,
                              target: goalTarget,
                              deadline: goalDeadline,
                            })}
                            size="sm"
                            disabled={!goalTitle.trim() || !goalTarget.trim() || addGoalMutation.isPending}
                          >
                            {addGoalMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                            Save Goal
                          </Button>
                          <Button onClick={() => setShowGoalForm(false)} size="sm" variant="ghost">Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <div className="space-y-3">
                    {selectedAthlete.goals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No goals set. Create one above.</p>
                    ) : (
                      selectedAthlete.goals.map((goal) => (
                        <div key={goal.id} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{goal.title}</p>
                              <p className="text-xs text-muted-foreground">Target: {goal.target} · Deadline: {goal.deadline || "TBD"}</p>
                            </div>
                            <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                          </div>
                          <Progress value={goal.progress} className="h-2" />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min={0} max={100}
                              value={goal.progress}
                              onChange={(e) => updateProgressMutation.mutate({ goalId: goal.id, progress: parseInt(e.target.value) || 0 })}
                              className="w-20 h-8 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">% complete</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Add Private Note</Label>
                    <Textarea
                      placeholder="Performance notes, areas to improve..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button
                      onClick={() => addNoteMutation.mutate({ athleteId: selectedAthlete.athlete_user_id, note: noteText })}
                      disabled={!noteText.trim() || addNoteMutation.isPending}
                      size="sm"
                    >
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedAthlete.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No notes yet.</p>
                    ) : (
                      selectedAthlete.notes.map((note) => (
                        <div key={note.id} className="rounded-lg border bg-secondary/30 p-4">
                          <p className="text-sm">{note.note}</p>
                          <p className="text-xs text-muted-foreground mt-2">
                            {new Date(note.created_at).toLocaleDateString()} · Private
                          </p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* AI Tab */}
                <TabsContent value="ai" className="space-y-4 mt-4">
                  {selectedAthlete.goals.length === 0 ? (
                    <div className="text-center py-8">
                      <Sparkles className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                      <p className="text-sm text-muted-foreground">Set at least one goal first, then get AI-recommended workout plans.</p>
                    </div>
                  ) : !aiPlan && !aiLoading ? (
                    <div className="text-center py-8">
                      <Sparkles className="h-10 w-10 mx-auto text-primary mb-3" />
                      <p className="font-medium">AI Workout Recommendation</p>
                      <p className="text-sm text-muted-foreground mt-1 mb-4">
                        Based on this athlete's goals and position, get a personalized workout plan.
                      </p>
                      <Select value={newPosition} onValueChange={(v) => setNewPosition(v as Position)}>
                        <SelectTrigger className="w-48 mx-auto mb-3">
                          <SelectValue placeholder="Select position..." />
                        </SelectTrigger>
                        <SelectContent>
                          {POSITIONS.map((p) => (
                            <SelectItem key={p} value={p}>{p}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Button onClick={getAiRecommendation} disabled={!newPosition}>
                        <Sparkles className="h-4 w-4 mr-2" /> Generate Plan
                      </Button>
                    </div>
                  ) : aiLoading ? (
                    <div className="flex flex-col items-center py-12">
                      <Loader2 className="h-8 w-8 animate-spin text-primary mb-3" />
                      <p className="text-sm text-muted-foreground">Generating personalized plan...</p>
                    </div>
                  ) : aiPlan ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-lg border border-primary/30 bg-primary/5">
                        <h3 className="font-semibold font-['Space_Grotesk']">{aiPlan.plan_name}</h3>
                        <p className="text-sm text-muted-foreground mt-1">{aiPlan.description}</p>
                        <Badge variant="outline" className="mt-2">{aiPlan.duration_weeks} weeks</Badge>
                      </div>
                      {aiPlan.workouts?.map((w: any, i: number) => (
                        <Card key={i}>
                          <CardHeader className="py-3 px-4">
                            <CardTitle className="text-sm">{w.title}</CardTitle>
                            <CardDescription className="text-xs">{w.description}</CardDescription>
                          </CardHeader>
                          <CardContent className="px-4 pb-3">
                            <div className="space-y-2">
                              {w.drills?.map((d: any, j: number) => (
                                <div key={j} className="flex items-start gap-3 p-2 rounded bg-secondary/30">
                                  <Dumbbell className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                                  <div>
                                    <p className="text-sm font-medium">{d.name}</p>
                                    <div className="flex flex-wrap gap-1.5 mt-1">
                                      <Badge variant="secondary" className="text-[10px]">{d.rep_scheme}</Badge>
                                      <Badge variant="secondary" className="text-[10px]">{d.skill_category}</Badge>
                                      <Badge variant="secondary" className="text-[10px]">{d.equipment}</Badge>
                                      <Badge variant="secondary" className="text-[10px]">{d.difficulty}</Badge>
                                    </div>
                                    {d.coaching_cues && (
                                      <p className="text-xs text-muted-foreground mt-1">💡 {d.coaching_cues}</p>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                      <div className="flex gap-2">
                        <Button onClick={() => createFromAiPlan.mutate()} disabled={createFromAiPlan.isPending}>
                          {createFromAiPlan.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                          Save as Program
                        </Button>
                        <Button variant="outline" onClick={() => { setAiPlan(null); setAiLoading(false); }}>
                          Regenerate
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachAthletes;
