import { useState, useMemo } from "react";
import { startOfWeek, format, isToday, isTomorrow, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target, Loader2, StickyNote, CheckCircle2, Circle,
  CalendarDays, TrendingUp, Clock, MapPin, Swords,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const CATEGORY_COLORS: Record<string, string> = {
  skill: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  conditioning: "bg-green-500/10 text-green-400 border-green-500/20",
  mindset: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  coach_assigned: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const SESSION_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500",
  green: "bg-green-500",
  orange: "bg-orange-500",
  purple: "bg-purple-500",
  default: "bg-primary",
};

function formatSessionDate(dateStr: string): string {
  const d = parseISO(dateStr + "T12:00:00");
  if (isToday(d)) return "Today";
  if (isTomorrow(d)) return "Tomorrow";
  return format(d, "EEE, MMM d");
}

const ParentDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"schedule" | "development">("schedule");
  const [weekQuestion, setWeekQuestion] = useState("");

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

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

  // 3. Coach link (position + coach_user_id)
  const { data: athleteLink } = useQuery({
    queryKey: ["parent-athlete-link-detail", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;
      const { data } = await supabase
        .from("coach_athlete_links")
        .select("position, sport_id, coach_user_id")
        .eq("athlete_user_id", athleteId)
        .limit(1)
        .single();
      return data || null;
    },
    enabled: !!athleteId,
  });

  const coachId: string | null = (athleteLink as any)?.coach_user_id ?? null;

  // 4. Upcoming schedule (requires parent_view_athlete_schedule RLS policy)
  const { data: schedule = [] } = useQuery({
    queryKey: ["parent-schedule", coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const { data } = await (supabase as any)
        .from("coach_schedule")
        .select("id, title, date, start_time, session_type, game_opponent, game_home_away, color, notes")
        .eq("coach_id", coachId)
        .gte("date", today)
        .order("date", { ascending: true })
        .limit(30);
      return data || [];
    },
    enabled: !!coachId,
  });

  // 5. Goals (last 6)
  const { data: goals = [] } = useQuery({
    queryKey: ["parent-goals", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any)
        .from("athlete_goals")
        .select("id, title, target, progress, completed_at, category")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false })
        .limit(6);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 6. Weekly reflections (for engagement calc)
  const { data: reflections = [] } = useQuery({
    queryKey: ["parent-reflections", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any)
        .from("weekly_reflections")
        .select("id, week_start")
        .eq("athlete_id", athleteId)
        .order("week_start", { ascending: false })
        .limit(4);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 7. Training sessions (for engagement calc)
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

  // 8. Shared notes
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

  // 9. Weekly support question
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

  // Engagement indicator
  const engagement = useMemo(() => {
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
    if (score >= 0.67) return { signal: "On Track", color: "emerald", desc: "Steady engagement and progress." };
    if (score >= 0.34) return { signal: "In Progress", color: "yellow", desc: "Some gaps in recent activity." };
    return { signal: "Needs Attention", color: "red", desc: "Engagement needs a boost." };
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
  const athleteName = athleteProfile
    ? `${athleteProfile.first_name} ${athleteProfile.last_name}`
    : "Your Athlete";
  const initials = athleteProfile
    ? `${athleteProfile.first_name[0]}${athleteProfile.last_name[0]}`
    : "?";

  const engagementStyle: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
    red: "bg-red-500/15 text-red-400 border-red-500/25",
  };

  return (
    <DashboardLayout role="parent">
      {/* Athlete header — always visible */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary font-['Space_Grotesk'] shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-lg font-bold font-['Space_Grotesk'] leading-tight">{athleteName}</p>
          {athleteLink?.position && (
            <p className="text-sm text-muted-foreground">{athleteLink.position}</p>
          )}
        </div>
      </div>

      {!athleteId ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No athlete linked yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Your coach will send you an invite to connect your account to your athlete's profile.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Tab bar */}
          <div className="flex rounded-xl border border-border bg-secondary/30 p-1 mb-6">
            <button
              onClick={() => setTab("schedule")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === "schedule"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <CalendarDays className="h-4 w-4" />
              Schedule
            </button>
            <button
              onClick={() => setTab("development")}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-medium transition-all ${
                tab === "development"
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground"
              }`}
            >
              <TrendingUp className="h-4 w-4" />
              Development
            </button>
          </div>

          {/* ── SCHEDULE TAB ── */}
          {tab === "schedule" && (
            <div className="space-y-3">
              {schedule.length === 0 ? (
                <Card>
                  <CardContent className="py-12 text-center">
                    <CalendarDays className="h-9 w-9 mx-auto text-muted-foreground mb-3" />
                    <p className="font-medium text-sm">No upcoming sessions</p>
                    <p className="text-xs text-muted-foreground mt-1">Check back when your coach schedules something.</p>
                  </CardContent>
                </Card>
              ) : (
                schedule.map((session: any) => (
                  <Card key={session.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        {/* Color bar */}
                        <div className={`w-1.5 shrink-0 ${SESSION_COLOR_MAP[session.color] ?? SESSION_COLOR_MAP.default}`} />
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm leading-tight">{session.title}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CalendarDays className="h-3 w-3" />
                                  {formatSessionDate(session.date)}
                                </span>
                                {session.start_time && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />
                                    {session.start_time.slice(0, 5)}
                                  </span>
                                )}
                              </div>
                              {session.session_type === "game" && (
                                <div className="mt-2 space-y-0.5">
                                  {session.game_opponent && (
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <Swords className="h-3 w-3" /> vs. {session.game_opponent}
                                    </p>
                                  )}
                                  {session.game_home_away && (
                                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                      <MapPin className="h-3 w-3" /> {session.game_home_away === "home" ? "Home" : "Away"}
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                            {session.session_type === "game" && (
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0">
                                Game
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {/* ── DEVELOPMENT TAB ── */}
          {tab === "development" && (
            <div className="space-y-4">
              {/* Engagement pill */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${engagementStyle[engagement.color]}`}>
                <span>{engagement.signal}</span>
                <span className="text-xs font-normal opacity-80">· {engagement.desc}</span>
              </div>

              {/* Active goal */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Focus</p>
                  {activeGoal ? (
                    <>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-semibold text-sm leading-snug flex-1">{activeGoal.title}</p>
                        <Badge
                          variant="outline"
                          className={`text-[10px] capitalize shrink-0 ${CATEGORY_COLORS[activeGoal.category] ?? ""}`}
                        >
                          {activeGoal.category?.replace("_", " ")}
                        </Badge>
                      </div>
                      {activeGoal.target && (
                        <p className="text-xs text-muted-foreground">Target: {activeGoal.target}</p>
                      )}
                      <Progress value={activeGoal.progress} className="h-2" />
                      <p className="text-xs text-muted-foreground">
                        {activeGoal.progress >= 40 ? "✓ On Track" : "In Progress"}
                      </p>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active goals at the moment.</p>
                  )}
                </CardContent>
              </Card>

              {/* All goals */}
              {goals.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">Development Goals</p>
                    <div className="space-y-2.5">
                      {goals.map((goal: any) => (
                        <div key={goal.id} className="flex items-center gap-3">
                          {goal.completed_at ? (
                            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                          ) : (
                            <Circle className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                          <span className="text-sm flex-1 leading-snug">{goal.title}</span>
                          <Badge
                            variant="outline"
                            className={`text-[10px] capitalize shrink-0 ${CATEGORY_COLORS[goal.category] ?? ""}`}
                          >
                            {goal.category?.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Coach notes */}
              {sharedNotes.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3 flex items-center gap-1.5">
                      <StickyNote className="h-3.5 w-3.5" /> Coach Updates
                    </p>
                    <div className="space-y-2.5">
                      {sharedNotes.map((note: any) => (
                        <div key={note.id} className="rounded-lg border bg-secondary/30 p-3">
                          <p className="text-sm leading-relaxed">{note.note}</p>
                          <p className="text-xs text-muted-foreground mt-1.5">
                            {new Date(note.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                          </p>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Weekly support question */}
              <Card>
                <CardContent className="p-4 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Ask Your Coach</p>
                  <p className="text-sm text-muted-foreground leading-snug">
                    How can you support this week's development at home?
                  </p>
                  {thisWeekQuestion ? (
                    <div className="space-y-2">
                      <div className="rounded-lg border bg-secondary/30 p-3">
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-1">Your question</p>
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
                        className="min-h-[80px] text-sm"
                      />
                      <Button
                        className="w-full"
                        onClick={() => submitQuestionMutation.mutate()}
                        disabled={!weekQuestion.trim() || submitQuestionMutation.isPending}
                      >
                        {submitQuestionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                        Send Question
                      </Button>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </>
      )}
    </DashboardLayout>
  );
};

export default ParentDashboard;
