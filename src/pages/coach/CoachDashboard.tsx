import { useState, useCallback } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import CoachOnboarding from "@/components/CoachOnboarding";
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
  StickyNote, Plus, ChevronRight, Activity, Heart, Clock, Bell,
  X, CheckCircle, Info, ShieldAlert, Sparkles, CheckCircle2, RefreshCw,
  ChevronUp, ChevronDown,
} from "lucide-react";
import { useAIPremium } from "@/hooks/useAIPremium";
import AIPremiumModal from "@/components/AIPremiumModal";
import AIGate from "@/components/AIGate";
import { useAllSportConfigs, buildSportConfigMap } from "@/hooks/useSportConfig";
import { generateTeamInsights } from "@/lib/ai/insightsService";
import { useTimeFormat } from "@/hooks/useTimeFormat";
import { formatDisplayTime } from "@/lib/utils";
import type { AIOutput } from "@/lib/ai/types";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { useMemo } from "react";

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
  avg_progress: number | null;
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
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const timeFormat = useTimeFormat();
  const queryClient = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [noteTag, setNoteTag] = useState<string>("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  const [showAlerts, setShowAlerts] = useState(true);

  // Fetch athletes directly from DB
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["athlete-snapshots", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links, error: linksError } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id, position, sport_id")
        .eq("coach_user_id", user.id);
      if (linksError) throw linksError;
      if (!links?.length) return [];

      const athleteIds = links.map((l) => l.athlete_user_id);
      const [profilesRes, goalsRes, notesRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, avatar_url, date_of_birth").in("user_id", athleteIds),
        supabase.from("athlete_goals").select("athlete_id, completed_at, progress").eq("coach_id", user.id).in("athlete_id", athleteIds),
        supabase.from("coach_notes").select("athlete_id, note, tag, created_at").eq("coach_id", user.id).in("athlete_id", athleteIds).order("created_at", { ascending: false }),
      ]);

      return athleteIds.map((athleteId) => {
        const link = links.find((l) => l.athlete_user_id === athleteId)!;
        const profile = profilesRes.data?.find((p) => p.user_id === athleteId);
        const athleteGoals = (goalsRes.data || []).filter((g: any) => g.athlete_id === athleteId && !g.completed_at);
        const activeGoals = athleteGoals.length;
        const avgProgress = activeGoals > 0
          ? athleteGoals.reduce((sum: number, g: any) => sum + (g.progress ?? 0), 0) / activeGoals
          : null;
        const status_color =
          activeGoals === 0  ? "red"    :
          avgProgress! < 15  ? "orange" :
          avgProgress! < 40  ? "yellow" :
                               "green";
        const latestNote = (notesRes.data || []).find((n: any) => n.athlete_id === athleteId);
        return {
          athlete_id: athleteId,
          name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Unknown",
          avatar_url: profile?.avatar_url || null,
          date_of_birth: profile?.date_of_birth || null,
          position: link.position || null,
          sport_id: link.sport_id || null,
          training_status: "New Athlete",
          status_color,
          attendance_pct: null,
          sessions_this_week: 0,
          weekly_pitch_count: 0,
          last_session_date: null,
          next_session: null,
          soreness_flag: false,
          injury_note: null,
          latest_note: latestNote ? { text: latestNote.note, tag: latestNote.tag, date: latestNote.created_at } : null,
          active_goals: activeGoals,
          avg_progress: avgProgress,
          total_sessions: 0,
        } as AthleteSnapshot;
      });
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // Generate alerts on load (fire-and-forget)
  useQuery({
    queryKey: ["generate-alerts", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("generate-alerts");
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["coach-alerts"] });
      return data;
    },
    enabled: !!user,
    refetchInterval: 300000, // every 5 min
    staleTime: 240000,
  });

  // Fetch alerts
  const { data: alerts = [] } = useQuery({
    queryKey: ["coach-alerts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("coach_alerts")
        .select("*")
        .eq("coach_id", user.id)
        .eq("is_read", false)
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
    enabled: !!user,
  });

  const dismissAlert = useMutation({
    mutationFn: async (alertId: string) => {
      const { error } = await supabase.from("coach_alerts").update({ is_read: true }).eq("id", alertId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-alerts"] }),
  });

  const dismissAll = useMutation({
    mutationFn: async () => {
      if (!user) return;
      const { error } = await supabase.from("coach_alerts").update({ is_read: true }).eq("coach_id", user.id).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-alerts"] }),
  });

  const selected = snapshots.find((s) => s.athlete_id === selectedId) || null;

  // Fetch assigned programs for selected athlete
  const { data: detailPrograms = [] } = useQuery({
    queryKey: ["detail-programs", selectedId],
    queryFn: async () => {
      if (!selectedId) return [];
      const { data } = await supabase
        .from("athlete_programs")
        .select("id, status, program:programs(id, name, description)")
        .eq("athlete_id", selectedId);
      return data || [];
    },
    enabled: !!selectedId,
  });

  const removeProgramMut = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("athlete_programs").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["detail-programs"] });
      toast({ title: "Program removed" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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

  const { isEnabled: aiEnabled } = useAIPremium();
  const [showAIModal, setShowAIModal] = useState(false);
  const { data: sportConfigs = [] } = useAllSportConfigs();
  const sportConfigMap = useMemo(() => buildSportConfigMap(sportConfigs), [sportConfigs]);
  const [teamInsights, setTeamInsights] = useState<AIOutput | null>(null);
  const [generatingInsights, setGeneratingInsights] = useState(false);

  // ── HUD layout preferences ────────────────────────────────────────────────
  const PRIVATE_DEFAULT = ["summary", "athletes", "at_risk", "ai_insights", "alerts"];
  const TEAM_DEFAULT    = ["summary", "alerts", "at_risk", "ai_insights", "athletes"];

  const { data: hudPrefs = {} } = useQuery<Record<string, unknown>>({
    queryKey: ["hud-layout", user?.id],
    queryFn: async () => {
      if (!user) return {};
      const { data } = await (supabase as any)
        .from("profiles")
        .select("hud_layout_preferences")
        .eq("user_id", user.id)
        .single();
      return (data?.hud_layout_preferences as Record<string, unknown>) ?? {};
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  const saveHudLayout = useMutation({
    mutationFn: async (prefs: Record<string, unknown>) => {
      await (supabase as any)
        .from("profiles")
        .update({ hud_layout_preferences: prefs })
        .eq("user_id", user!.id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["hud-layout"] }),
  });

  const widgetOrder: string[] = Array.isArray(hudPrefs.widget_order)
    ? (hudPrefs.widget_order as string[])
    : profile?.coach_type === "team" ? TEAM_DEFAULT : PRIVATE_DEFAULT;

  const moveWidget = useCallback((id: string, dir: -1 | 1) => {
    const idx = widgetOrder.indexOf(id);
    const next = idx + dir;
    if (next < 0 || next >= widgetOrder.length) return;
    const newOrder = [...widgetOrder];
    [newOrder[idx], newOrder[next]] = [newOrder[next], newOrder[idx]];
    saveHudLayout.mutate({ ...hudPrefs, widget_order: newOrder });
  }, [widgetOrder, hudPrefs, saveHudLayout]);

  // Summary stats
  const onTrack = snapshots.filter((s) => s.status_color === "green").length;
  const needsAttention = snapshots.filter((s) => s.status_color === "yellow" || s.status_color === "orange" || s.status_color === "red").length;
  const injured = snapshots.filter((s) => s.soreness_flag).length;

  const RISK_ORDER: Record<string, number> = { red: 0, orange: 1, yellow: 2 };
  const atRiskAthletes = snapshots
    .filter((s) => s.status_color !== "green")
    .sort((a, b) => (RISK_ORDER[a.status_color] ?? 3) - (RISK_ORDER[b.status_color] ?? 3));

  const riskLabel = (s: AthleteSnapshot) =>
    s.status_color === "red"    ? "No goals set" :
    s.status_color === "orange" ? "Behind on goals" :
                                  "Needs attention";

  const riskBorder: Record<string, string> = {
    red:    "border-l-red-500",
    orange: "border-l-orange-500",
    yellow: "border-l-amber-500",
  };

  return (
    <DashboardLayout role="coach">
      {user && (
        <CoachOnboarding
          userId={user.id}
          firstName={profile?.first_name || ""}
        />
      )}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Athlete Snapshots</h1>
          <p className="text-muted-foreground mt-1">Assess athlete status at a glance. Tap a card for details.</p>
        </div>
        {aiEnabled && (
          <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/40 border gap-1.5 px-2.5 py-1.5 shrink-0">
            <Sparkles className="h-3.5 w-3.5" /> AI Active
          </Badge>
        )}
      </div>

      {/* Contextual AI upsell — shown when AI is off and coach has 3+ athletes */}
      {!aiEnabled && snapshots.length >= 3 && (
        <div className="mb-6 rounded-xl border border-violet-500/20 bg-violet-500/5 p-4 flex items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Sparkles className="h-5 w-5 text-violet-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-semibold">Save 4–6 hours this week</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                AI Premium can summarize all {snapshots.length} athletes and flag disengagement before it becomes a problem.
              </p>
            </div>
          </div>
          <Button size="sm" className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5 shrink-0" onClick={() => setShowAIModal(true)}>
            <Sparkles className="h-3.5 w-3.5" /> Unlock AI
          </Button>
        </div>
      )}

      {/* HUD — sections ordered per coach preference. Hover any section to reorder. */}
      {widgetOrder.map((id, idx) => {
        const isFirst = idx === 0;
        const isLast = idx === widgetOrder.length - 1;
        let content: React.ReactNode;

        switch (id) {
          case "summary":
            content = (
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
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
            );
            break;

          case "alerts":
            if (!alerts.length || !showAlerts) return null;
            content = (
              <Card className="border-amber-500/30">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-5 w-5 text-amber-400" />
                <CardTitle className="text-lg font-['Space_Grotesk']">Smart Alerts</CardTitle>
                <Badge variant="secondary" className="text-xs">{alerts.length}</Badge>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => dismissAll.mutate()}>
                  Mark all read
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setShowAlerts(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0 space-y-2 max-h-64 overflow-y-auto">
            {alerts.map((alert: any) => {
              const severityIcon = alert.severity === "error"
                ? <ShieldAlert className="h-4 w-4 text-red-400 shrink-0 mt-0.5" />
                : alert.severity === "warning"
                ? <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                : <Info className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />;

              const severityBorder = alert.severity === "error"
                ? "border-red-500/20 bg-red-500/5"
                : alert.severity === "warning"
                ? "border-amber-500/20 bg-amber-500/5"
                : "border-blue-500/20 bg-blue-500/5";

              return (
                <div key={alert.id} className={`rounded-lg border p-3 flex items-start gap-3 ${severityBorder}`}>
                  {severityIcon}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{alert.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{alert.message}</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {format(new Date(alert.created_at), "MMM d, h:mm a")}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0"
                    onClick={() => dismissAlert.mutate(alert.id)}
                  >
                    <CheckCircle className="h-3.5 w-3.5 text-muted-foreground" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
            );
            break;

          case "at_risk":
            if (!snapshots.length) return null;
            content = (
              <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-semibold font-['Space_Grotesk'] flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-amber-400" /> At-Risk Athletes
            </h2>
          </div>
          <AIGate onUpgrade={() => setShowAIModal(true)} featureLabel="At-Risk Detection">
            {atRiskAthletes.length === 0 ? (
              <Card>
                <CardContent className="p-4 flex items-center gap-3 text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <p className="text-sm">All athletes are on track — no flags detected.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-2">
                {atRiskAthletes.map((s) => (
                  <Card key={s.athlete_id} className={`border-l-4 ${riskBorder[s.status_color] ?? ""}`}>
                    <CardContent className="p-3 flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {s.position ?? "No position"}{s.avg_progress !== null ? ` · ${Math.round(s.avg_progress)}% avg progress` : ""}
                        </p>
                      </div>
                      <Badge className={`text-[10px] shrink-0 ${STATUS_STYLES[s.status_color]}`}>
                        {riskLabel(s)}
                      </Badge>
                    </CardContent>
                  </Card>
                ))}
                <p className="text-[10px] text-muted-foreground italic px-1">AI-assisted detection. Coach review required.</p>
              </div>
            )}
          </AIGate>
        </div>
            );
            break;

          case "ai_insights":
            if (!snapshots.length) return null;
            content = (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold font-['Space_Grotesk'] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-violet-400" /> AI Insights
                  </h2>
            {aiEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs text-muted-foreground h-7 gap-1"
                disabled={generatingInsights}
                onClick={async () => {
                  setGeneratingInsights(true);
                  try {
                    const totalGoals = snapshots.reduce((s, a) => s + a.active_goals, 0);
                    const insights = await generateTeamInsights({
                      totalAthletes: snapshots.length,
                      onTrack,
                      needsAttention,
                      activeGoals: totalGoals,
                      completedGoals: 0,
                      hasReflections: false,
                    });
                    setTeamInsights(insights);
                  } finally {
                    setGeneratingInsights(false);
                  }
                }}
              >
                {generatingInsights
                  ? <Loader2 className="h-3 w-3 animate-spin" />
                  : <RefreshCw className="h-3 w-3" />}
                {teamInsights ? "Refresh" : "Generate"}
              </Button>
            ) : (
              <Button variant="ghost" size="sm" className="text-xs text-violet-400 h-7 gap-1" onClick={() => setShowAIModal(true)}>
                <Sparkles className="h-3 w-3" /> Unlock
              </Button>
            )}
          </div>
          <AIGate onUpgrade={() => setShowAIModal(true)} featureLabel="Weekly AI Insights">
            {teamInsights ? (
              <div className="space-y-3">
                <Card className="border-violet-500/20">
                  <CardContent className="p-4 space-y-2">
                    <p className="text-xs font-semibold text-violet-400 flex items-center gap-1.5">
                      <TrendingUp className="h-3 w-3" /> Team Overview
                    </p>
                    <p className="text-sm text-muted-foreground leading-relaxed">{teamInsights.summary}</p>
                  </CardContent>
                </Card>
                <div className="grid gap-3 sm:grid-cols-2">
                  {teamInsights.highlights.length > 0 && (
                    <Card className="border-emerald-500/20">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                          <CheckCircle2 className="h-3 w-3" /> Highlights
                        </p>
                        <ul className="space-y-1">
                          {teamInsights.highlights.map((h, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                              <span className="text-emerald-400 shrink-0">·</span>{h}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                  {teamInsights.concerns.length > 0 && (
                    <Card className="border-amber-500/20">
                      <CardContent className="p-4 space-y-2">
                        <p className="text-xs font-semibold text-amber-400 flex items-center gap-1.5">
                          <ShieldAlert className="h-3 w-3" /> Watch Out
                        </p>
                        <ul className="space-y-1">
                          {teamInsights.concerns.map((c, i) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                              <span className="text-amber-400 shrink-0">·</span>{c}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </div>
                {teamInsights.recommendations.length > 0 && (
                  <Card className="border-violet-500/20">
                    <CardContent className="p-4 space-y-2">
                      <p className="text-xs font-semibold text-violet-400">Recommendations</p>
                      <ul className="space-y-1">
                        {teamInsights.recommendations.map((r, i) => (
                          <li key={i} className="text-sm text-muted-foreground flex items-start gap-1.5">
                            <span className="text-primary font-bold shrink-0">→</span>{r}
                          </li>
                        ))}
                      </ul>
                    </CardContent>
                  </Card>
                )}
                <p className="text-[10px] text-muted-foreground italic text-center">
                  AI-generated draft. Coach review required.
                </p>
              </div>
            ) : (
              <Card className="border-violet-500/20">
                <CardContent className="p-6 text-center space-y-3">
                  <Sparkles className="h-8 w-8 text-violet-400 mx-auto" />
                  <div>
                    <p className="text-sm font-medium">Generate Weekly Insights</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      AI analyzes your {snapshots.length} athlete{snapshots.length !== 1 ? "s" : ""} and surfaces engagement patterns, goal progress, and focus areas.
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="bg-violet-600 hover:bg-violet-700 text-white gap-1.5"
                    disabled={generatingInsights}
                    onClick={async () => {
                      setGeneratingInsights(true);
                      try {
                        const totalGoals = snapshots.reduce((s, a) => s + a.active_goals, 0);
                        const insights = await generateTeamInsights({
                          totalAthletes: snapshots.length,
                          onTrack,
                          needsAttention,
                          activeGoals: totalGoals,
                          completedGoals: 0,
                          hasReflections: false,
                        });
                        setTeamInsights(insights);
                      } finally {
                        setGeneratingInsights(false);
                      }
                    }}
                  >
                    {generatingInsights
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Sparkles className="h-3.5 w-3.5" />}
                    {generatingInsights ? "Analyzing..." : "Generate Insights"}
                  </Button>
                </CardContent>
              </Card>
            )}
          </AIGate>
        </div>
            );
            break;

          case "athletes":
            content = (
              isLoading ? (
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
                        {athlete.position || "No position"}{sportConfigMap.get(athlete.sport_id ?? "") ? ` · ${sportConfigMap.get(athlete.sport_id ?? "")!.name}` : ""}
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
                    <p className="text-lg font-bold font-['Space_Grotesk']">{athlete.attendance_pct != null ? `${athlete.attendance_pct}%` : "N/A"}</p>
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
                        {athlete.next_session.time && ` at ${formatDisplayTime(athlete.next_session.time, timeFormat)}`}
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
              )
            );
            break;

          default:
            return null;
        }
        return (
          <div key={id} className="mb-8 relative group/widget">
            <div className="absolute -right-1 top-0 flex gap-0.5 opacity-0 group-hover/widget:opacity-100 transition-opacity z-10">
              <button onClick={() => moveWidget(id, -1)} disabled={isFirst}
                className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground disabled:opacity-20 bg-background border">
                <ChevronUp className="h-3 w-3" />
              </button>
              <button onClick={() => moveWidget(id, 1)} disabled={isLast}
                className="h-5 w-5 flex items-center justify-center rounded text-muted-foreground/60 hover:text-foreground disabled:opacity-20 bg-background border">
                <ChevronDown className="h-3 w-3" />
              </button>
            </div>
            {content}
          </div>
        );
      })}

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
                      {selected.position || "No position"}{sportConfigMap.get(selected.sport_id ?? "") ? ` · ${sportConfigMap.get(selected.sport_id ?? "")!.name}` : ""}
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
                  <p className="text-xl font-bold font-['Space_Grotesk']">{selected.attendance_pct != null ? `${selected.attendance_pct}%` : "N/A"}</p>
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

              <Tabs defaultValue="programs" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="programs" className="flex-1 gap-1.5"><ChevronRight className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Programs</span></TabsTrigger>
                  <TabsTrigger value="sessions" className="flex-1 gap-1.5"><Activity className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Sessions</span></TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1 gap-1.5"><StickyNote className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Notes</span></TabsTrigger>
                  <TabsTrigger value="goals" className="flex-1 gap-1.5"><Target className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Goals</span></TabsTrigger>
                </TabsList>

                {/* Programs tab */}
                <TabsContent value="programs" className="mt-4 space-y-3">
                  <p className="text-xs text-muted-foreground">Programs assigned to {selected.name.split(" ")[0]}</p>
                  {detailPrograms.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No programs assigned yet. Assign from the Athletes page.</p>
                  ) : (
                    detailPrograms.map((ap: any) => (
                      <div key={ap.id} className="rounded-lg border p-3 flex items-start justify-between">
                        <div>
                          <p className="text-sm font-medium">{ap.program?.name || "Program"}</p>
                          {ap.program?.description && (
                            <p className="text-xs text-muted-foreground mt-0.5">{ap.program.description}</p>
                          )}
                          <Badge variant="outline" className="mt-1.5 text-[10px] capitalize">{ap.status}</Badge>
                        </div>
                        <Button
                          variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => removeProgramMut.mutate(ap.id)}
                          disabled={removeProgramMut.isPending}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>

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
                            {s.session_type} · {s.duration_min ? `${s.duration_min}min` : "N/A"} · {s.pitch_count || 0} pitches
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
      <AIPremiumModal open={showAIModal} onClose={() => setShowAIModal(false)} athleteCount={snapshots.length} />
    </DashboardLayout>
  );
};

export default CoachDashboard;
