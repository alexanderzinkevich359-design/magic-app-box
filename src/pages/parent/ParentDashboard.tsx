import { useState, useMemo, useRef, useEffect } from "react";
import { startOfWeek, format, isToday, isTomorrow, parseISO } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Target, Loader2, StickyNote, CheckCircle2, Circle,
  CalendarDays, TrendingUp, Clock, MapPin, Swords,
  MessageCircle, ShieldAlert, Bot, ChevronRight, ArrowLeft,
  Lock, Send, Sparkles, Phone, CalendarX,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type View = "home" | "schedule" | "development" | "communications" | "emergency" | "assistant";
type ChatMessage = { role: "user" | "assistant"; content: string };

const CATEGORY_COLORS: Record<string, string> = {
  skill: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  conditioning: "bg-green-500/10 text-green-400 border-green-500/20",
  mindset: "bg-violet-500/10 text-violet-400 border-violet-500/20",
  coach_assigned: "bg-orange-500/10 text-orange-400 border-orange-500/20",
};

const SESSION_COLOR_MAP: Record<string, string> = {
  blue: "bg-blue-500", green: "bg-green-500",
  orange: "bg-orange-500", purple: "bg-purple-500", default: "bg-primary",
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

  const [view, setView] = useState<View>("home");
  const [weekQuestion, setWeekQuestion] = useState("");
  const [emergencyForm, setEmergencyForm] = useState({
    phone: "", emergencyContactName: "", emergencyContactPhone: "", emergencyNotes: "",
  });
  const [emergencySaving, setEmergencySaving] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatSending, setChatSending] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);
  const [absenceSessionId, setAbsenceSessionId] = useState<string | null>(null);
  const [absenceReason, setAbsenceReason] = useState("");
  const [commsSeenAt, setCommsSeenAt] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const weekStart = format(startOfWeek(new Date(), { weekStartsOn: 1 }), "yyyy-MM-dd");
  const today = format(new Date(), "yyyy-MM-dd");

  // 1. Linked athlete
  const { data: link } = useQuery({
    queryKey: ["parent-link", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("parent_athlete_links").select("athlete_user_id")
        .eq("parent_user_id", user.id).limit(1).single();
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
      const { data } = await supabase.from("profiles")
        .select("first_name, last_name, avatar_url")
        .eq("user_id", athleteId).single();
      return data || null;
    },
    enabled: !!athleteId,
  });

  // 3. Coach link
  const { data: athleteLink } = useQuery({
    queryKey: ["parent-athlete-link-detail", athleteId],
    queryFn: async () => {
      if (!athleteId) return null;
      const { data } = await supabase.from("coach_athlete_links")
        .select("position, sport_id, coach_user_id")
        .eq("athlete_user_id", athleteId).limit(1).single();
      return data || null;
    },
    enabled: !!athleteId,
  });
  const coachId: string | null = (athleteLink as any)?.coach_user_id ?? null;

  // 4. Parent's own profile (premium check + emergency info)
  const { data: parentProfile, refetch: refetchParentProfile } = useQuery({
    queryKey: ["parent-own-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase.from("profiles")
        .select("ai_premium, phone, emergency_contact_name, emergency_contact_phone, emergency_notes")
        .eq("user_id", user.id).single();
      return data as any || null;
    },
    enabled: !!user,
  });

  // 5. Schedule — all sessions for this coach (parent sees their athlete's coach's schedule)
  // Deduplication done client-side below to collapse team sessions into one card
  const { data: schedule = [] } = useQuery({
    queryKey: ["parent-schedule", coachId],
    queryFn: async () => {
      if (!coachId) return [];
      const { data } = await (supabase as any).from("coach_schedule")
        .select("id, title, scheduled_date, start_time, session_type, game_opponent, game_home_away, color, notes, athlete_id")
        .eq("coach_id", coachId)
        .gte("scheduled_date", today)
        .order("scheduled_date", { ascending: true }).limit(60);
      return data || [];
    },
    enabled: !!coachId,
  });

  // Deduplicate team sessions: keep one representative per (date + title + start_time + color)
  const dedupedSchedule = useMemo(() => {
    const seen = new Set<string>();
    return (schedule as any[]).filter((s: any) => {
      const key = `${s.scheduled_date}|${s.title}|${s.start_time ?? ""}|${s.color ?? ""}|${s.session_type}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [schedule]);

  // 5b. Already-reported absences for these sessions
  const { data: absences = [] } = useQuery({
    queryKey: ["parent-absences", athleteId, user?.id],
    queryFn: async () => {
      if (!athleteId || !user) return [];
      const { data } = await (supabase as any).from("session_absences")
        .select("id, schedule_id, reason")
        .eq("athlete_user_id", athleteId)
        .eq("parent_user_id", user.id);
      return data || [];
    },
    enabled: !!athleteId && !!user,
  });

  const absencesByScheduleId = useMemo(() => {
    const map: Record<string, { id: string; reason: string | null }> = {};
    (absences as any[]).forEach((a: any) => { map[a.schedule_id] = a; });
    return map;
  }, [absences]);

  // 6. Goals
  const { data: goals = [] } = useQuery({
    queryKey: ["parent-goals", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any).from("athlete_goals")
        .select("id, title, target, progress, completed_at, category")
        .eq("athlete_id", athleteId)
        .order("created_at", { ascending: false }).limit(8);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 7. Reflections (for engagement)
  const { data: reflections = [] } = useQuery({
    queryKey: ["parent-reflections", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any).from("weekly_reflections")
        .select("id, week_start").eq("athlete_id", athleteId)
        .order("week_start", { ascending: false }).limit(4);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 8. Sessions (for engagement)
  const { data: sessions = [] } = useQuery({
    queryKey: ["parent-sessions", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any).from("training_sessions")
        .select("id, status").eq("athlete_id", athleteId)
        .order("session_date", { ascending: false }).limit(20);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 9. Shared notes
  const { data: sharedNotes = [] } = useQuery({
    queryKey: ["parent-notes", athleteId],
    queryFn: async () => {
      if (!athleteId) return [];
      const { data } = await (supabase as any).from("coach_notes")
        .select("id, note, created_at").eq("athlete_id", athleteId)
        .eq("visible_to_parent", true)
        .order("created_at", { ascending: false }).limit(10);
      return data || [];
    },
    enabled: !!athleteId,
  });

  // 10. All messages between this parent and coach (for the athlete)
  const { data: allMessages = [] } = useQuery({
    queryKey: ["parent-messages", athleteId, user?.id],
    queryFn: async () => {
      if (!athleteId || !user) return [];
      const { data } = await (supabase as any).from("parent_support_questions")
        .select("id, question, coach_reply, replied_at, created_at")
        .eq("parent_user_id", user.id).eq("athlete_user_id", athleteId)
        .order("created_at", { ascending: true })
        .limit(50);
      return data || [];
    },
    enabled: !!athleteId && !!user,
  });


  // Engagement indicator
  const engagement = useMemo(() => {
    const active = goals.filter((g: any) => !g.completed_at).slice(0, 4);
    const avg = active.length ? active.reduce((s: number, g: any) => s + (g.progress ?? 0), 0) / active.length : 0;
    const refRate = Math.min(new Set((reflections as any[]).map(r => r.week_start)).size / 4, 1);
    const attended = (sessions as any[]).filter(s => s.status === "completed").length;
    const nonSch = (sessions as any[]).filter(s => s.status !== "scheduled").length;
    const attRate = nonSch > 0 ? attended / nonSch : 1;
    const score = (avg / 100 + refRate + attRate) / 3;
    if (score >= 0.67) return { signal: "On Track", color: "emerald", desc: "Steady engagement and progress." };
    return { signal: "In Progress", color: "yellow", desc: "Some gaps in recent activity." };
  }, [goals, reflections, sessions]);

  const engagementStyle: Record<string, string> = {
    emerald: "bg-emerald-500/15 text-emerald-400 border-emerald-500/25",
    yellow: "bg-yellow-500/15 text-yellow-400 border-yellow-500/25",
  };

  const isPremium = (parentProfile as any)?.ai_premium === true;
  const activeGoal = goals.find((g: any) => !g.completed_at) ?? null;
  const nextSession = dedupedSchedule[0] ?? null;
  const athleteName = athleteProfile ? `${athleteProfile.first_name} ${athleteProfile.last_name}` : "Your Athlete";
  const initials = athleteProfile ? `${athleteProfile.first_name[0]}${athleteProfile.last_name[0]}` : "?";

  // Load comms seen timestamp from localStorage
  useEffect(() => {
    if (!user?.id) return;
    setCommsSeenAt(localStorage.getItem(`parent_comms_seen_${user.id}`));
  }, [user?.id]);

  const hasUnreadComms = useMemo(() =>
    (allMessages as any[]).some((m: any) =>
      m.coach_reply && m.replied_at && (!commsSeenAt || m.replied_at > commsSeenAt)
    ), [allMessages, commsSeenAt]);

  const markCommsAsRead = () => {
    if (!user?.id) return;
    const ts = new Date().toISOString();
    localStorage.setItem(`parent_comms_seen_${user.id}`, ts);
    setCommsSeenAt(ts);
  };

  // Sync emergency form from profile
  useEffect(() => {
    if (parentProfile) {
      setEmergencyForm({
        phone: parentProfile.phone ?? "",
        emergencyContactName: (parentProfile as any).emergency_contact_name ?? "",
        emergencyContactPhone: (parentProfile as any).emergency_contact_phone ?? "",
        emergencyNotes: (parentProfile as any).emergency_notes ?? "",
      });
    }
  }, [parentProfile]);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Report absence
  const reportAbsenceMutation = useMutation({
    mutationFn: async ({ scheduleId, reason }: { scheduleId: string; reason: string }) => {
      if (!user || !athleteId) throw new Error("Missing data");
      const { error } = await (supabase as any).from("session_absences").insert({
        schedule_id: scheduleId,
        athlete_user_id: athleteId,
        parent_user_id: user.id,
        reason: reason.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-absences", athleteId, user?.id] });
      setAbsenceSessionId(null);
      setAbsenceReason("");
      toast({ title: "Absence reported", description: "Your coach has been notified." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Submit weekly question
  const submitQuestionMutation = useMutation({
    mutationFn: async () => {
      if (!user || !athleteId) throw new Error("Missing data");
      const { error } = await (supabase as any).from("parent_support_questions").insert({
        parent_user_id: user.id, athlete_user_id: athleteId,
        week_start: weekStart, question: weekQuestion.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-messages", athleteId, user?.id] });
      setWeekQuestion("");
      toast({ title: "Message sent", description: "Your coach will reply soon." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Save emergency info
  const saveEmergencyInfo = async () => {
    if (!user) return;
    setEmergencySaving(true);
    try {
      await supabase.from("profiles").update({
        phone: emergencyForm.phone || null,
        ...(({ emergency_contact_name: emergencyForm.emergencyContactName || null,
          emergency_contact_phone: emergencyForm.emergencyContactPhone || null,
          emergency_notes: emergencyForm.emergencyNotes || null }) as any),
      } as any).eq("user_id", user.id);
      await refetchParentProfile();
      toast({ title: "Saved", description: "Emergency info updated." });
    } catch {
      toast({ title: "Error saving info", variant: "destructive" });
    } finally {
      setEmergencySaving(false);
    }
  };

  // Send chat message
  const sendChatMessage = async () => {
    if (!chatInput.trim() || chatSending) return;
    const userMsg: ChatMessage = { role: "user", content: chatInput.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    setChatInput("");
    setChatSending(true);
    try {
      const athleteContext = [
        `Athlete name: ${athleteName}`,
        athleteLink?.position ? `Position: ${athleteLink.position}` : null,
        `Current engagement: ${engagement.signal}`,
        activeGoal ? `Active goal: ${activeGoal.title}` : null,
      ].filter(Boolean).join("\n");
      const { data, error } = await supabase.functions.invoke("parent-assistant", {
        body: { messages: updated.map(m => ({ role: m.role, content: m.content })), athleteContext },
      });
      if (error) throw error;
      setChatMessages([...updated, { role: "assistant", content: data.content }]);
    } catch {
      toast({ title: "Assistant unavailable", description: "Please try again.", variant: "destructive" });
    } finally {
      setChatSending(false);
    }
  };

  // ── Sub-components ──────────────────────────────────────────────────────────

  const BackButton = () => (
    <button onClick={() => setView("home")} className="flex items-center gap-1.5 text-sm text-muted-foreground mb-5 hover:text-foreground transition-colors">
      <ArrowLeft className="h-4 w-4" /> Back
    </button>
  );

  const PremiumGate = ({ feature }: { feature: string }) => (
    <Card className="border-primary/20 bg-primary/5">
      <CardContent className="py-8 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-primary/60" />
        <div>
          <p className="font-semibold text-sm">Premium Feature</p>
          <p className="text-xs text-muted-foreground mt-1">{feature}</p>
        </div>
        <Button size="sm" onClick={() => setShowUpgrade(true)}>
          <Sparkles className="h-3.5 w-3.5 mr-1.5" /> Upgrade to Premium
        </Button>
      </CardContent>
    </Card>
  );

  // ── No athlete linked ───────────────────────────────────────────────────────
  if (athleteId === null && link !== undefined) {
    return (
      <DashboardLayout role="parent">
        <Card>
          <CardContent className="py-16 text-center">
            <Target className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium">No athlete linked yet</p>
            <p className="text-sm text-muted-foreground mt-1 max-w-xs mx-auto">
              Your coach will send you an invite to connect your account.
            </p>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="parent">

      {/* ── Upgrade Modal ─────────────────────────────────────────────────── */}
      {showUpgrade && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end sm:items-center justify-center p-4">
          <Card className="w-full max-w-sm">
            <CardContent className="p-6 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-lg font-bold font-['Space_Grotesk']">Upgrade to Premium</p>
                <p className="text-sm text-muted-foreground mt-1">Full access to your athlete's development</p>
              </div>
              <div className="rounded-xl bg-secondary/50 p-4 text-left space-y-2.5">
                {[
                  "Full development goals & progress bars",
                  "Complete upcoming schedule",
                  "AI Assistant for personalized tips",
                  "Full communications history",
                  "Coach-shared notes & updates",
                ].map(f => (
                  <div key={f} className="flex items-center gap-2 text-sm">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                    <span>{f}</span>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-2xl font-bold">$4.99
                  <span className="text-sm font-normal text-muted-foreground"> / month</span>
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">Cancel anytime</p>
              </div>
              <Button className="w-full" disabled>Coming Soon · Stripe Integration</Button>
              <button onClick={() => setShowUpgrade(false)} className="text-xs text-muted-foreground hover:text-foreground">
                Maybe later
              </button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Athlete Header ─────────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 mb-6">
        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary font-['Space_Grotesk'] shrink-0">
          {initials}
        </div>
        <div>
          <p className="text-lg font-bold font-['Space_Grotesk'] leading-tight">{athleteName}</p>
          {athleteLink?.position && <p className="text-sm text-muted-foreground">{athleteLink.position}</p>}
        </div>
        {!isPremium && view === "home" && (
          <button
            onClick={() => setShowUpgrade(true)}
            className="ml-auto flex items-center gap-1 text-xs text-primary border border-primary/30 rounded-full px-2.5 py-1 hover:bg-primary/5 transition-colors"
          >
            <Sparkles className="h-3 w-3" /> Upgrade
          </button>
        )}
      </div>

      {/* ══ HOME VIEW ══════════════════════════════════════════════════════════ */}
      {view === "home" && (
        <div className="space-y-3">

          {/* Schedule */}
          <button onClick={() => setView("schedule")} className="w-full text-left">
            <Card className="hover:bg-secondary/30 transition-colors active:scale-[0.99]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                    <CalendarDays className="h-5 w-5 text-blue-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Schedule</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {nextSession
                        ? `${nextSession.title} · ${formatSessionDate(nextSession.scheduled_date)}`
                        : "No upcoming sessions"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </button>

          {/* Development */}
          <button onClick={() => setView("development")} className="w-full text-left">
            <Card className="hover:bg-secondary/30 transition-colors active:scale-[0.99]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="h-5 w-5 text-emerald-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Development</p>
                    <div className={`mt-0.5 inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${engagementStyle[engagement.color]}`}>
                      {engagement.signal}
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </button>

          {/* Communications */}
          <button onClick={() => { markCommsAsRead(); setView("communications"); }} className="w-full text-left">
            <Card className={`hover:bg-secondary/30 transition-colors active:scale-[0.99] ${hasUnreadComms ? "border-violet-500/40" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="relative h-10 w-10 shrink-0">
                    <div className="h-10 w-10 rounded-xl bg-violet-500/10 flex items-center justify-center">
                      <MessageCircle className="h-5 w-5 text-violet-400" />
                    </div>
                    {hasUnreadComms && (
                      <span className="absolute -top-0.5 -right-0.5 h-3 w-3 rounded-full bg-red-500 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Communications</p>
                    <p className="text-xs text-muted-foreground">
                      {hasUnreadComms
                        ? "Coach replied — tap to read"
                        : (allMessages as any[]).length > 0
                        ? `${(allMessages as any[]).length} message${(allMessages as any[]).length !== 1 ? "s" : ""}`
                        : "Send a message to your coach"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </button>

          {/* Emergency Info */}
          <button onClick={() => setView("emergency")} className="w-full text-left">
            <Card className="hover:bg-secondary/30 transition-colors active:scale-[0.99]">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center shrink-0">
                    <ShieldAlert className="h-5 w-5 text-red-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm">Emergency Info</p>
                    <p className="text-xs text-muted-foreground">
                      {parentProfile?.phone ? "Contact info on file ✓" : "Add your emergency contact info"}
                    </p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                </div>
              </CardContent>
            </Card>
          </button>

          {/* AI Assistant */}
          <button onClick={() => setView("assistant")} className="w-full text-left">
            <Card className={`hover:bg-secondary/30 transition-colors active:scale-[0.99] ${!isPremium ? "border-primary/20" : ""}`}>
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${isPremium ? "bg-primary/10" : "bg-muted"}`}>
                    <Bot className={`h-5 w-5 ${isPremium ? "text-primary" : "text-muted-foreground"}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">AI Assistant</p>
                      {!isPremium && (
                        <Badge variant="outline" className="text-[10px] text-primary border-primary/30">Premium</Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">Personalized tips to support your athlete</p>
                  </div>
                  {isPremium
                    ? <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                    : <Lock className="h-4 w-4 text-muted-foreground shrink-0" />}
                </div>
              </CardContent>
            </Card>
          </button>
        </div>
      )}

      {/* ══ SCHEDULE VIEW ══════════════════════════════════════════════════════ */}
      {view === "schedule" && (
        <div>
          <BackButton />
          <p className="font-bold text-base font-['Space_Grotesk'] mb-4">Upcoming Schedule</p>
          <div className="space-y-3">
            {dedupedSchedule.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <CalendarDays className="h-9 w-9 mx-auto text-muted-foreground mb-3" />
                  <p className="font-medium text-sm">No upcoming sessions</p>
                  <p className="text-xs text-muted-foreground mt-1">Check back when your coach schedules something.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {(isPremium ? dedupedSchedule : dedupedSchedule.slice(0, 5)).map((session: any) => {
                  const alreadyReported = !!absencesByScheduleId[session.id];
                  const isOpen = absenceSessionId === session.id;
                  return (
                  <Card key={session.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      <div className="flex items-stretch">
                        <div className={`w-1.5 shrink-0 ${SESSION_COLOR_MAP[session.color] ?? SESSION_COLOR_MAP.default}`} />
                        <div className="flex-1 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1 min-w-0">
                              <p className="font-semibold text-sm leading-tight">{session.title}</p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
                                <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <CalendarDays className="h-3 w-3" />{formatSessionDate(session.scheduled_date)}
                                </span>
                                {session.start_time && (
                                  <span className="flex items-center gap-1 text-xs text-muted-foreground">
                                    <Clock className="h-3 w-3" />{session.start_time.slice(0, 5)}
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
                              <Badge variant="outline" className="text-[10px] bg-blue-500/10 text-blue-400 border-blue-500/20 shrink-0">Game</Badge>
                            )}
                          </div>

                          {/* Absence reporting */}
                          <div className="mt-3 pt-3 border-t border-border/50">
                            {alreadyReported ? (
                              <div className="flex items-center gap-1.5 text-xs text-orange-400">
                                <CalendarX className="h-3.5 w-3.5" />
                                <span>Absence reported</span>
                                {absencesByScheduleId[session.id]?.reason && (
                                  <span className="text-muted-foreground">· {absencesByScheduleId[session.id].reason}</span>
                                )}
                              </div>
                            ) : isOpen ? (
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Reason (optional)"
                                  value={absenceReason}
                                  onChange={e => setAbsenceReason(e.target.value)}
                                  className="min-h-[60px] text-xs"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="flex-1 h-7 text-xs"
                                    onClick={() => reportAbsenceMutation.mutate({ scheduleId: session.id, reason: absenceReason })}
                                    disabled={reportAbsenceMutation.isPending}
                                  >
                                    {reportAbsenceMutation.isPending && <Loader2 className="h-3 w-3 animate-spin mr-1" />}
                                    Submit
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-7 text-xs"
                                    onClick={() => { setAbsenceSessionId(null); setAbsenceReason(""); }}
                                  >
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                onClick={() => setAbsenceSessionId(session.id)}
                                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-orange-400 transition-colors"
                              >
                                <CalendarX className="h-3.5 w-3.5" /> Report Absence
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                  );
                })}
                {!isPremium && dedupedSchedule.length > 5 && (
                  <PremiumGate feature="See all upcoming sessions with Premium" />
                )}
              </>
            )}
          </div>
        </div>
      )}

      {/* ══ DEVELOPMENT VIEW ═══════════════════════════════════════════════════ */}
      {view === "development" && (
        <div>
          <BackButton />
          <p className="font-bold text-base font-['Space_Grotesk'] mb-4">Development</p>
          <div className="space-y-4">
            {/* Engagement — always free */}
            <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium border ${engagementStyle[engagement.color]}`}>
              <span>{engagement.signal}</span>
              <span className="text-xs font-normal opacity-80">· {engagement.desc}</span>
            </div>

            {/* Active goal — title always visible, progress gated */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Current Focus</p>
                {activeGoal ? (
                  <>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold text-sm leading-snug flex-1">{activeGoal.title}</p>
                      <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${CATEGORY_COLORS[activeGoal.category] ?? ""}`}>
                        {activeGoal.category?.replace("_", " ")}
                      </Badge>
                    </div>
                    {activeGoal.target && (
                      <p className="text-xs text-muted-foreground">Target: {activeGoal.target}</p>
                    )}
                    {isPremium ? (
                      <>
                        <Progress value={activeGoal.progress} className="h-2" />
                        <p className="text-xs text-muted-foreground">
                          {activeGoal.progress >= 40 ? "✓ On Track" : "In Progress"}
                        </p>
                      </>
                    ) : (
                      <button onClick={() => setShowUpgrade(true)} className="flex items-center gap-1.5 text-xs text-primary mt-1">
                        <Lock className="h-3 w-3" /> Unlock progress details with Premium
                      </button>
                    )}
                  </>
                ) : (
                  <p className="text-sm text-muted-foreground">No active goals at the moment.</p>
                )}
              </CardContent>
            </Card>

            {/* Full goals list — premium */}
            {isPremium ? (
              goals.length > 0 && (
                <Card>
                  <CardContent className="p-4">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-3">All Goals</p>
                    <div className="space-y-2.5">
                      {goals.map((goal: any) => (
                        <div key={goal.id} className="flex items-center gap-3">
                          {goal.completed_at
                            ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                            : <Circle className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <span className="text-sm flex-1 leading-snug">{goal.title}</span>
                          <Badge variant="outline" className={`text-[10px] capitalize shrink-0 ${CATEGORY_COLORS[goal.category] ?? ""}`}>
                            {goal.category?.replace("_", " ")}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )
            ) : (
              <PremiumGate feature="See all development goals & progress with Premium" />
            )}

            {/* Coach notes — premium */}
            {isPremium && sharedNotes.length > 0 && (
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
          </div>
        </div>
      )}

      {/* ══ COMMUNICATIONS VIEW ════════════════════════════════════════════════ */}
      {view === "communications" && (
        <div>
          <BackButton />
          <p className="font-bold text-base font-['Space_Grotesk'] mb-1">Communications</p>
          <p className="text-sm text-muted-foreground mb-5">Send a message to your coach and see their replies here.</p>
          <div className="space-y-4">
            {/* Full message thread */}
            {(allMessages as any[]).length > 0 && (
              <div className="space-y-2">
                {(allMessages as any[]).map((msg: any) => (
                  <div key={msg.id} className="space-y-2">
                    {/* Parent message */}
                    <div className="flex justify-end">
                      <div className="max-w-[85%] bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2.5">
                        <p className="text-sm leading-relaxed">{msg.question}</p>
                        <p className="text-[10px] opacity-60 mt-1 text-right">
                          {new Date(msg.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </p>
                      </div>
                    </div>
                    {/* Coach reply */}
                    {msg.coach_reply && (
                      <div className="flex justify-start">
                        <div className="max-w-[85%] bg-secondary/60 rounded-2xl rounded-bl-sm px-4 py-2.5">
                          <p className="text-[10px] text-muted-foreground font-medium mb-1">Coach</p>
                          <p className="text-sm leading-relaxed">{msg.coach_reply}</p>
                          {msg.replied_at && (
                            <p className="text-[10px] opacity-60 mt-1">
                              {new Date(msg.replied_at).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                    {!msg.coach_reply && (
                      <p className="text-[11px] text-muted-foreground italic pl-1">Waiting for a reply…</p>
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* New message input — always visible */}
            <Card>
              <CardContent className="p-4 space-y-3">
                <Textarea
                  placeholder="Write your message..."
                  value={weekQuestion}
                  onChange={e => setWeekQuestion(e.target.value)}
                  className="min-h-[80px] text-sm"
                />
                <Button
                  className="w-full"
                  onClick={() => submitQuestionMutation.mutate()}
                  disabled={!weekQuestion.trim() || submitQuestionMutation.isPending}
                >
                  {submitQuestionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
                  Send Message
                </Button>
              </CardContent>
            </Card>

            {/* Question history — premium */}
            {isPremium ? (
              <p className="text-xs text-muted-foreground text-center">Full message history coming soon.</p>
            ) : (
              <PremiumGate feature="See full communication history with Premium" />
            )}
          </div>
        </div>
      )}

      {/* ══ EMERGENCY INFO VIEW ════════════════════════════════════════════════ */}
      {view === "emergency" && (
        <div>
          <BackButton />
          <p className="font-bold text-base font-['Space_Grotesk'] mb-1">Emergency Info</p>
          <p className="text-sm text-muted-foreground mb-5">
            This information is visible to your athlete's coach in case of an emergency.
          </p>
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Your Contact</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Your Phone Number</label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="(555) 000-0000"
                      value={emergencyForm.phone}
                      onChange={e => setEmergencyForm(f => ({ ...f, phone: e.target.value }))}
                      className="pl-9"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-4">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Backup Emergency Contact</p>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Contact Name</label>
                  <Input
                    placeholder="Full name"
                    value={emergencyForm.emergencyContactName}
                    onChange={e => setEmergencyForm(f => ({ ...f, emergencyContactName: e.target.value }))}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs text-muted-foreground">Contact Phone</label>
                  <Input
                    placeholder="(555) 000-0000"
                    value={emergencyForm.emergencyContactPhone}
                    onChange={e => setEmergencyForm(f => ({ ...f, emergencyContactPhone: e.target.value }))}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Medical Notes</p>
                <Textarea
                  placeholder="Allergies, medications, conditions your coach should know about..."
                  value={emergencyForm.emergencyNotes}
                  onChange={e => setEmergencyForm(f => ({ ...f, emergencyNotes: e.target.value }))}
                  className="min-h-[90px] text-sm"
                />
              </CardContent>
            </Card>

            <Button className="w-full" onClick={saveEmergencyInfo} disabled={emergencySaving}>
              {emergencySaving && <Loader2 className="h-3.5 w-3.5 animate-spin mr-2" />}
              Save Emergency Info
            </Button>
          </div>
        </div>
      )}

      {/* ══ AI ASSISTANT VIEW ══════════════════════════════════════════════════ */}
      {view === "assistant" && (
        <div className="flex flex-col h-full">
          <BackButton />
          <p className="font-bold text-base font-['Space_Grotesk'] mb-1">AI Assistant</p>
          <p className="text-sm text-muted-foreground mb-5">Ask anything about supporting your athlete's development.</p>

          {!isPremium ? (
            <PremiumGate feature="Chat with an AI assistant to get personalized tips on how to support your athlete at home" />
          ) : (
            <div className="flex flex-col gap-4">
              {/* Chat messages */}
              <div className="space-y-3 min-h-[200px]">
                {chatMessages.length === 0 && (
                  <div className="rounded-xl bg-secondary/40 p-4 text-center text-sm text-muted-foreground">
                    <Bot className="h-8 w-8 mx-auto mb-2 text-primary/60" />
                    Ask me how to support {athleteProfile?.first_name ?? "your athlete"}'s development at home.
                  </div>
                )}
                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "bg-primary text-primary-foreground rounded-br-sm"
                        : "bg-secondary/60 text-foreground rounded-bl-sm"
                    }`}>
                      {msg.content}
                    </div>
                  </div>
                ))}
                {chatSending && (
                  <div className="flex justify-start">
                    <div className="bg-secondary/60 rounded-2xl rounded-bl-sm px-4 py-3">
                      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                    </div>
                  </div>
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Ask a question..."
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChatMessage(); } }}
                  className="flex-1"
                  disabled={chatSending}
                />
                <Button onClick={sendChatMessage} disabled={!chatInput.trim() || chatSending} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

    </DashboardLayout>
  );
};

export default ParentDashboard;
