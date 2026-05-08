import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Target, Dumbbell, CheckCircle2, Loader2, Video, Mail, UserPlus, Plus, BookOpen } from "lucide-react";
import WeeklyReflectionForm from "@/components/WeeklyReflectionForm";
import AthleteWeeklyGoals from "@/components/AthleteWeeklyGoals";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import AvatarUpload from "@/components/AvatarUpload";
import ImprovementVideos from "@/components/ImprovementVideos";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const WORKOUT_QUOTES = [
  "How you practice is how you perform.",
  "Perfect effort beats perfect conditions.",
  "Reps build results.",
  "Details decide outcomes.",
  "Train the way you want to play.",
  "Every rep has a purpose.",
  "Today's work shows up tomorrow.",
];

const getDailyWorkoutQuote = () => {
  const now = new Date();
  const dayOfYear = Math.floor((now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86400000);
  return WORKOUT_QUOTES[dayOfYear % WORKOUT_QUOTES.length];
};

const AthleteDashboard = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Goals from coach (includes progress history for measurable goals)
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ["athlete-goals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("athlete_goals")
        .select("id, title, target, progress, completed_at, is_measurable, category")
        .eq("athlete_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const goalsData = (data || []) as any[];

      // Fetch progress history for all goals
      const allIds = goalsData.map((g) => g.id);
      const entriesByGoal: Record<string, { value: number; recorded_at: string }[]> = {};
      if (allIds.length > 0) {
        const { data: entries } = await (supabase as any)
          .from("goal_progress_entries")
          .select("goal_id, value, recorded_at")
          .in("goal_id", allIds)
          .order("recorded_at", { ascending: true });
        for (const e of entries || []) {
          if (!entriesByGoal[e.goal_id]) entriesByGoal[e.goal_id] = [];
          entriesByGoal[e.goal_id].push(e);
        }
      }
      return goalsData.map((g) => ({ ...g, entries: entriesByGoal[g.id] || [] }));
    },
    enabled: !!user,
  });

  // Coach notes (shared only)
  const { data: coachNotes = [] } = useQuery({
    queryKey: ["athlete-coach-notes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coach_notes")
        .select("id, note, created_at, is_private")
        .eq("athlete_id", user.id)
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Assigned programs (at-home workouts) with their workouts and drills
  const { data: assignedPrograms = [], isLoading: programsLoading } = useQuery({
    queryKey: ["athlete-programs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: assignments, error: aErr } = await supabase
        .from("athlete_programs")
        .select("id, program_id, status, program:programs(id, name, description)")
        .eq("athlete_id", user.id)
        .eq("status", "active");
      if (aErr) throw aErr;
      if (!assignments?.length) return [];

      // Fetch workouts + drills for all assigned programs
      const programIds = assignments.map((a: any) => a.program_id);
      const { data: workouts, error: wErr } = await supabase
        .from("workouts")
        .select("id, title, description, program_id, order_index, drills(id, name, instructions, rep_scheme, video_url, order_index, coaching_cues)")
        .in("program_id", programIds)
        .order("order_index")
        .order("order_index", { referencedTable: "drills" });
      if (wErr) throw wErr;

      // Fetch completions
      const { data: completions } = await supabase
        .from("athlete_drill_completions")
        .select("id, drill_id")
        .eq("athlete_id", user.id);

      const completedDrillIds = new Set((completions || []).map((c: any) => c.drill_id));

      return assignments.map((a: any) => ({
        ...a,
        workouts: (workouts || [])
          .filter((w: any) => w.program_id === a.program_id)
          .map((w: any) => ({
            ...w,
            drills: (w.drills || []).map((d: any) => ({
              ...d,
              completed: completedDrillIds.has(d.id),
            })),
          })),
      }));
    },
    enabled: !!user,
  });

  // Toggle drill completion
  const toggleDrill = useMutation({
    mutationFn: async ({ drillId, programId, completed }: { drillId: string; programId: string; completed: boolean }) => {
      if (completed) {
        // Uncheck: delete completion
        const { error } = await supabase
          .from("athlete_drill_completions")
          .delete()
          .eq("athlete_id", user!.id)
          .eq("drill_id", drillId);
        if (error) throw error;
      } else {
        // Check: insert completion
        const { error } = await supabase
          .from("athlete_drill_completions")
          .insert({ athlete_id: user!.id, drill_id: drillId, program_id: programId });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["athlete-programs"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Fetch pending team invites for this athlete
  const { data: teamInvites = [] } = useQuery({
    queryKey: ["athlete-team-invites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get user email from session (avoids querying auth.users)
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return [];
      
      const { data, error } = await supabase
        .from("team_invites")
        .select("*")
        .eq("athlete_email", email.toLowerCase())
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch coach names for display
      if (!data?.length) return [];
      const coachIds = [...new Set(data.map((i: any) => i.coach_id))];
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", coachIds);

      return data.map((invite: any) => {
        const coach = coachProfiles?.find((p: any) => p.user_id === invite.coach_id);
        return { ...invite, coach_name: coach ? `${coach.first_name} ${coach.last_name}`.trim() : "A coach" };
      });
    },
    enabled: !!user,
  });

  const respondToInvite = useMutation({
    mutationFn: async ({ inviteId, accept }: { inviteId: string; accept: boolean }) => {
      // Get the invite details first
      const invite = teamInvites.find((i: any) => i.id === inviteId);
      if (!invite) throw new Error("Invite not found");

      // If accepting, create the link first, then mark invite accepted
      // This prevents the invite getting stuck as "accepted" if the link insert fails
      if (accept) {
        const { error: linkErr } = await supabase
          .from("coach_athlete_links")
          .insert({
            coach_user_id: invite.coach_id,
            athlete_user_id: user!.id,
            sport_id: invite.sport_id,
            position: invite.position,
            throw_hand: invite.throw_hand,
            bat_hand: invite.bat_hand,
          });
        if (linkErr) throw linkErr;
      }

      // Update invite status only after the link is created
      const { error: updateErr } = await supabase
        .from("team_invites")
        .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
        .eq("id", inviteId);
      if (updateErr) throw updateErr;
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["athlete-team-invites"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-programs"] });
      toast.success(vars.accept ? "You've joined the team!" : "Invite declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Self-goal form state
  const [showSelfGoalForm, setShowSelfGoalForm] = useState(false);
  const [selfGoalTitle, setSelfGoalTitle] = useState("");
  const [selfGoalCategory, setSelfGoalCategory] = useState<"skill" | "conditioning" | "mindset">("skill");

  const addSelfGoalMutation = useMutation({
    mutationFn: async () => {
      if (!selfGoalTitle.trim()) throw new Error("Goal title is required");
      const { error } = await (supabase as any).from("athlete_goals").insert({
        athlete_id: user!.id,
        title: selfGoalTitle.trim(),
        target: "",
        is_measurable: false,
        category: selfGoalCategory,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-goals"] });
      setSelfGoalTitle(""); setSelfGoalCategory("skill"); setShowSelfGoalForm(false);
      toast.success("Goal added");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // ── Weekly reflection ──────────────────────────────────────────────────────

  const [showReflection, setShowReflection] = useState(false);
  const weekStart = (() => { const d = new Date(); d.setDate(d.getDate() - ((d.getDay() + 6) % 7)); return d.toISOString().split("T")[0]; })();
  const { data: thisWeekReflection } = useQuery({
    queryKey: ["weekly-reflection", user?.id, weekStart],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("weekly_reflections")
        .select("id, self_rating, what_went_well, needs_improvement")
        .eq("athlete_id", user!.id)
        .eq("week_start", weekStart)
        .maybeSingle();
      return data ?? null;
    },
    enabled: !!user,
  });

  // Compute stats
  const activeGoals = goals.filter((g) => !g.completed_at).length;
  const totalDrills = assignedPrograms.reduce(
    (sum: number, p: any) => sum + p.workouts.reduce((ws: number, w: any) => ws + w.drills.length, 0), 0
  );
  const completedDrills = assignedPrograms.reduce(
    (sum: number, p: any) => sum + p.workouts.reduce((ws: number, w: any) => ws + w.drills.filter((d: any) => d.completed).length, 0), 0
  );

  const isLoading = goalsLoading || programsLoading;

  if (isLoading) {
    return (
      <DashboardLayout role="athlete">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="athlete">
      <div className="mb-8 flex items-center gap-4">
        <AvatarUpload
          userId={user?.id || ""}
          currentUrl={profile?.avatar_url || null}
          initials={profile ? `${profile.first_name[0] || ""}${profile.last_name[0] || ""}` : "?"}
          onUploaded={() => window.location.reload()}
          size="lg"
        />
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">My Dashboard 👋</h1>
          <p className="text-muted-foreground mt-1">Your performance overview and at-home workouts</p>
        </div>
      </div>

      {/* Team Invites */}
      {teamInvites.length > 0 && (
        <div className="space-y-3 mb-8">
          {teamInvites.map((invite: any) => (
            <Card key={invite.id} className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {invite.coach_name} invited you to join their team
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Position: {invite.position || "Not specified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => respondToInvite.mutate({ inviteId: invite.id, accept: true })}
                    disabled={respondToInvite.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-1" /> Accept
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {[
          { label: "Active Goals", value: activeGoals, icon: Target },
          { label: "Drills Completed", value: `${completedDrills}/${totalDrills}`, icon: CheckCircle2 },
          { label: "Assigned Programs", value: assignedPrograms.length, icon: Dumbbell },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-['Space_Grotesk']">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Weekly Goals */}
      <div className="mb-8">
        <AthleteWeeklyGoals />
      </div>

      {/* Two-column layout: Performance Overview + At-Home Workouts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance Overview: Goals */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold font-['Space_Grotesk']">Performance Overview</h2>

          {/* Weekly Reflection prompt */}
          {thisWeekReflection ? (
            <Card className="border-green-500/30 bg-green-500/5">
              <CardContent className="p-4 flex items-start gap-3">
                <BookOpen className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">Reflection submitted</p>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {thisWeekReflection.self_rating != null ? `Self-rating: ${thisWeekReflection.self_rating}/10 · ` : ""}
                    {thisWeekReflection.what_went_well || "No notes added"}
                  </p>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setShowReflection(true)}>Edit</Button>
              </CardContent>
            </Card>
          ) : (
            <Card className="border-amber-500/30 bg-amber-500/5">
              <CardContent className="p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <BookOpen className="h-5 w-5 text-amber-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium">Reflect on your week</p>
                    <p className="text-xs text-muted-foreground">Take 2 minutes to log what went well and what to improve.</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => setShowReflection(true)}>Reflect</Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-['Space_Grotesk']">This Week's Goals</CardTitle>
                  <CardDescription>Your active goals</CardDescription>
                </div>
                <Button size="sm" variant="outline" onClick={() => setShowSelfGoalForm((v) => !v)}>
                  <Plus className="h-3.5 w-3.5 mr-1" /> Add Goal
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {showSelfGoalForm && (
                <div className="rounded-lg border p-3 space-y-2 bg-muted/30">
                  <div className="space-y-1">
                    <Label className="text-xs">Goal</Label>
                    <Input
                      placeholder="e.g. Improve footwork consistency"
                      value={selfGoalTitle}
                      onChange={(e) => setSelfGoalTitle(e.target.value)}
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Category</Label>
                    <Select value={selfGoalCategory} onValueChange={(v) => setSelfGoalCategory(v as typeof selfGoalCategory)}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="skill">Skill</SelectItem>
                        <SelectItem value="conditioning">Conditioning</SelectItem>
                        <SelectItem value="mindset">Mindset</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={() => addSelfGoalMutation.mutate()} disabled={!selfGoalTitle.trim() || addSelfGoalMutation.isPending}>
                      {addSelfGoalMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                      Save
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowSelfGoalForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No goals yet. Your coach will add some, or add your own above.</p>
              ) : (
                goals.map((goal: any) => (
                  <div key={goal.id} className="space-y-2 pb-2 border-b last:border-0 last:pb-0">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-sm font-medium">{goal.title}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {goal.category && (
                            <Badge variant="outline" className={`text-[10px] px-1.5 py-0 capitalize border ${
                              goal.category === "skill" ? "border-blue-500/40 text-blue-400" :
                              goal.category === "conditioning" ? "border-orange-500/40 text-orange-400" :
                              goal.category === "mindset" ? "border-purple-500/40 text-purple-400" :
                              "border-primary/40 text-primary"
                            }`}>{goal.category.replace("_", " ")}</Badge>
                          )}
                          {goal.is_measurable && goal.target && (
                            <span className="text-xs text-muted-foreground">Target: {goal.target}</span>
                          )}
                        </div>
                      </div>
                      {goal.is_measurable ? (
                        <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                      ) : (
                        <Badge variant="secondary" className="text-xs">
                          {goal.progress > 0 ? `${Math.round(goal.progress / 10)}/10` : "Not rated"}
                        </Badge>
                      )}
                    </div>

                    {goal.is_measurable ? (
                      goal.entries?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={80}>
                          <LineChart data={goal.entries.map((e: any) => ({
                            date: new Date(e.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                            value: e.value,
                          }))}>
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 100]} hide />
                            <Tooltip
                              contentStyle={{ fontSize: 11, padding: "4px 8px" }}
                              formatter={(v: any) => [`${v}%`, "Progress"]}
                            />
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <Progress value={goal.progress} className="h-2" />
                      )
                    ) : (
                      goal.entries?.length > 0 ? (
                        <ResponsiveContainer width="100%" height={80}>
                          <LineChart data={goal.entries.map((e: any) => ({
                            date: new Date(e.recorded_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
                            value: Math.round(e.value / 10),
                          }))}>
                            <XAxis dataKey="date" tick={{ fontSize: 9 }} tickLine={false} axisLine={false} />
                            <YAxis domain={[0, 10]} hide />
                            <Tooltip
                              contentStyle={{ fontSize: 11, padding: "4px 8px" }}
                              formatter={(v: any) => [`${v}/10`, "Rating"]}
                            />
                            <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
                          </LineChart>
                        </ResponsiveContainer>
                      ) : (
                        <p className="text-xs text-muted-foreground italic">No ratings logged yet</p>
                      )
                    )}
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Coach Feedback */}
          {coachNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-['Space_Grotesk']">Coach Feedback</CardTitle>
                <CardDescription>Recent notes from your coach</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {coachNotes.map((note: any) => (
                  <div key={note.id} className="rounded-lg border bg-secondary/30 p-4">
                    <p className="text-sm">{note.note}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(note.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

        </div>

        {/* At-Home Workouts */}
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-semibold font-['Space_Grotesk']">At-Home Workouts</h2>
            <p className="text-xs italic text-muted-foreground/70 mt-0.5">"{getDailyWorkoutQuote()}"</p>
          </div>

          {assignedPrograms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No workouts assigned yet. Your coach will add them.</p>
              </CardContent>
            </Card>
          ) : (
            assignedPrograms.map((program: any) => (
              <Card key={program.id}>
                <CardHeader>
                  <CardTitle className="text-base font-['Space_Grotesk']">{program.program?.name}</CardTitle>
                  {program.program?.description && (
                    <CardDescription>{program.program.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-2">
                    {program.workouts.map((workout: any, wIdx: number) => {
                      const done = workout.drills.filter((d: any) => d.completed).length;
                      const total = workout.drills.length;
                      return (
                        <AccordionItem key={workout.id} value={workout.id} className="border rounded-lg px-3">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 text-left">
                              <span className="text-xs text-muted-foreground font-mono w-5">{wIdx + 1}</span>
                              <div>
                                <p className="text-sm font-medium">{workout.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {done}/{total} completed
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            {workout.description && (
                              <p className="text-xs text-muted-foreground mb-3">{workout.description}</p>
                            )}
                            <div className="space-y-2">
                              {workout.drills.map((drill: any) => (
                                <div
                                  key={drill.id}
                                  className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${drill.completed ? "bg-primary/5 border-primary/20" : "bg-secondary/30"}`}
                                >
                                  <Checkbox
                                    checked={drill.completed}
                                    onCheckedChange={() => toggleDrill.mutate({
                                      drillId: drill.id,
                                      programId: program.program_id,
                                      completed: drill.completed,
                                    })}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${drill.completed ? "line-through text-muted-foreground" : ""}`}>
                                      {drill.name}
                                    </p>
                                    {drill.rep_scheme && (
                                      <Badge variant="outline" className="text-[10px] mt-1">{drill.rep_scheme}</Badge>
                                    )}
                                    {drill.instructions && (
                                      <p className="text-xs text-muted-foreground mt-1">{drill.instructions}</p>
                                    )}
                                    {drill.coaching_cues && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">💡 {drill.coaching_cues}</p>
                                    )}
                                    {drill.video_url && (
                                      <a
                                        href={drill.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                      >
                                        <Video className="h-3 w-3" /> Watch Demo
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Improvement Videos from Coach */}
      {user && (
        <div className="mt-8">
          <ImprovementVideos athleteId={user.id} readOnly />
        </div>
      )}

      {user && (
        <WeeklyReflectionForm
          open={showReflection}
          onClose={() => setShowReflection(false)}
          athleteId={user.id}
        />
      )}

    </DashboardLayout>
  );
};

export default AthleteDashboard;
