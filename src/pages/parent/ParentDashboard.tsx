import { useState, useMemo } from "react";
import { startOfWeek, format } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Target, FileDown, Loader2, StickyNote, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  skill: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  conditioning: "bg-green-500/10 text-green-400 border-green-500/20",
  mindset: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  coach_assigned: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const ParentDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [weekQuestion, setWeekQuestion] = useState("");

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");

  // 1. Linked athlete
  const { data: link } = useQuery({
    queryKey: ["parent-link", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("parent_athlete_links")
        .select("id, athlete_user_id")
        .eq("parent_user_id", user.id)
        .limit(1)
        .single();
      return data || null;
    },
    enabled: !!user,
  });

  const athleteId: string | null = link?.athlete_user_id ?? null;

  // 2. Athlete profile
  const { data: athleteProfile } = useQuery({
    queryKey: ["parent-athlete-profile", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;
      const { data } = await supabase
        .from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("user_id", athleteId)
        .single();
      return data || null;
    },
    enabled: !!athleteId,
  });

  // 3. Coach athlete link (for position/sport)
  const { data: athleteLink } = useQuery({
    queryKey: ["parent-athlete-link-detail", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;
      const { data } = await supabase
        .from("coach_athlete_links")
        .select("position, sport_id")
        .eq("athlete_user_id", athleteId)
        .limit(1)
        .single();
      return data || null;
    },
    enabled: !!athleteId,
  });

  // 4. Goals (last 6)
  const { data: goals = [] } = useQuery({
    queryKey: ["parent-goals", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any)
        .from("athlete_goals")
        .select("id, title, target, progress, completed_at, category, is_measurable")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 5. Weekly reflections (last 4 weeks)
  const { data: reflections = [] } = useQuery({
    queryKey: ["parent-reflections", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any)
        .from("weekly_reflections")
        .select("id, week_start, self_rating")
        .eq("athlete_id", athleteId)
        .order("week_start", { ascending: false })
        .limit(4);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 6. Training sessions (last 4 weeks)
  const { data: sessions = [] } = useQuery({
    queryKey: ["parent-sessions", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any)
        .from("training_sessions")
        .select("id, status")
        .eq("athlete_id", athleteId)
        .order("session_date", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 7. Shared notes (visible_to_parent = true)
  const { data: sharedNotes = [] } = useQuery({
    queryKey: ["parent-notes", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any)
        .from("coach_notes")
        .select("id, note, created_at")
        .eq("athlete_id", athleteId)
        .eq("visible_to_parent", true)
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 8. This week's support question
  const { data: thisWeekQuestion } = useQuery({
    queryKey: ["parent-week-q", athleteId, weekStart],
    queryFn: async () => {
      if (!athleteId || !user) return null;
      const { data } = await (supabase as any)
        .from("parent_support_questions")
        .select("id, question, coach_reply, replied_at")
        .eq("parent_user_id", user.id)
        .eq("athlete_user_id", athleteId)
        .eq("week_start", weekStart)
        .maybeSingle();
      return data || null;
    },
    enabled: !!athleteId && !!user,
  });

  // Consistency indicator
  const consistency = useMemo(() => {
    const activeGoals = goals.filter((g: any) => !g.completed_at).slice(0, 4);
    const avgProgress = activeGoals.length
      ? activeGoals.reduce((s: number, g: any) => s + (g.progress ?? 0), 0) / activeGoals.length
      : 0;
    const weeksWithReflection = new Set((reflections as any[]).map((r) => r.week_start)).size;
    const reflectionRate = Math.min(weeksWithReflection / 4, 1);
    const attended = (sessions as any[]).filter((s) => s.status === "completed").length;
    const nonScheduled = (sessions as any[]).filter((s) => s.status !== "scheduled").length;
    const attendRate = nonScheduled > 0 ? attended / nonScheduled : 1;
    const score = (avgProgress / 100 + reflectionRate + attendRate) / 3;

    if (score >= 0.67) return { signal: "Consistent", color: "emerald", desc: "Showing steady engagement and progress." };
    if (score >= 0.34) return { signal: "Inconsistent", color: "yellow", desc: "Some gaps in recent activity." };
    return { signal: "Needs Attention", color: "red", desc: "Engagement or progress needs a boost." };
  }, [goals, reflections, sessions]);

  const submitQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !athleteId) throw new Error("Missing data");
      const { error } = await (supabase as any).from("parent_support_questions").insert({
        parent_user_id: user.id,
        athlete_user_id: athleteId,
        week_start: weekStart,
        question: weekQuestion.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-week-q", athleteId, weekStart] });
      setWeekQuestion("");
      toast({ title: "Question submitted", description: "Your coach will reply soon." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const activeGoal = goals.find((g: any) => !g.completed_at) ?? null;

  const consistencyPill: Record<string, string> = {
    emerald: "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30",
    yellow: "bg-yellow-500/20 text-yellow-400 border border-yellow-500/30",
    red: "bg-red-500/20 text-red-400 border border-red-500/30",
  };

  if (!link && link !== undefined) {
    // Still loading
  }

  return (
    <DashboardLayout role="parent">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">Follow your athlete's development journey</p>
      </div>

      {/* No athlete linked yet */}
      {!athleteId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No athlete linked yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your coach will send you an invite to connect your account to your athlete's profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* 1. Athlete Header */}
          <Card>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary font-['Space_Grotesk']">
                {athleteProfile ? `${athleteProfile.first_name[0]}${athleteProfile.last_name[0]}` : "?"}
              </div>
              <div>
                <p className="text-xl font-bold font-['Space_Grotesk']">
                  {athleteProfile ? `${athleteProfile.first_name} ${athleteProfile.last_name}` : "Your Athlete"}
                </p>
                {athleteLink?.position && (
                  <p className="text-sm text-muted-foreground">{athleteLink.position}</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. Current Development Focus */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-['Space_Grotesk']">Current Development Focus</CardTitle>
            </CardHeader>
            <CardContent>
              {activeGoal ? (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1">
                      <p className="font-medium">{activeGoal.title}</p>
                      {activeGoal.target && (
                        <p className="text-xs text-muted-foreground mt-0.5">Target: {activeGoal.target}</p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] capitalize shrink-0 ${CATEGORY_COLORS[activeGoal.category] ?? ""}`}
                    >
                      {activeGoal.category?.replace("_", " ")}
                    </Badge>
                  </div>
                  <Progress value={activeGoal.progress} className="h-2" />
                  <p className="text-xs text-muted-foreground">
                    {activeGoal.progress >= 40 ? "On Track" : "In Progress"}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground py-2">No active goals at the moment.</p>
              )}
            </CardContent>
          </Card>

          {/* 3. Consistency Indicator */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-['Space_Grotesk']">Engagement</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3">
                <span className={`px-3 py-1.5 rounded-full text-sm font-semibold ${consistencyPill[consistency.color]}`}>
                  {consistency.signal}
                </span>
                <p className="text-sm text-muted-foreground">{consistency.desc}</p>
              </div>
            </CardContent>
          </Card>

          {/* 4. Development Timeline */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-['Space_Grotesk']">Development Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No goals yet.</p>
              ) : (
                <div className="space-y-2">
                  {goals.map((goal: any) => (
                    <div key={goal.id} className="flex items-center gap-3">
                      {goal.completed_at ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                      ) : (
                        <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                      )}
                      <span className="text-sm flex-1">{goal.title}</span>
                      <Badge
                        variant="outline"
                        className={`text-[10px] capitalize ${CATEGORY_COLORS[goal.category] ?? ""}`}
                      >
                        {goal.category?.replace("_", " ")}
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 5. Coach Shared Notes */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-['Space_Grotesk'] flex items-center gap-2">
                <StickyNote className="h-4 w-4" /> Coach Updates
              </CardTitle>
            </CardHeader>
            <CardContent>
              {sharedNotes.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">No shared updates yet.</p>
              ) : (
                <div className="space-y-3">
                  {sharedNotes.map((note: any) => (
                    <div key={note.id} className="rounded-lg border bg-secondary/30 p-3">
                      <p className="text-sm">{note.note}</p>
                      <p className="text-xs text-muted-foreground mt-1.5">
                        {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* 6. Weekly Support Question */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-['Space_Grotesk']">Weekly Support Question</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-sm text-muted-foreground">
                How can you support this week's development focus at home?
              </p>
              {thisWeekQuestion ? (
                <div className="space-y-3">
                  <div className="rounded-lg border bg-secondary/30 p-3">
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Your question this week</p>
                    <p className="text-sm">{thisWeekQuestion.question}</p>
                  </div>
                  {thisWeekQuestion.coach_reply ? (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-3">
                      <p className="text-[11px] text-primary uppercase tracking-wide font-medium mb-1">Coach's reply</p>
                      <p className="text-sm">{thisWeekQuestion.coach_reply}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground italic">Waiting for your coach to reply.</p>
                  )}
                </div>
              ) : (
                <>
                  <Textarea
                    placeholder="Ask how you can best support your athlete this week..."
                    value={weekQuestion}
                    onChange={(e) => setWeekQuestion(e.target.value)}
                    className="min-h-[80px]"
                  />
                  <Button
                    size="sm"
                    onClick={() => submitQuestionMutation.mutate()}
                    disabled={!weekQuestion.trim() || submitQuestionMutation.isPending}
                  >
                    {submitQuestionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                    Submit Question
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* 7. PDF Report stub */}
          <Card>
            <CardContent className="p-5 flex items-center justify-between">
              <div>
                <p className="font-medium text-sm">Monthly Development Report</p>
                <p className="text-xs text-muted-foreground mt-0.5">A full summary of your athlete's progress</p>
              </div>
              <Button variant="outline" size="sm" disabled title="Coming Soon">
                <FileDown className="h-4 w-4 mr-2" /> Download
              </Button>
            </CardContent>
          </Card>
        </div>
      )}
    </DashboardLayout>
  );
};

export default ParentDashboard;
