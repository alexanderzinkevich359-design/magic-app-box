import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
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
import { Users, Plus, StickyNote, Target, ChevronRight, ChevronLeft, Loader2, Dumbbell, Trash2, Video, Mail, Clock, CheckCircle2, XCircle, X, RefreshCw, Copy, Film, Activity, Sparkles, Lock, BookOpen, BookMarked, AlertTriangle, TrendingUp, ShieldAlert, UserPlus, MessageSquare, QrCode, Pencil, Check } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";
import ImprovementVideos from "@/components/ImprovementVideos";
import AthleteVideoSubmissions from "@/components/AthleteVideoSubmissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAIPremium } from "@/hooks/useAIPremium";
import { useAllSportConfigs, buildSportConfigMap } from "@/hooks/useSportConfig";
import type { SportMetric } from "@/lib/sports/types";
import AIPremiumModal from "@/components/AIPremiumModal";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import UpgradeModal from "@/components/UpgradeModal";
import { generateReflectionSummary } from "@/lib/ai/reflectionService";
import { suggestGoals } from "@/lib/ai/goalService";
import { generateAthleteSummary, formatReportForCopy } from "@/lib/ai/reportService";
import type { AIOutput, GoalSuggestion } from "@/lib/ai/types";

const HANDS = ["Right", "Left", "Switch"] as const;


const AI_WORKOUT_DRILLS: Record<string, { name: string; rep_scheme: string; instructions: string }[]> = {
  "Arm Strength": [
    { name: "Band Pull-Aparts", rep_scheme: "3×15", instructions: "Hold band shoulder-width, pull apart keeping arms straight, squeeze shoulder blades." },
    { name: "External Rotation with Band", rep_scheme: "3×12 each arm", instructions: "90/90 position with band, rotate forearm up and back, controlled motion." },
    { name: "Shadow Throwing Mechanics", rep_scheme: "3×10", instructions: "Stand in athletic stance and go through full throwing motion at game speed. Focus on hip-to-shoulder sequence, arm path, and follow-through. No ball needed." },
    { name: "Wrist Curls", rep_scheme: "3×20", instructions: "Seated, forearm on thigh, curl wrist up and lower slowly. Bodyweight only — no weight needed." },
    { name: "Towel Drill", rep_scheme: "3×10", instructions: "Hold towel at end, go through full throwing motion focusing on release point and wrist snap." },
    { name: "Towel Snap Throws", rep_scheme: "3×10 each side", instructions: "Hold one end of a household towel. Rotate your core and snap it explosively across your body, simulating throwing force with full hip drive." },
    { name: "Pike Push-Up", rep_scheme: "3×10", instructions: "Start in downward dog position with hips high. Bend elbows to lower head toward floor, then press back up. Builds shoulder stability and strength." },
    { name: "Long Toss Simulation", rep_scheme: "10 min", instructions: "Full throwing motion without ball; focus on hip rotation and follow-through. Gradually increase effort level each set." },
    { name: "Floor Y-T-W", rep_scheme: "3×10 each position", instructions: "Lie face down, arms fully extended. Lift arms to form Y, then T, then W shapes. Squeeze shoulder blades together and hold 1 sec each. No equipment needed." },
    { name: "Diamond Push-Up", rep_scheme: "3×8", instructions: "Place hands close together forming a diamond shape on the floor. Lower chest to hands with elbows tucked close to body, then press back up. Builds triceps and shoulder stability." },
  ],
  "Footwork & Agility": [
    { name: "Ladder In/Out Drill", rep_scheme: "4×20 yds", instructions: "Step in and out of each ladder box (or use chalk/tape lines), stay on balls of feet." },
    { name: "T-Cone Drill", rep_scheme: "5 reps", instructions: "Sprint 5 yds, shuffle left 5 yds, shuffle right 10 yds, shuffle back, backpedal to start. Use any markers." },
    { name: "Lateral Shuffle", rep_scheme: "3×30 sec", instructions: "Low stance, shuffle laterally without crossing feet. Touch a marker on each end." },
    { name: "Squat Jumps", rep_scheme: "3×8", instructions: "Lower into squat position then explode up as high as possible. Land softly with knees bent, absorb impact through hips. No equipment needed." },
    { name: "Lateral Bounds", rep_scheme: "3×10 each side", instructions: "Jump laterally off one foot, land on opposite foot, stick the landing for 1 second, then repeat." },
    { name: "High Knees", rep_scheme: "3×20 sec", instructions: "Drive knees to hip height alternately, pump arms, stay on balls of feet." },
    { name: "Reactive Sprint", rep_scheme: "6×10 yds", instructions: "React to a self-set timer or verbal cue, sprint to assigned side. Focus on first step quickness." },
    { name: "Broad Jumps", rep_scheme: "3×5", instructions: "Two-foot takeoff, jump as far forward as possible, land softly and stick." },
    { name: "Drop-Step Drill", rep_scheme: "4×10 reps", instructions: "Shuffle 3 steps, drop to fielding position, pop back up and reset quickly." },
    { name: "Sprint-Stop-Sprint", rep_scheme: "5 reps", instructions: "Sprint 10 yds, decelerate to a full stop, plant and sprint back. Control the deceleration." },
  ],
  "Conditioning": [
    { name: "Baseline Sprints", rep_scheme: "3 rounds", instructions: "Sprint 30–90 ft at full effort. Time each round, rest 30 sec between. Simulate game-speed burst." },
    { name: "Fartlek Sprints", rep_scheme: "10 min", instructions: "Alternate 30 sec easy jog with 15 sec max effort sprint. Maintain form throughout." },
    { name: "Suicide Runs", rep_scheme: "4 reps", instructions: "Sprint to 10-yd marker and back, 20-yd and back, 30-yd and back. Rest 90 sec between each." },
    { name: "Mountain Climbers", rep_scheme: "3×30 sec", instructions: "Plank position, drive knees to chest alternately at speed while maintaining form." },
    { name: "Burpees", rep_scheme: "3×10", instructions: "Drop to push-up position, press up, jump feet to hands, explode up with hands overhead." },
    { name: "Jump Rope (or Jump Rope Simulation)", rep_scheme: "3×2 min", instructions: "Consistent pace, stay on balls of feet. If no rope, mimic the jumping rhythm — same conditioning benefit." },
    { name: "Sprint Ladders", rep_scheme: "1 set", instructions: "Sprint 10, 20, 30, 40, 30, 20, 10 yds with 30 sec rest between each distance." },
    { name: "Bear Crawls", rep_scheme: "3×20 yds", instructions: "Crawl on all fours keeping hips low and level, drive knees close to elbows." },
    { name: "Plank Hold", rep_scheme: "3×45 sec", instructions: "Forearms on ground, body straight, squeeze glutes and core, breathe steadily." },
    { name: "Broad Jump to Sprint", rep_scheme: "5 reps", instructions: "Two-foot broad jump then immediately sprint 10 yds. Focus on explosive transition from landing to sprint." },
  ],
  "Core Strength": [
    { name: "Dead Bug", rep_scheme: "3×10 each side", instructions: "Lie on back, arms up, lower opposite arm/leg simultaneously, keep low back pressed flat." },
    { name: "Pallof Press", rep_scheme: "3×12 each side", instructions: "Anchor a resistance band at chest height, press straight out and hold 2 sec, resist rotation." },
    { name: "Lying Windshield Wipers", rep_scheme: "3×10 each side", instructions: "Lie on back, raise legs vertical. Lower both legs slowly to one side, stopping before they touch the floor. Return and repeat. No equipment needed." },
    { name: "Hollow Body Hold", rep_scheme: "3×30 sec", instructions: "Arms overhead, legs raised slightly, lower back pressed into floor. Hold tension throughout." },
    { name: "Explosive Rotational Plank", rep_scheme: "3×10 each side", instructions: "From push-up position, drive one knee explosively across your body toward the opposite elbow, rotating hip and core. Return and repeat." },
    { name: "Side Plank Hip Dip", rep_scheme: "3×10 each side", instructions: "Side plank position, dip hip to floor and raise back up. Control the motion — no dropping." },
    { name: "Bird Dog", rep_scheme: "3×10 each side", instructions: "On all fours, extend opposite arm and leg simultaneously, hold 2 sec, keep back flat." },
    { name: "Russian Twists", rep_scheme: "3×20", instructions: "Seated, feet off ground, lean back slightly. Twist torso side to side through full range. Keep movement slow and controlled." },
    { name: "Copenhagen Plank", rep_scheme: "3×20 sec each side", instructions: "Side plank with top foot resting on a chair or step, bottom leg raised. Squeeze inner thigh." },
    { name: "Inchworm Push-Up", rep_scheme: "3×8", instructions: "Stand tall, hinge forward and walk hands out to a plank, do 1 push-up, walk feet back to hands, stand. That's 1 rep. No equipment needed." },
  ],
  "Mental Reps": [
    { name: "Visualization Walk-Through", rep_scheme: "10 min", instructions: "Eyes closed, visualize 10 perfect reps at your position in full detail: sights, sounds, feel." },
    { name: "Slow-Motion Mechanics Review", rep_scheme: "15 min", instructions: "Record yourself at 25% speed, identify and correct one mechanics flaw." },
    { name: "Film Study", rep_scheme: "20 min", instructions: "Watch film of yourself and a pro at your position. Write 3 differences to work on." },
    { name: "Pressure Simulation Reps", rep_scheme: "3×10", instructions: "Use your full routine (breath, cue word, focus) before each rep as if in a real game." },
    { name: "Pre-Game Routine Practice", rep_scheme: "1 session", instructions: "Write out your pre-game, in-game, and post-at-bat routine. Practice it 10 times." },
    { name: "Box Breathing", rep_scheme: "5 min", instructions: "Inhale 4 sec, hold 4 sec, exhale 4 sec, hold 4 sec. Repeat. Use before high-pressure reps." },
    { name: "Positive Self-Talk Practice", rep_scheme: "10 min", instructions: "Write 5 performance cues. Say each aloud 5 times with full intention." },
    { name: "Goal Review", rep_scheme: "10 min", instructions: "Review your goals, visualize achieving each one, write one action step per goal for today." },
    { name: "Reset Routine Drill", rep_scheme: "10 reps", instructions: "Simulate an error or bad rep, practice your full reset routine each time." },
    { name: "Confidence Statement Log", rep_scheme: "5 min", instructions: "Write 5 things you do well. Read aloud. Revisit this log before games." },
  ],
};

const DURATION_DRILL_COUNT: Record<string, number> = { "15": 3, "30": 5, "45": 7, "60": 10 };

const AI_FOCUS_AREAS = ["Arm Strength", "Footwork & Agility", "Conditioning", "Core Strength", "Mental Reps"];

type AthleteWithDetails = {
  id: string;
  athlete_user_id: string;
  sport_id: string;
  position?: string;
  throw_hand?: string | null;
  bat_hand?: string | null;
  jersey_number?: string | null;
  height?: string | null;
  weight_lbs?: number | null;
  school?: string | null;
  grad_year?: number | null;
  hometown?: string | null;
  bio?: string | null;
  fun_facts?: string | null;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
  notes: { id: string; note: string; created_at: string; is_private: boolean; visible_to_parent: boolean }[];
  goals: { id: string; title: string; target: string; progress: number; completed_at: string | null; is_measurable: boolean; category: string }[];
  assignedPrograms: { id: string; program_id: string; status: string; program: { id: string; name: string; description: string | null } | null }[];
};

const CoachAthletes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const navigate = useNavigate();

  const { data: sportConfigs = [] } = useAllSportConfigs();
  const sportConfigMap = useMemo(() => buildSportConfigMap(sportConfigs), [sportConfigs]);
  const [newSportId, setNewSportId] = useState("");
  useEffect(() => {
    if (sportConfigs.length > 0 && !newSportId) {
      const baseball = sportConfigs.find((c) => c.slug === "baseball");
      setNewSportId(baseball?.id ?? sportConfigs[0]?.id ?? "");
    }
  }, [sportConfigs]);

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showQRDialog, setShowQRDialog] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [athleteDetailTab, setAthleteDetailTab] = useState("overview");

  // Track which athlete's parent questions the coach has seen (localStorage-backed)
  const [pqSeenTimestamps, setPqSeenTimestamps] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!user?.id) return;
    try {
      const stored = localStorage.getItem(`coach_pq_seen_${user.id}`);
      if (stored) setPqSeenTimestamps(JSON.parse(stored));
    } catch {}
  }, [user?.id]);

  const markAthleteQuestionsRead = (athleteId: string) => {
    if (!user?.id) return;
    const ts = new Date().toISOString();
    const updated = { ...pqSeenTimestamps, [athleteId]: ts };
    setPqSeenTimestamps(updated);
    localStorage.setItem(`coach_pq_seen_${user.id}`, JSON.stringify(updated));
  };

  // Reset detail tab when athlete selection changes
  useEffect(() => {
    setAthleteDetailTab("overview");
  }, [selectedAthleteId]);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showAssignProgram, setShowAssignProgram] = useState(false);
  const [showAiGenDialog, setShowAiGenDialog] = useState(false);
  const [aiGenFocus, setAiGenFocus] = useState("Arm Strength");
  const [aiGenDuration, setAiGenDuration] = useState("30");
  const [aiGenStep, setAiGenStep] = useState<"config" | "preview">("config");
  const [generatedDrills, setGeneratedDrills] = useState<{ key: string; name: string; rep_scheme: string; instructions: string }[]>([]);
  const [editingDrillKey, setEditingDrillKey] = useState<string | null>(null);
  const [editDrillName, setEditDrillName] = useState("");
  const [editDrillReps, setEditDrillReps] = useState("");
  const [editDrillInstructions, setEditDrillInstructions] = useState("");
  const [customDrillName, setCustomDrillName] = useState("");
  const [customDrillReps, setCustomDrillReps] = useState("");
  const [customDrillInstructions, setCustomDrillInstructions] = useState("");

  // Add athlete form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPosition, setNewPosition] = useState<string>("");
  const [newThrowHand, setNewThrowHand] = useState("");
  const [newBatHand, setNewBatHand] = useState("");

  // Note form
  const [noteText, setNoteText] = useState("");
  const [noteIsPrivate, setNoteIsPrivate] = useState(true);
  const [noteVisibleToParent, setNoteVisibleToParent] = useState(false);

  // Parent invite
  const [showParentInviteDialog, setShowParentInviteDialog] = useState(false);
  const [parentInviteName, setParentInviteName] = useState("");
  const [parentInviteEmail, setParentInviteEmail] = useState("");

  // Parent question reply
  const [replyingQuestionId, setReplyingQuestionId] = useState<string | null>(null);
  const [questionReplyText, setQuestionReplyText] = useState("");

  // Goal form
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalIsMeasurable, setGoalIsMeasurable] = useState(true);
  const [goalCategory, setGoalCategory] = useState<"skill" | "conditioning" | "mindset" | "coach_assigned">("coach_assigned");
  const [showLibrary, setShowLibrary] = useState(false);


  // Program assignment
  const [selectedProgramId, setSelectedProgramId] = useState("");

  // Metric recording
  const [metricValues, setMetricValues] = useState<Record<string, string>>({});
  const [metricNotes, setMetricNotes] = useState("");

  // Profile edit state — synced when selected athlete changes
  const [profileEdits, setProfileEdits] = useState({
    jersey_number: "", height: "", weight_lbs: "", school: "", grad_year: "", hometown: "", bio: "", fun_facts: "",
  });

  // Fetch athletes linked to this coach
  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["coach-athletes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links, error } = await supabase
        .from("coach_athlete_links")
        .select("id, athlete_user_id, sport_id, position, throw_hand, bat_hand, jersey_number, height, weight_lbs, school, grad_year, hometown, bio, fun_facts")
        .eq("coach_user_id", user.id);
      if (error) throw error;
      if (!links?.length) return [];

      const athleteIds = links.map((l) => l.athlete_user_id);
      const [profilesRes, notesRes, goalsRes, programsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", athleteIds),
        (supabase as any).from("coach_notes").select("id, athlete_id, note, created_at, is_private, visible_to_parent").eq("coach_id", user.id).in("athlete_id", athleteIds).order("created_at", { ascending: false }),
        supabase.from("athlete_goals").select("id, athlete_id, title, target, progress, completed_at, is_measurable, category").in("athlete_id", athleteIds),
        supabase.from("athlete_programs").select("id, athlete_id, program_id, status, program:programs(id, name, description)").in("athlete_id", athleteIds),
      ]);

      return links.map((link) => ({
        id: link.id,
        athlete_user_id: link.athlete_user_id,
        sport_id: link.sport_id || "",
        position: link.position,
        throw_hand: link.throw_hand,
        bat_hand: link.bat_hand,
        jersey_number: (link as any).jersey_number || null,
        height: (link as any).height || null,
        weight_lbs: (link as any).weight_lbs || null,
        school: (link as any).school || null,
        grad_year: (link as any).grad_year || null,
        hometown: (link as any).hometown || null,
        bio: (link as any).bio || null,
        fun_facts: (link as any).fun_facts || null,
        profile: profilesRes.data?.find((p) => p.user_id === link.athlete_user_id) || null,
        notes: notesRes.data?.filter((n) => n.athlete_id === link.athlete_user_id) || [],
        goals: ((goalsRes.data as any[]) || []).filter((g) => g.athlete_id === link.athlete_user_id),
        assignedPrograms: (programsRes.data?.filter((p: any) => p.athlete_id === link.athlete_user_id) || []) as any[],
      })) as AthleteWithDetails[];
    },
    enabled: !!user,
  });

  // Fetch coach's published programs for assignment
  const { data: coachPrograms = [] } = useQuery({
    queryKey: ["coach-programs-published", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("programs")
        .select("id, name, description")
        .eq("coach_id", user.id)
        .eq("is_published", true);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  const selectedAthlete = selectedAthleteId ? athletes.find((a) => a.athlete_user_id === selectedAthleteId) ?? null : null;
  const athleteSportConfig = sportConfigMap.get(selectedAthlete?.sport_id ?? "") ?? null;
  const positionMetrics: SportMetric[] = athleteSportConfig?.metrics_by_position[selectedAthlete?.position ?? ""] ?? [];

  // Fetch metrics for selected athlete
  const { data: athleteMetrics = [] } = useQuery({
    queryKey: ["athlete-metrics", selectedAthleteId],
    queryFn: async () => {
      if (!selectedAthleteId) return [];
      const { data, error } = await supabase
        .from("athlete_metrics")
        .select("*")
        .eq("athlete_id", selectedAthleteId)
        .order("recorded_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedAthleteId,
  });

  // Fetch reflections for selected athlete (coach can read via RLS)
  const { data: athleteReflections = [] } = useQuery({
    queryKey: ["athlete-reflections", selectedAthleteId],
    queryFn: async () => {
      if (!selectedAthleteId) return [];
      const { data } = await (supabase as any)
        .from("weekly_reflections")
        .select("id, week_start, what_went_well, needs_improvement, self_rating, coach_comment")
        .eq("athlete_id", selectedAthleteId)
        .order("week_start", { ascending: false })
        .limit(12);
      return data || [];
    },
    enabled: !!selectedAthleteId,
  });

  // Coach comment state
  const [commentingReflectionId, setCommentingReflectionId] = useState<string | null>(null);
  const [coachCommentText, setCoachCommentText] = useState("");

  // Trial + upgrade
  const { athleteLimit, isExpired: trialExpired, isPaid } = useTrialStatus();
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // AI state
  const { isEnabled: aiEnabled } = useAIPremium();
  const [showAIModal, setShowAIModal] = useState(false);
  const [reflectionSummaries, setReflectionSummaries] = useState<Record<string, AIOutput>>({});
  const [generatingReflectionId, setGeneratingReflectionId] = useState<string | null>(null);
  const [aiGoalSuggestions, setAiGoalSuggestions] = useState<GoalSuggestion[] | null>(null);
  const [loadingGoalSuggestions, setLoadingGoalSuggestions] = useState(false);
  const [athleteSummary, setAthleteSummary] = useState<AIOutput | null>(null);
  const [generatingAthleteSummary, setGeneratingAthleteSummary] = useState(false);

  const addCoachCommentMutation = useMutation({
    mutationFn: async ({ reflectionId, comment }: { reflectionId: string; comment: string }) => {
      const { error } = await (supabase as any)
        .from("weekly_reflections")
        .update({ coach_comment: comment, commented_by: user!.id })
        .eq("id", reflectionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-reflections", selectedAthleteId] });
      setCommentingReflectionId(null);
      setCoachCommentText("");
      toast({ title: "Comment saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: async ({ athleteId, note, is_private, visible_to_parent }: { athleteId: string; note: string; is_private: boolean; visible_to_parent: boolean }) => {
      const { error } = await (supabase as any).from("coach_notes").insert({ coach_id: user!.id, athlete_id: athleteId, note, is_private, visible_to_parent });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setNoteText(""); setNoteIsPrivate(true); setNoteVisibleToParent(false);
      toast({ title: "Note added" });
    },
  });

  const updateNoteMutation = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: { is_private?: boolean; visible_to_parent?: boolean } }) => {
      const { error } = await (supabase as any).from("coach_notes").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-athletes"] }),
  });

  const sendParentInviteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAthleteId) throw new Error("Missing data");
      const { data: coachProfile } = await supabase.from("profiles").select("first_name, last_name").eq("user_id", user.id).single();
      const coachName = coachProfile ? `${coachProfile.first_name} ${coachProfile.last_name}`.trim() : "Your coach";
      const athleteName = selectedAthlete?.profile ? `${selectedAthlete.profile.first_name} ${selectedAthlete.profile.last_name}`.trim() : "Athlete";
      const { data: inv, error } = await (supabase as any)
        .from("parent_invites")
        .insert({ coach_id: user.id, athlete_user_id: selectedAthleteId, parent_name: parentInviteName.trim(), parent_email: parentInviteEmail.toLowerCase().trim() })
        .select("token")
        .single();
      if (error) throw error;
      const signupUrl = `${window.location.origin}/signup?parent_token=${inv.token}`;
      const { data: emailResult, error: emailError } = await supabase.functions.invoke("send-parent-invite-email", {
        body: { parentEmail: parentInviteEmail, parentName: parentInviteName, coachName, athleteName, signupUrl },
      });
      if (emailError) throw new Error(`Invite created but email failed: ${emailError.message}`);
      if (emailResult?.warning) throw new Error(`Invite created but email not sent — ${emailResult.warning}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-parent-invites", selectedAthleteId] });
      setShowParentInviteDialog(false);
      setParentInviteName(""); setParentInviteEmail("");
      toast({ title: "Invite sent!", description: "Parent will receive an email to create their account." });
    },
    onError: (e: any) => toast({ title: "Error sending invite", description: e.message, variant: "destructive" }),
  });

  const cancelParentInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await (supabase as any).from("parent_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pending-parent-invites", selectedAthleteId] });
      toast({ title: "Invite cancelled" });
    },
  });

  const replyToParentQuestionMutation = useMutation({
    mutationFn: async ({ questionId, reply }: { questionId: string; reply: string }) => {
      const { error } = await (supabase as any)
        .from("parent_support_questions")
        .update({ coach_reply: reply, replied_by: user!.id, replied_at: new Date().toISOString() })
        .eq("id", questionId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["parent-questions", selectedAthleteId] });
      setReplyingQuestionId(null); setQuestionReplyText("");
      toast({ title: "Reply saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addGoalMutation = useMutation({
    mutationFn: async ({ athleteId, title, target, is_measurable, category }: { athleteId: string; title: string; target: string; is_measurable: boolean; category: string }) => {
      const { error } = await (supabase.from("athlete_goals") as any).insert({
        athlete_id: athleteId,
        coach_id: user!.id,
        title,
        target: is_measurable ? target : "",
        is_measurable,
        category,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setGoalTitle(""); setGoalTarget(""); setGoalIsMeasurable(true); setGoalCategory("coach_assigned");
      setShowGoalForm(false);
      toast({ title: "Goal set" });
    },
    onError: (e: any) => toast({ title: "Failed to save goal", description: e.message, variant: "destructive" }),
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number; isMeasurable?: boolean }) => {
      const { error } = await supabase.from("athlete_goals").update({ progress }).eq("id", goalId);
      if (error) throw error;
      await (supabase as any).from("goal_progress_entries").insert({ goal_id: goalId, value: progress });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-athletes"] }),
  });

  // Goal library
  const { data: goalTemplates = [] } = useQuery({
    queryKey: ["coach-goal-templates", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("coach_goal_templates")
        .select("id, title, category, is_measurable, target")
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as { id: string; title: string; category: string; is_measurable: boolean; target: string }[];
    },
    enabled: !!user,
  });

  const saveTemplateMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any).from("coach_goal_templates").insert({
        coach_id: user!.id,
        title: goalTitle,
        category: goalCategory,
        is_measurable: goalIsMeasurable,
        target: goalTarget,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-goal-templates", user?.id] });
      toast({ title: "Saved to library" });
    },
  });

  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("coach_goal_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-goal-templates", user?.id] }),
  });

  const applyTemplate = (t: typeof goalTemplates[0]) => {
    setGoalTitle(t.title);
    setGoalCategory(t.category as typeof goalCategory);
    setGoalIsMeasurable(t.is_measurable);
    setGoalTarget(t.target);
    setShowLibrary(false);
  };

  const assignProgramMutation = useMutation({
    mutationFn: async ({ athleteId, programId }: { athleteId: string; programId: string }) => {
      const { error } = await supabase.from("athlete_programs").insert({
        athlete_id: athleteId,
        program_id: programId,
        assigned_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setSelectedProgramId("");
      setShowAssignProgram(false);
      toast({ title: "Program assigned as at-home workout" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const unassignProgramMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("athlete_programs").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      toast({ title: "Workout removed" });
    },
  });

  const resetAiGenDialog = () => {
    setAiGenStep("config");
    setGeneratedDrills([]);
    setEditingDrillKey(null);
    setCustomDrillName("");
    setCustomDrillReps("");
    setCustomDrillInstructions("");
    setShowAiGenDialog(false);
  };

  const buildWorkoutPreview = () => {
    const pool = AI_WORKOUT_DRILLS[aiGenFocus] ?? AI_WORKOUT_DRILLS["Conditioning"];
    const count = DURATION_DRILL_COUNT[aiGenDuration] ?? 5;
    setGeneratedDrills(pool.slice(0, count).map((d, i) => ({ key: `d-${Date.now()}-${i}`, ...d })));
    setAiGenStep("preview");
  };

  const generateAiWorkout = useMutation({
    mutationFn: async ({ athleteId, athleteName }: { athleteId: string; athleteName: string }) => {
      // 1. Create the program
      const { data: program, error: pErr } = await supabase.from("programs").insert({
        coach_id: user!.id,
        sport_id: selectedAthlete?.sport_id || sportConfigs[0]?.id || null,
        name: `${athleteName}: ${aiGenFocus} (${aiGenDuration} min)`,
        description: `${aiGenDuration}-minute ${aiGenFocus.toLowerCase()} workout.`,
        skill_level: "1",
        is_published: true,
      }).select().single();
      if (pErr) throw pErr;

      // 2. Create a single workout block
      const { data: workout, error: wErr } = await supabase.from("workouts").insert({
        program_id: program.id,
        title: `${aiGenFocus} Circuit`,
        description: `${aiGenDuration}-minute focused session`,
        order_index: 0,
      }).select().single();
      if (wErr) throw wErr;

      // 3. Insert the (possibly edited) drills
      const drillRows = generatedDrills.map((d, i) => ({
        workout_id: workout.id,
        name: d.name,
        rep_scheme: d.rep_scheme,
        instructions: d.instructions,
        order_index: i,
      }));
      if (drillRows.length) {
        const { error: dErr } = await supabase.from("drills").insert(drillRows);
        if (dErr) throw dErr;
      }

      // 4. Assign to athlete
      const { error: aErr } = await supabase.from("athlete_programs").insert({
        athlete_id: athleteId,
        program_id: program.id,
        assigned_by: user!.id,
      });
      if (aErr) throw aErr;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      resetAiGenDialog();
      toast({ title: "Workout assigned!", description: "The athlete can now see it in their dashboard." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const recordMetricsMutation = useMutation({
    mutationFn: async ({ athleteId, sportId, metrics }: { athleteId: string; sportId: string; metrics: { type: string; value: number; unit: string; category: string }[] }) => {
      const rows = metrics.map((m) => ({
        athlete_id: athleteId,
        sport_id: sportId,
        metric_type: m.type,
        metric_category: m.category,
        value: m.value,
        unit: m.unit || null,
        notes: metricNotes || null,
        recorded_by: user!.id,
      }));
      const { error } = await supabase.from("athlete_metrics").insert(rows);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-metrics"] });
      setMetricValues({});
      setMetricNotes("");
      toast({ title: "Metrics recorded!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const updateAthleteLink = useMutation({
    mutationFn: async ({ linkId, updates }: { linkId: string; updates: Record<string, any> }) => {
      const { error } = await (supabase as any).from("coach_athlete_links").update(updates).eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      toast({ title: "Athlete updated" });
    },
    onError: (e: any) => toast({ title: "Failed to update athlete", description: e.message, variant: "destructive" }),
  });

  // Sync profile edit fields when selected athlete changes
  useEffect(() => {
    if (!selectedAthlete) return;
    setProfileEdits({
      jersey_number: selectedAthlete.jersey_number || "",
      height: selectedAthlete.height || "",
      weight_lbs: selectedAthlete.weight_lbs?.toString() || "",
      school: selectedAthlete.school || "",
      grad_year: selectedAthlete.grad_year?.toString() || "",
      hometown: selectedAthlete.hometown || "",
      bio: selectedAthlete.bio || "",
      fun_facts: selectedAthlete.fun_facts || "",
    });
  }, [selectedAthleteId]); // eslint-disable-line react-hooks/exhaustive-deps

  const saveProfileEdit = (field: string, value: string) => {
    if (!selectedAthlete) return;
    const updates: Record<string, unknown> = {};
    if (field === "weight_lbs" || field === "grad_year") {
      updates[field] = value ? parseInt(value, 10) : null;
    } else {
      updates[field] = value || null;
    }
    updateAthleteLink.mutate({ linkId: selectedAthlete.id, updates });
  };

  // Fetch pending invites
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["coach-pending-invites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("team_invites")
        .select("*")
        .eq("coach_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Linked parents for selected athlete
  const { data: linkedParents = [] } = useQuery({
    queryKey: ["linked-parents", selectedAthleteId],
    queryFn: async () => {
      if (!selectedAthleteId) return [];
      const { data: links } = await (supabase as any)
        .from("parent_athlete_links")
        .select("id, parent_user_id")
        .eq("athlete_user_id", selectedAthleteId);
      if (!links?.length) return [];
      const parentIds = links.map((l: any) => l.parent_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", parentIds);
      return links.map((l: any) => ({
        ...l,
        profile: profiles?.find((p) => p.user_id === l.parent_user_id) || null,
      }));
    },
    enabled: !!selectedAthleteId,
  });

  // Pending parent invites for selected athlete
  const { data: pendingParentInvites = [] } = useQuery({
    queryKey: ["pending-parent-invites", selectedAthleteId, user?.id],
    queryFn: async () => {
      if (!selectedAthleteId || !user) return [];
      const { data } = await (supabase as any)
        .from("parent_invites")
        .select("id, parent_name, parent_email, created_at")
        .eq("coach_id", user.id)
        .eq("athlete_user_id", selectedAthleteId)
        .eq("status", "pending");
      return data || [];
    },
    enabled: !!selectedAthleteId && !!user,
  });

  // Parent support questions for selected athlete
  const { data: parentQuestions = [] } = useQuery({
    queryKey: ["parent-questions", selectedAthleteId],
    queryFn: async () => {
      if (!selectedAthleteId) return [];
      const { data: questions } = await (supabase as any)
        .from("parent_support_questions")
        .select("id, question, coach_reply, replied_at, created_at, week_start, parent_user_id")
        .eq("athlete_user_id", selectedAthleteId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (!questions?.length) return [];
      const parentIds = [...new Set(questions.map((q: any) => q.parent_user_id))] as string[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", parentIds);
      return questions.map((q: any) => ({
        ...q,
        profile: profiles?.find((p) => p.user_id === q.parent_user_id) || null,
      }));
    },
    enabled: !!selectedAthleteId,
  });

  // Lightweight query: latest parent question timestamp per athlete (for notification dots)
  const { data: pqSummary = [] } = useQuery({
    queryKey: ["parent-questions-summary", user?.id],
    queryFn: async () => {
      if (!user || !athletes.length) return [];
      const athleteIds = athletes.map((a: any) => a.athlete_user_id);
      const { data } = await (supabase as any).from("parent_support_questions")
        .select("athlete_user_id, created_at")
        .in("athlete_user_id", athleteIds)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user && athletes.length > 0,
  });

  // Set of athleteIds that have unread parent questions
  const unreadAthletes = useMemo(() => {
    const latestPer: Record<string, string> = {};
    (pqSummary as any[]).forEach((q: any) => {
      if (!latestPer[q.athlete_user_id] || q.created_at > latestPer[q.athlete_user_id])
        latestPer[q.athlete_user_id] = q.created_at;
    });
    const set = new Set<string>();
    Object.entries(latestPer).forEach(([id, ts]) => {
      if (!pqSeenTimestamps[id] || ts > pqSeenTimestamps[id]) set.add(id);
    });
    return set;
  }, [pqSummary, pqSeenTimestamps]);

  // Helper to send invite email (fire-and-forget, don't block invite flow)
  const sendInviteEmail = async (athleteEmail: string, athleteName: string) => {
    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", user!.id)
        .single();
      const coachName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Your coach";
      const signupUrl = getInviteLink(athleteEmail);

      const { error } = await supabase.functions.invoke("send-invite-email", {
        body: { athleteEmail, athleteName, coachName, signupUrl },
      });
      if (error) {
        console.warn("Invite email could not be sent (domain not verified yet):", error);
      }
    } catch (err) {
      // Silently fail: invite was already created, email is optional
      console.warn("Invite email skipped:", err);
    }
  };

  const sendInviteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !newEmail) throw new Error("Missing fields");

      const athleteName = `${newFirstName} ${newLastName}`.trim();
      const athleteEmail = newEmail.toLowerCase().trim();

      const { error } = await supabase.from("team_invites").insert({
        coach_id: user.id,
        athlete_email: athleteEmail,
        athlete_name: athleteName,
        position: newPosition,
        throw_hand: newThrowHand || null,
        bat_hand: newBatHand || null,
        sport_id: newSportId || null,
      });
      if (error) {
        if (error.code === "23505") throw new Error("An invite has already been sent to this email.");
        throw error;
      }

      sendInviteEmail(athleteEmail, athleteName);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-pending-invites"] });
      resetAddForm();
      toast({ title: "Invite sent!", description: "The athlete will receive an email notification." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelInviteMutation = useMutation({
    mutationFn: async (inviteId: string) => {
      const { error } = await supabase.from("team_invites").delete().eq("id", inviteId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-pending-invites"] });
      toast({ title: "Invite cancelled" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const resendInviteMutation = useMutation({
    mutationFn: async (invite: any) => {
      await supabase.from("team_invites").delete().eq("id", invite.id);
      const { error } = await supabase.from("team_invites").insert({
        coach_id: user!.id,
        athlete_email: invite.athlete_email,
        athlete_name: invite.athlete_name,
        position: invite.position,
        throw_hand: invite.throw_hand,
        bat_hand: invite.bat_hand,
        sport_id: invite.sport_id,
      });
      if (error) throw error;

      sendInviteEmail(invite.athlete_email, invite.athlete_name);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-pending-invites"] });
      toast({ title: "Invite resent!", description: "A new email has been sent to the athlete." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const getInviteLink = (email: string) => {
    const baseUrl = window.location.origin;
    return `${baseUrl}/signup?email=${encodeURIComponent(email)}`;
  };

  const copyInviteLink = (email: string) => {
    navigator.clipboard.writeText(getInviteLink(email));
    toast({ title: "Link copied!", description: "Share this signup link with the athlete." });
  };

  const resetAddForm = () => {
    setNewFirstName(""); setNewLastName(""); setNewEmail(""); setNewPosition("");
    setNewThrowHand(""); setNewBatHand(""); setShowAddDialog(false);
  };

  return (
    <DashboardLayout role="coach">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Athletes</h1>
          <p className="text-muted-foreground mt-1">Manage your roster, goals, and at-home workouts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setShowQRDialog(true)}>
            <QrCode className="h-4 w-4 mr-2" /> Share QR
          </Button>
          <Button onClick={() => {
            if (athletes.length >= athleteLimit) {
              setShowUpgradeModal(true);
              return;
            }
            setShowAddDialog(true);
          }}>
            <Mail className="h-4 w-4 mr-2" /> Invite Athlete
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : athletes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="font-semibold text-lg">No athletes yet</h3>
            <p className="text-muted-foreground text-sm mt-1 mb-4">Invite athletes to join your team</p>
            <Button onClick={() => setShowAddDialog(true)}><Mail className="h-4 w-4 mr-2" /> Invite Athlete</Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {athletes.map((athlete) => (
                <button
                  key={athlete.id}
                  onClick={() => setSelectedAthleteId(athlete.athlete_user_id)}
                  className="w-full flex items-center justify-between p-4 text-left transition-colors hover:bg-secondary/50"
                >
                    <div className="flex items-center gap-4">
                      <AvatarUpload
                        userId={athlete.athlete_user_id}
                        currentUrl={athlete.profile?.avatar_url || null}
                        initials={athlete.profile ? `${athlete.profile.first_name[0]}${athlete.profile.last_name[0]}` : "??"}
                        onUploaded={() => queryClient.invalidateQueries({ queryKey: ["coach-athletes"] })}
                        size="sm"
                        canEdit={false}
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">
                            {athlete.profile ? `${athlete.profile.first_name} ${athlete.profile.last_name}` : "Unknown"}
                          </p>
                          {unreadAthletes.has(athlete.athlete_user_id) && (
                            <span className="h-2 w-2 rounded-full bg-red-500 shrink-0" />
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-sm text-muted-foreground">{athlete.position || "No position"}</span>
                          {sportConfigMap.get(athlete.sport_id)?.session_config.hasHandTracking && athlete.throw_hand && (
                            <Badge variant="outline" className="text-[10px]">Throws: {athlete.throw_hand}</Badge>
                          )}
                          {sportConfigMap.get(athlete.sport_id)?.session_config.hasHandTracking && athlete.bat_hand && (
                            <Badge variant="outline" className="text-[10px]">Bats: {athlete.bat_hand}</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  <div className="flex items-center gap-4">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-muted-foreground">
                        {athlete.goals.length} goals · {athlete.assignedPrograms.length} workouts
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

      {/* Pending Invites */}
      {pendingInvites.length > 0 && (
        <Card className="mt-6">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg font-['Space_Grotesk'] flex items-center gap-2">
              <Clock className="h-5 w-5 text-muted-foreground" /> Pending Invites
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="divide-y">
              {pendingInvites.map((invite: any) => (
                <div key={invite.id} className="flex items-center justify-between p-4 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-9 w-9 rounded-full bg-accent/30 flex items-center justify-center shrink-0">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-sm">{invite.athlete_name}</p>
                      <p className="text-xs text-muted-foreground truncate">{invite.athlete_email}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        Sent {new Date(invite.created_at).toLocaleDateString()}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Badge variant="outline" className="text-xs hidden sm:inline-flex">{invite.position}</Badge>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Copy invite link"
                      onClick={() => copyInviteLink(invite.athlete_email)}
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0"
                      title="Resend invite"
                      disabled={resendInviteMutation.isPending}
                      onClick={() => resendInviteMutation.mutate(invite)}
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                      title="Cancel invite"
                      disabled={cancelInviteMutation.isPending}
                      onClick={() => cancelInviteMutation.mutate(invite.id)}
                    >
                      <XCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* QR Code Invite Dialog */}
      <Dialog open={showQRDialog} onOpenChange={setShowQRDialog}>
        <DialogContent className="max-w-sm text-center">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Invite Athletes via QR Code</DialogTitle>
            <DialogDescription>
              Athletes scan this code to create an account and join your roster instantly.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-2">
            <div className="rounded-xl border bg-white p-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(`${window.location.origin}/signup?coach_token=${user?.id}`)}`}
                alt="Invite QR Code"
                width={200}
                height={200}
                className="rounded"
              />
            </div>
            <div className="w-full space-y-2">
              <p className="text-xs text-muted-foreground">Or share the link directly:</p>
              <div className="flex gap-2">
                <Input
                  readOnly
                  value={`${window.location.origin}/signup?coach_token=${user?.id}`}
                  className="text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => {
                    navigator.clipboard.writeText(`${window.location.origin}/signup?coach_token=${user?.id}`);
                    toast({ title: "Link copied!" });
                  }}
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              Athletes will be automatically added to your roster when they sign up.
            </p>
          </div>
        </DialogContent>
      </Dialog>

      {/* Invite Athlete Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && resetAddForm()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Invite Athlete</DialogTitle>
            <DialogDescription>Send an invite. The athlete will see it when they log in.</DialogDescription>
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
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetAddForm}>Cancel</Button>
            <Button onClick={() => sendInviteMutation.mutate()} disabled={!newFirstName || !newEmail || sendInviteMutation.isPending}>
              {sendInviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Mail className="h-4 w-4 mr-2" /> Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Athlete Detail Dialog */}
      <Dialog open={!!selectedAthlete} onOpenChange={(open) => { if (!open) setSelectedAthleteId(null); }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAthlete && (
            <>
              <DialogHeader>
                <div className="flex items-center gap-4">
                  <div className="relative shrink-0">
                    <AvatarUpload
                      userId={selectedAthlete.athlete_user_id}
                      currentUrl={selectedAthlete.profile?.avatar_url || null}
                      initials={selectedAthlete.profile ? `${selectedAthlete.profile.first_name[0]}${selectedAthlete.profile.last_name[0]}` : "??"}
                      onUploaded={() => queryClient.invalidateQueries({ queryKey: ["coach-athletes"] })}
                      size="lg"
                    />
                    {selectedAthlete.jersey_number && (
                      <div className="absolute -bottom-1 -right-1 h-5 min-w-5 px-1 rounded-full bg-primary flex items-center justify-center">
                        <span className="text-[9px] font-bold text-primary-foreground">#{selectedAthlete.jersey_number}</span>
                      </div>
                    )}
                  </div>
                  <div className="min-w-0">
                    <DialogTitle className="font-['Space_Grotesk'] text-xl">
                      {selectedAthlete.profile ? `${selectedAthlete.profile.first_name} ${selectedAthlete.profile.last_name}` : "Athlete"}
                    </DialogTitle>
                    <DialogDescription>
                      {selectedAthlete.position || athleteSportConfig?.name || ""}
                      {athleteSportConfig?.session_config.hasHandTracking && selectedAthlete.throw_hand && ` · Throws: ${selectedAthlete.throw_hand}`}
                      {athleteSportConfig?.session_config.hasHandTracking && selectedAthlete.bat_hand && ` · Bats: ${selectedAthlete.bat_hand}`}
                    </DialogDescription>
                    {(selectedAthlete.height || selectedAthlete.weight_lbs || selectedAthlete.school || selectedAthlete.grad_year || selectedAthlete.hometown) && (
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        {selectedAthlete.height && <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">HT {selectedAthlete.height}</span>}
                        {selectedAthlete.weight_lbs && <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">WT {selectedAthlete.weight_lbs} lbs</span>}
                        {selectedAthlete.grad_year && <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">'{String(selectedAthlete.grad_year).slice(2)}</span>}
                        {selectedAthlete.school && <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{selectedAthlete.school}</span>}
                        {selectedAthlete.hometown && <span className="text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">{selectedAthlete.hometown}</span>}
                      </div>
                    )}
                  </div>
                </div>
              </DialogHeader>

              <Tabs value={athleteDetailTab} onValueChange={(v) => {
                setAthleteDetailTab(v);
                if (v === "notes" && selectedAthleteId) markAthleteQuestionsRead(selectedAthleteId);
              }} className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1 gap-1.5">
                    <Target className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Overview</span>
                  </TabsTrigger>
                  <TabsTrigger value="workouts" className="flex-1 gap-1.5">
                    <Dumbbell className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Workouts</span>
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1 gap-1.5 relative">
                    <StickyNote className="h-3.5 w-3.5 shrink-0" />
                    <span className="hidden sm:inline">Notes</span>
                    {selectedAthleteId && unreadAthletes.has(selectedAthleteId) && (
                      <span className="absolute top-0.5 right-0.5 h-2 w-2 rounded-full bg-red-500" />
                    )}
                  </TabsTrigger>
                  <TabsTrigger value="metrics" className="flex-1 gap-1.5">
                    <Activity className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Metrics</span>
                  </TabsTrigger>
                  <TabsTrigger value="videos" className="flex-1 gap-1.5">
                    <Film className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Videos</span>
                  </TabsTrigger>
                  <TabsTrigger value="reflections" className="flex-1 gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">Reflect</span>
                  </TabsTrigger>
                  <TabsTrigger value="ai" className="flex-1 gap-1.5">
                    <Sparkles className="h-3.5 w-3.5 shrink-0" /> <span className="hidden sm:inline">AI</span>
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab: Position, Hand Dominance, Suggestions and Goals */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Athlete Profile */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Athlete Profile</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4 space-y-3">
                      {/* Sport + Jersey # */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Sport</Label>
                          <Select
                            value={selectedAthlete.sport_id || ""}
                            onValueChange={(v) => updateAthleteLink.mutate({ linkId: selectedAthlete.id, updates: { sport_id: v, position: null } })}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="Set sport..." /></SelectTrigger>
                            <SelectContent>
                              {sportConfigs.map((s) => <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Jersey #</Label>
                          <Input
                            className="h-8"
                            placeholder="—"
                            value={profileEdits.jersey_number}
                            onChange={(e) => setProfileEdits((p) => ({ ...p, jersey_number: e.target.value }))}
                            onBlur={(e) => saveProfileEdit("jersey_number", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Position */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Position</Label>
                        <Select
                          value={selectedAthlete.position || ""}
                          onValueChange={(v) => updateAthleteLink.mutate({ linkId: selectedAthlete.id, updates: { position: v } })}
                          disabled={!athleteSportConfig}
                        >
                          <SelectTrigger className="h-8">
                            <SelectValue placeholder={athleteSportConfig ? "Set position..." : "Set a sport first"} />
                          </SelectTrigger>
                          <SelectContent>
                            {(athleteSportConfig?.positions ?? []).map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Height + Weight */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Height</Label>
                          <Input
                            className="h-8"
                            placeholder='e.g. 6&apos;2"'
                            value={profileEdits.height}
                            onChange={(e) => setProfileEdits((p) => ({ ...p, height: e.target.value }))}
                            onBlur={(e) => saveProfileEdit("height", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Weight (lbs)</Label>
                          <Input
                            className="h-8"
                            type="number"
                            placeholder="185"
                            value={profileEdits.weight_lbs}
                            onChange={(e) => setProfileEdits((p) => ({ ...p, weight_lbs: e.target.value }))}
                            onBlur={(e) => saveProfileEdit("weight_lbs", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* School + Grad Year */}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">School</Label>
                          <Input
                            className="h-8"
                            placeholder="School name"
                            value={profileEdits.school}
                            onChange={(e) => setProfileEdits((p) => ({ ...p, school: e.target.value }))}
                            onBlur={(e) => saveProfileEdit("school", e.target.value)}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs text-muted-foreground uppercase tracking-wide">Grad Year</Label>
                          <Input
                            className="h-8"
                            type="number"
                            placeholder="2026"
                            value={profileEdits.grad_year}
                            onChange={(e) => setProfileEdits((p) => ({ ...p, grad_year: e.target.value }))}
                            onBlur={(e) => saveProfileEdit("grad_year", e.target.value)}
                          />
                        </div>
                      </div>

                      {/* Hometown */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Hometown</Label>
                        <Input
                          className="h-8"
                          placeholder="City, State"
                          value={profileEdits.hometown}
                          onChange={(e) => setProfileEdits((p) => ({ ...p, hometown: e.target.value }))}
                          onBlur={(e) => saveProfileEdit("hometown", e.target.value)}
                        />
                      </div>

                      {/* Throws + Bats — only for sports with hand tracking (e.g. baseball, softball) */}
                      {athleteSportConfig?.session_config.hasHandTracking && (
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Throws</Label>
                            <Select
                              value={selectedAthlete.throw_hand || ""}
                              onValueChange={(v) => updateAthleteLink.mutate({ linkId: selectedAthlete.id, updates: { throw_hand: v } })}
                            >
                              <SelectTrigger className="h-8"><SelectValue placeholder="Set..." /></SelectTrigger>
                              <SelectContent>
                                {HANDS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bats</Label>
                            <Select
                              value={selectedAthlete.bat_hand || ""}
                              onValueChange={(v) => updateAthleteLink.mutate({ linkId: selectedAthlete.id, updates: { bat_hand: v } })}
                            >
                              <SelectTrigger className="h-8"><SelectValue placeholder="Set..." /></SelectTrigger>
                              <SelectContent>
                                {HANDS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                        </div>
                      )}

                      <div className="h-px bg-border" />

                      {/* Bio */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Bio</Label>
                        <Textarea
                          className="min-h-[72px] text-sm resize-none"
                          placeholder="Background, strengths, recruitment notes..."
                          value={profileEdits.bio}
                          onChange={(e) => setProfileEdits((p) => ({ ...p, bio: e.target.value }))}
                          onBlur={(e) => saveProfileEdit("bio", e.target.value)}
                        />
                      </div>

                      {/* Fun Facts */}
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground uppercase tracking-wide">Fun Facts</Label>
                        <Textarea
                          className="min-h-[60px] text-sm resize-none"
                          placeholder="GPA, hobbies, awards, interests..."
                          value={profileEdits.fun_facts}
                          onChange={(e) => setProfileEdits((p) => ({ ...p, fun_facts: e.target.value }))}
                          onBlur={(e) => saveProfileEdit("fun_facts", e.target.value)}
                        />
                      </div>
                    </CardContent>
                  </Card>

                  {/* Parents */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-sm">Parents</CardTitle>
                        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setShowParentInviteDialog(true)}>
                          <UserPlus className="h-3.5 w-3.5" /> Invite Parent
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      {linkedParents.length === 0 && pendingParentInvites.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">No parents linked. Click "Invite Parent" to send an invite.</p>
                      ) : (
                        <div className="space-y-2">
                          {linkedParents.map((lp: any) => (
                            <div key={lp.id} className="flex items-center gap-2 text-sm">
                              <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center">
                                <Users className="h-3 w-3 text-primary" />
                              </div>
                              <span>{lp.profile?.first_name} {lp.profile?.last_name}</span>
                              <Badge variant="secondary" className="text-[10px]">Linked</Badge>
                            </div>
                          ))}
                          {pendingParentInvites.map((inv: any) => (
                            <div key={inv.id} className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-sm min-w-0">
                                <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                                  <Mail className="h-3 w-3 text-muted-foreground" />
                                </div>
                                <div className="min-w-0">
                                  <p className="text-xs truncate">{inv.parent_name}</p>
                                  <p className="text-[10px] text-muted-foreground truncate">{inv.parent_email}</p>
                                </div>
                                <Badge variant="outline" className="text-[10px] shrink-0">Pending</Badge>
                              </div>
                              <Button
                                variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-destructive shrink-0"
                                onClick={() => cancelParentInviteMutation.mutate(inv.id)}
                                disabled={cancelParentInviteMutation.isPending}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Goals */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Goals</h3>
                    {!showGoalForm && (
                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-xs gap-1 text-violet-400 hover:text-violet-300"
                          disabled={loadingGoalSuggestions}
                          onClick={async () => {
                            if (!aiEnabled) { setShowAIModal(true); return; }
                            setLoadingGoalSuggestions(true);
                            try {
                              const suggestions = await suggestGoals({
                                position: selectedAthlete?.position ?? null,
                                existingGoalTitles: selectedAthlete?.goals.map((g) => g.title) ?? [],
                                sportConfig: athleteSportConfig,
                              });
                              setAiGoalSuggestions(suggestions);
                            } finally {
                              setLoadingGoalSuggestions(false);
                            }
                          }}
                        >
                          {loadingGoalSuggestions
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Sparkles className="h-3 w-3" />}
                          Suggest with AI
                        </Button>
                        <Button onClick={() => setShowGoalForm(true)} size="sm" variant="outline">
                          <Plus className="h-3.5 w-3.5 mr-1" /> Set Goal
                        </Button>
                      </div>
                    )}
                  </div>
                  {/* AI Goal Suggestions */}
                  {aiGoalSuggestions && !showGoalForm && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground font-medium flex items-center gap-1">
                          <Sparkles className="h-3 w-3 text-violet-400" /> AI Suggestions — click to use
                        </p>
                        <button
                          className="text-xs text-muted-foreground hover:text-foreground"
                          onClick={() => setAiGoalSuggestions(null)}
                        >Dismiss</button>
                      </div>
                      {aiGoalSuggestions.map((s) => (
                        <div
                          key={s.title}
                          className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 cursor-pointer hover:bg-violet-500/10 transition-colors"
                          onClick={() => {
                            setGoalTitle(s.title);
                            setGoalTarget(s.target);
                            setGoalIsMeasurable(s.category !== "mindset");
                            setGoalCategory(s.category);
                            setAiGoalSuggestions(null);
                            setShowGoalForm(true);
                          }}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <p className="text-sm font-medium">{s.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">{s.rationale}</p>
                            </div>
                            <Badge variant="outline" className="text-[10px] capitalize shrink-0">{s.category}</Badge>
                          </div>
                          <p className="text-xs text-primary mt-1.5">Target: {s.target}</p>
                        </div>
                      ))}
                      <p className="text-[10px] text-muted-foreground italic">AI-generated suggestions. Coach review required.</p>
                    </div>
                  )}
                  {showGoalForm && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        {/* Library header */}
                        <div className="flex items-center justify-between">
                          <p className="text-sm font-medium">New Goal</p>
                          <Button
                            type="button" size="sm" variant="ghost" className="h-7 text-xs gap-1"
                            onClick={() => setShowLibrary((v) => !v)}
                          >
                            <BookMarked className="h-3.5 w-3.5" />
                            Library{goalTemplates.length > 0 && ` (${goalTemplates.length})`}
                          </Button>
                        </div>
                        {/* Library panel */}
                        {showLibrary && (
                          <div className="rounded-lg border bg-muted/30 p-2 space-y-1 max-h-40 overflow-y-auto">
                            {goalTemplates.length === 0 ? (
                              <p className="text-xs text-muted-foreground text-center py-2">No saved templates yet. Fill in a goal and click "Save to Library".</p>
                            ) : goalTemplates.map((t) => (
                              <div
                                key={t.id}
                                className="flex items-center gap-2 rounded-md px-2 py-1.5 hover:bg-muted cursor-pointer group"
                                onClick={() => applyTemplate(t)}
                              >
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-medium truncate">{t.title}</p>
                                  <p className="text-[10px] text-muted-foreground capitalize">
                                    {t.category.replace("_", " ")} · {t.is_measurable ? t.target || "Measurable" : "Non-measurable"}
                                  </p>
                                </div>
                                <button
                                  type="button"
                                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                                  onClick={(e) => { e.stopPropagation(); deleteTemplateMutation.mutate(t.id); }}
                                >
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        {/* Goal type toggle */}
                        <div className="flex items-center gap-2">
                          <Label className="text-xs shrink-0">Type</Label>
                          <div className="flex rounded-md border overflow-hidden text-xs">
                            <button
                              type="button"
                              className={`px-3 py-1 ${goalIsMeasurable ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                              onClick={() => setGoalIsMeasurable(true)}
                            >Measurable</button>
                            <button
                              type="button"
                              className={`px-3 py-1 ${!goalIsMeasurable ? "bg-primary text-primary-foreground" : "bg-transparent text-muted-foreground hover:bg-muted"}`}
                              onClick={() => setGoalIsMeasurable(false)}
                            >Non-Measurable</button>
                          </div>
                        </div>
                        {/* Category */}
                        <div className="space-y-1">
                          <Label className="text-xs">Category</Label>
                          <Select value={goalCategory} onValueChange={(v) => setGoalCategory(v as typeof goalCategory)}>
                            <SelectTrigger className="h-8 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="coach_assigned">Coach Assigned</SelectItem>
                              <SelectItem value="skill">Skill</SelectItem>
                              <SelectItem value="conditioning">Conditioning</SelectItem>
                              <SelectItem value="mindset">Mindset</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className={`grid gap-3 ${goalIsMeasurable ? "grid-cols-2" : "grid-cols-1"}`}>
                          <div className="space-y-1">
                            <Label className="text-xs">Goal Title</Label>
                            <Input
                              placeholder={goalIsMeasurable ? "e.g. Increase exit velocity" : "e.g. Improve hand-eye coordination"}
                              value={goalTitle}
                              onChange={(e) => setGoalTitle(e.target.value)}
                            />
                          </div>
                          {goalIsMeasurable && (
                            <div className="space-y-1">
                              <Label className="text-xs">Target</Label>
                              <Input placeholder="e.g. 90 mph" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                            </div>
                          )}
                        </div>
                        {goalIsMeasurable && goalTitle.trim() && !goalTarget.trim() && (
                          <p className="text-xs text-amber-400">Enter a target value to save this goal.</p>
                        )}
                        <div className="flex gap-2 flex-wrap">
                          <Button
                            onClick={() => addGoalMutation.mutate({
                              athleteId: selectedAthlete.athlete_user_id,
                              title: goalTitle,
                              target: goalTarget,
                              is_measurable: goalIsMeasurable,
                              category: goalCategory,
                            })}
                            size="sm"
                            disabled={!goalTitle.trim() || (goalIsMeasurable && !goalTarget.trim()) || addGoalMutation.isPending}
                          >
                            {addGoalMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                            Save Goal
                          </Button>
                          <Button
                            type="button" size="sm" variant="outline" className="gap-1"
                            disabled={!goalTitle.trim() || saveTemplateMutation.isPending}
                            onClick={() => saveTemplateMutation.mutate()}
                          >
                            <BookMarked className="h-3.5 w-3.5" />
                            Save to Library
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
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {goal.category && (
                                  <Badge variant="outline" className="text-[10px] capitalize px-1.5 py-0">{goal.category.replace("_", " ")}</Badge>
                                )}
                                {goal.is_measurable && goal.target && (
                                  <p className="text-xs text-muted-foreground">Target: {goal.target}</p>
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
                            <>
                              <Progress value={goal.progress} className="h-2" />
                              <div className="flex items-center gap-2">
                                <Input
                                  type="number" min={0} max={100} value={goal.progress}
                                  onChange={(e) => updateProgressMutation.mutate({ goalId: goal.id, progress: parseInt(e.target.value) || 0, isMeasurable: true })}
                                  className="w-20 h-8 text-xs"
                                />
                                <span className="text-xs text-muted-foreground">% complete</span>
                              </div>
                            </>
                          ) : (
                            <div className="space-y-1.5">
                              <div className="flex items-center gap-1 flex-wrap">
                                {[1,2,3,4,5,6,7,8,9,10].map((rating) => {
                                  const isSelected = goal.progress > 0 && Math.round(goal.progress / 10) === rating;
                                  return (
                                    <button
                                      key={rating}
                                      type="button"
                                      onClick={() => updateProgressMutation.mutate({ goalId: goal.id, progress: rating * 10 })}
                                      className={`h-7 w-7 rounded-full text-xs font-semibold transition-colors ${
                                        isSelected
                                          ? "bg-primary text-primary-foreground"
                                          : "bg-muted hover:bg-primary/20 text-muted-foreground"
                                      }`}
                                    >
                                      {rating}
                                    </button>
                                  );
                                })}
                              </div>
                              <p className="text-[10px] text-muted-foreground">
                                Coach skill rating 1–10 · each tap is logged
                              </p>
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* At-Home Workouts Tab */}
                <TabsContent value="workouts" className="space-y-4 mt-4">
                  {!isPaid ? (
                    /* Preview: demo only */
                    <div className="space-y-3">
                      <div className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/10 p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Lock className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm font-medium">At-Home Workouts require Basic plan</p>
                        </div>
                        <p className="text-xs text-muted-foreground">Upgrade to assign custom programs as take-home workouts for your athletes. Here's a preview:</p>
                        {/* Demo card */}
                        <div className="rounded-md border p-3 opacity-50 pointer-events-none select-none space-y-2">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">Sample: Arm Strength Circuit</p>
                              <p className="text-xs text-muted-foreground mt-0.5">5-drill · 30 min</p>
                            </div>
                            <Badge variant="outline" className="text-[10px]">active</Badge>
                          </div>
                          <div className="space-y-1">
                            {["Band Pull-Aparts 3×15", "External Rotation 3×12", "Wrist Curls 3×20", "Towel Drill 3×10", "Med Ball Throws 3×10"].map((d) => (
                              <div key={d} className="flex items-center gap-1.5 text-xs text-muted-foreground">
                                <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" />{d}
                              </div>
                            ))}
                          </div>
                        </div>
                        <Button size="sm" className="w-full" onClick={() => navigate("/coach/billing")}>
                          Upgrade to Basic
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Basic / Max: full assign + Max AI generate */
                    <div className="space-y-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-sm font-semibold">Assigned Workouts</h3>
                        <div className="flex gap-2">
                          {aiEnabled && (
                            <Button size="sm" variant="outline" onClick={() => setShowAiGenDialog(true)}>
                              <Sparkles className="h-3.5 w-3.5 mr-1" /> AI Generate
                            </Button>
                          )}
                          <Button size="sm" variant="outline" onClick={() => setShowAssignProgram(true)}>
                            <Plus className="h-3.5 w-3.5 mr-1" /> Assign
                          </Button>
                        </div>
                      </div>

                      {showAssignProgram && (
                        <Card>
                          <CardContent className="p-4 space-y-3">
                            <Label className="text-xs">Select a published program</Label>
                            <Select value={selectedProgramId} onValueChange={setSelectedProgramId}>
                              <SelectTrigger><SelectValue placeholder="Choose program..." /></SelectTrigger>
                              <SelectContent>
                                {coachPrograms.map((p) => (
                                  <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                onClick={() => assignProgramMutation.mutate({ athleteId: selectedAthlete.athlete_user_id, programId: selectedProgramId })}
                                disabled={!selectedProgramId || assignProgramMutation.isPending}
                              >
                                Assign
                              </Button>
                              <Button size="sm" variant="ghost" onClick={() => setShowAssignProgram(false)}>Cancel</Button>
                            </div>
                          </CardContent>
                        </Card>
                      )}

                      {selectedAthlete.assignedPrograms.length === 0 ? (
                        <p className="text-sm text-muted-foreground text-center py-6">No at-home workouts assigned yet.</p>
                      ) : (
                        <div className="space-y-3">
                          {selectedAthlete.assignedPrograms.map((ap) => (
                            <div key={ap.id} className="rounded-lg border p-4 flex items-start justify-between">
                              <div>
                                <p className="font-medium text-sm">{ap.program?.name || "Program"}</p>
                                {ap.program?.description && (
                                  <p className="text-xs text-muted-foreground mt-1">{ap.program.description}</p>
                                )}
                                <Badge variant="outline" className="mt-2 text-[10px] capitalize">{ap.status}</Badge>
                              </div>
                              <Button
                                variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                onClick={() => unassignProgramMutation.mutate(ap.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Add Note</Label>
                    <Textarea placeholder="Performance notes, areas to improve..." value={noteText} onChange={(e) => setNoteText(e.target.value)} className="min-h-[80px]" />
                    <div className="flex items-center gap-4">
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={!noteIsPrivate}
                          onChange={(e) => setNoteIsPrivate(!e.target.checked)}
                          className="h-3.5 w-3.5 rounded"
                        />
                        Share with Athlete
                      </label>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={noteVisibleToParent}
                          onChange={(e) => setNoteVisibleToParent(e.target.checked)}
                          className="h-3.5 w-3.5 rounded"
                        />
                        Share with Parent
                      </label>
                    </div>
                    <Button onClick={() => addNoteMutation.mutate({ athleteId: selectedAthlete.athlete_user_id, note: noteText, is_private: noteIsPrivate, visible_to_parent: noteVisibleToParent })} disabled={!noteText.trim() || addNoteMutation.isPending} size="sm">
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
                          <div className="flex items-center justify-between mt-2">
                            <p className="text-xs text-muted-foreground">{new Date(note.created_at).toLocaleDateString()}</p>
                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => updateNoteMutation.mutate({ id: note.id, updates: { is_private: !note.is_private } })}
                                className={`flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                                  !note.is_private ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" : "border-border text-muted-foreground"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${!note.is_private ? "bg-emerald-400" : "bg-muted-foreground/50"}`} />
                                Athlete
                              </button>
                              <button
                                type="button"
                                onClick={() => updateNoteMutation.mutate({ id: note.id, updates: { visible_to_parent: !note.visible_to_parent } })}
                                className={`flex items-center gap-1 text-[10px] rounded-full px-2 py-0.5 border transition-colors ${
                                  note.visible_to_parent ? "border-blue-500/40 bg-blue-500/10 text-blue-400" : "border-border text-muted-foreground"
                                }`}
                              >
                                <span className={`h-1.5 w-1.5 rounded-full ${note.visible_to_parent ? "bg-blue-400" : "bg-muted-foreground/50"}`} />
                                Parent
                              </button>
                            </div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Parent Questions */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3">Parent Questions</h3>
                    {parentQuestions.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-4">No parent questions yet.</p>
                    ) : (
                      <div className="space-y-3">
                        {parentQuestions.map((q: any) => (
                          <Card key={q.id}>
                            <CardContent className="p-4 space-y-2">
                              <div>
                                <p className="text-xs text-muted-foreground">
                                  {q.profile ? `${q.profile.first_name} ${q.profile.last_name}` : "Parent"} · Week of {new Date(q.week_start + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                                </p>
                                <p className="text-sm mt-1">{q.question}</p>
                              </div>
                              {q.coach_reply ? (
                                <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                                  <p className="text-[11px] text-primary uppercase tracking-wide font-medium mb-0.5">Your reply</p>
                                  <p className="text-sm">{q.coach_reply}</p>
                                  <button
                                    className="text-xs text-muted-foreground hover:text-foreground mt-1 underline"
                                    onClick={() => { setReplyingQuestionId(q.id); setQuestionReplyText(q.coach_reply); }}
                                  >Edit</button>
                                </div>
                              ) : replyingQuestionId === q.id ? null : (
                                <Button
                                  size="sm" variant="outline" className="w-full"
                                  onClick={() => { setReplyingQuestionId(q.id); setQuestionReplyText(""); }}
                                >
                                  <MessageSquare className="h-3.5 w-3.5 mr-1" /> Reply
                                </Button>
                              )}
                              {replyingQuestionId === q.id && (
                                <div className="space-y-2">
                                  <Textarea
                                    rows={2}
                                    placeholder="Write your reply..."
                                    value={questionReplyText}
                                    onChange={(e) => setQuestionReplyText(e.target.value)}
                                  />
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      onClick={() => replyToParentQuestionMutation.mutate({ questionId: q.id, reply: questionReplyText })}
                                      disabled={!questionReplyText.trim() || replyToParentQuestionMutation.isPending}
                                    >
                                      {replyToParentQuestionMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                                      Save
                                    </Button>
                                    <Button size="sm" variant="ghost" onClick={() => { setReplyingQuestionId(null); setQuestionReplyText(""); }}>Cancel</Button>
                                  </div>
                                </div>
                              )}
                            </CardContent>
                          </Card>
                        ))}
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Metrics Tab */}
                <TabsContent value="metrics" className="space-y-4 mt-4">
                  {positionMetrics.length > 0 ? (
                    <>
                      <Card>
                        <CardHeader className="py-3 px-4">
                          <CardTitle className="text-sm font-['Space_Grotesk']">
                            Record {selectedAthlete.position} Metrics
                          </CardTitle>
                          <CardDescription className="text-xs">
                            Track position-specific performance data
                          </CardDescription>
                        </CardHeader>
                        <CardContent className="px-4 pb-4 space-y-3">
                          <div className="grid grid-cols-2 gap-3">
                            {positionMetrics.map((metric) => (
                              <div key={metric.type} className="space-y-1">
                                <Label className="text-xs text-muted-foreground">
                                  {metric.label} {metric.unit && <span className="text-[10px]">({metric.unit})</span>}
                                </Label>
                                <Input
                                  type="number"
                                  step="any"
                                  placeholder="0"
                                  value={metricValues[metric.type] || ""}
                                  onChange={(e) => setMetricValues((prev) => ({ ...prev, [metric.type]: e.target.value }))}
                                  className="h-8 text-sm"
                                />
                              </div>
                            ))}
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs text-muted-foreground">Notes (optional)</Label>
                            <Input
                              placeholder="e.g. After warmup, using Rapsodo"
                              value={metricNotes}
                              onChange={(e) => setMetricNotes(e.target.value)}
                              className="h-8 text-sm"
                            />
                          </div>
                          <Button
                            size="sm"
                            disabled={!Object.values(metricValues).some((v) => v && parseFloat(v) > 0) || recordMetricsMutation.isPending}
                            onClick={() => {
                              const metrics = positionMetrics
                                .filter((m) => metricValues[m.type] && parseFloat(metricValues[m.type]) > 0)
                                .map((m) => ({ type: m.type, value: parseFloat(metricValues[m.type]), unit: m.unit, category: m.category }));
                              recordMetricsMutation.mutate({
                                athleteId: selectedAthlete.athlete_user_id,
                                sportId: selectedAthlete.sport_id,
                                metrics,
                              });
                            }}
                          >
                            {recordMetricsMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                            Record Metrics
                          </Button>
                        </CardContent>
                      </Card>

                      {/* Progress from baseline */}
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h3 className="text-sm font-semibold">Progress Tracking</h3>
                          <span className="text-[10px] text-muted-foreground">First entry = starting baseline</span>
                        </div>
                        {athleteMetrics.length === 0 ? (
                          <p className="text-sm text-muted-foreground text-center py-6">No metrics recorded yet. First entry will become the baseline.</p>
                        ) : (
                          <div className="space-y-2">
                            {positionMetrics.map((metricDef) => {
                              const entries = athleteMetrics.filter((m) => m.metric_type === metricDef.type);
                              if (entries.length === 0) return null;
                              const current = entries[0]; // newest (desc order)
                              const baseline = entries[entries.length - 1]; // oldest = starting base
                              const change = entries.length > 1 ? current.value - baseline.value : null;
                              return (
                                <div key={metricDef.type} className="rounded-lg border p-3 space-y-2">
                                  <div className="flex items-center justify-between">
                                    <div>
                                      <p className="text-sm font-medium">{metricDef.label}</p>
                                      <p className="text-xs text-muted-foreground">{entries.length} reading{entries.length !== 1 ? "s" : ""}</p>
                                    </div>
                                    <div className="text-right">
                                      <p className="text-lg font-bold font-['Space_Grotesk']">
                                        {current.value}{metricDef.unit && <span className="text-xs text-muted-foreground ml-1">{metricDef.unit}</span>}
                                      </p>
                                      {change !== null && (
                                        <p className={`text-xs font-medium ${change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                                          {change > 0 ? "↑" : change < 0 ? "↓" : "→"} {Math.abs(change).toFixed(1)} from baseline
                                        </p>
                                      )}
                                    </div>
                                  </div>
                                  {entries.length > 1 && (
                                    <div className="flex items-center justify-between text-[10px] text-muted-foreground border-t pt-2">
                                      <span>Baseline: <span className="font-medium text-foreground">{baseline.value}{metricDef.unit}</span> · {new Date(baseline.recorded_at).toLocaleDateString()}</span>
                                      <span>Latest: {new Date(current.recorded_at).toLocaleDateString()}</span>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      Set a position on the Overview tab to see position-specific metrics.
                    </p>
                  )}
                </TabsContent>

                {/* Videos Tab */}
                <TabsContent value="videos" className="space-y-4 mt-4">
                  <AthleteVideoSubmissions
                    athleteId={selectedAthlete.athlete_user_id}
                    coachId={user?.id}
                  />
                  <ImprovementVideos
                    athleteId={selectedAthlete.athlete_user_id}
                    coachId={user?.id}
                  />
                </TabsContent>

                {/* AI Summary Tab */}
                <TabsContent value="ai" className="space-y-4 mt-4">
                  <Card className="border-violet-500/20">
                    <CardHeader className="pb-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-sm font-['Space_Grotesk']">Monthly Athlete Summary</CardTitle>
                          <CardDescription className="text-xs mt-0.5">AI overview for coach review — not for direct sharing</CardDescription>
                        </div>
                        {!aiEnabled && (
                          <Badge variant="outline" className="text-[10px] text-violet-400 border-violet-500/30 gap-1">
                            <Lock className="h-2.5 w-2.5" /> AI Premium
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {athleteSummary ? (
                        <>
                          <div className="rounded-lg bg-violet-500/5 border border-violet-500/20 p-3 space-y-1">
                            <p className="text-[10px] text-violet-400 uppercase tracking-wide font-medium flex items-center gap-1">
                              <Sparkles className="h-3 w-3" /> Overview
                            </p>
                            <p className="text-sm leading-relaxed">{athleteSummary.summary}</p>
                          </div>
                          {athleteSummary.highlights.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                <TrendingUp className="h-3 w-3 text-emerald-400" /> Highlights
                              </p>
                              <ul className="space-y-1">
                                {athleteSummary.highlights.map((h, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />{h}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {athleteSummary.concerns.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1.5 flex items-center gap-1">
                                <ShieldAlert className="h-3 w-3 text-amber-400" /> Focus Areas
                              </p>
                              <ul className="space-y-1">
                                {athleteSummary.concerns.map((c, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <AlertTriangle className="h-3.5 w-3.5 text-amber-400 shrink-0 mt-0.5" />{c}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {athleteSummary.recommendations.length > 0 && (
                            <div>
                              <p className="text-xs font-medium mb-1.5">Recommendations</p>
                              <ul className="space-y-1">
                                {athleteSummary.recommendations.map((r, i) => (
                                  <li key={i} className="text-sm flex items-start gap-2">
                                    <span className="text-primary font-bold shrink-0">→</span>{r}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          <div className="border-t pt-3 flex items-center justify-between gap-2">
                            <p className="text-[10px] text-muted-foreground italic leading-tight">
                              AI-generated draft. Review before sharing.
                            </p>
                            <Button
                              size="sm"
                              variant="outline"
                              className="gap-1.5 text-xs shrink-0"
                              onClick={() => {
                                const name = selectedAthlete?.profile
                                  ? `${selectedAthlete.profile.first_name} ${selectedAthlete.profile.last_name}`
                                  : "Athlete";
                                const text = formatReportForCopy(name, athleteSummary);
                                navigator.clipboard.writeText(text);
                                toast({ title: "Copied to clipboard", description: "Review before sharing with parents." });
                              }}
                            >
                              <Copy className="h-3 w-3" /> Copy Report
                            </Button>
                          </div>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="w-full text-xs gap-1.5 text-muted-foreground"
                            onClick={() => setAthleteSummary(null)}
                          >
                            <RefreshCw className="h-3 w-3" /> Regenerate
                          </Button>
                        </>
                      ) : (
                        <Button
                          className="w-full gap-2 bg-violet-600 hover:bg-violet-700 text-white"
                          disabled={generatingAthleteSummary}
                          onClick={async () => {
                            if (!aiEnabled) { setShowAIModal(true); return; }
                            setGeneratingAthleteSummary(true);
                            try {
                              const avgRating = athleteReflections.length > 0
                                ? (athleteReflections as any[]).reduce((sum, r) => sum + (r.self_rating ?? 5), 0) / athleteReflections.length
                                : null;
                              const summary = await generateAthleteSummary({
                                name: selectedAthlete?.profile
                                  ? `${selectedAthlete.profile.first_name} ${selectedAthlete.profile.last_name}`
                                  : "Athlete",
                                position: selectedAthlete?.position ?? null,
                                activeGoals: selectedAthlete?.goals.filter((g) => !g.completed_at).length ?? 0,
                                totalSessions: 0,
                                latestNote: selectedAthlete?.notes[0]?.note ?? null,
                                reflectionCount: athleteReflections.length,
                                avgSelfRating: avgRating,
                              });
                              setAthleteSummary(summary);
                            } finally {
                              setGeneratingAthleteSummary(false);
                            }
                          }}
                        >
                          {generatingAthleteSummary
                            ? <Loader2 className="h-4 w-4 animate-spin" />
                            : <Sparkles className="h-4 w-4" />}
                          {generatingAthleteSummary ? "Generating..." : "Generate Monthly Summary"}
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                  <p className="text-[10px] text-center text-muted-foreground">
                    AI never replaces your coaching judgment. All summaries require review.
                  </p>
                </TabsContent>

                {/* Reflections Tab */}
                <TabsContent value="reflections" className="space-y-3 mt-4">
                  {athleteReflections.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">No reflections submitted yet.</p>
                  ) : (
                    athleteReflections.map((r: any) => (
                      <Card key={r.id}>
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="text-sm font-medium">
                              Week of {new Date(r.week_start + "T12:00:00").toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                            </p>
                            {r.self_rating != null && (
                              <Badge variant="secondary" className="text-xs">{r.self_rating}/10</Badge>
                            )}
                          </div>
                          {r.what_went_well && (
                            <div>
                              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">What went well</p>
                              <p className="text-sm">{r.what_went_well}</p>
                            </div>
                          )}
                          {r.needs_improvement && (
                            <div>
                              <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium mb-0.5">Needs improvement</p>
                              <p className="text-sm">{r.needs_improvement}</p>
                            </div>
                          )}
                          {r.coach_comment ? (
                            <div className="rounded-md bg-primary/5 border border-primary/20 px-3 py-2">
                              <p className="text-[11px] text-primary uppercase tracking-wide font-medium mb-0.5">Your comment</p>
                              <p className="text-sm">{r.coach_comment}</p>
                              <button
                                className="text-xs text-muted-foreground hover:text-foreground mt-1 underline"
                                onClick={() => { setCommentingReflectionId(r.id); setCoachCommentText(r.coach_comment); }}
                              >Edit</button>
                            </div>
                          ) : commentingReflectionId === r.id ? null : (
                            <Button
                              size="sm"
                              variant="outline"
                              className="w-full"
                              onClick={() => { setCommentingReflectionId(r.id); setCoachCommentText(""); }}
                            >
                              Add Comment
                            </Button>
                          )}
                          {commentingReflectionId === r.id && (
                            <div className="space-y-2">
                              <Textarea
                                rows={2}
                                placeholder="Write feedback for the athlete..."
                                value={coachCommentText}
                                onChange={(e) => setCoachCommentText(e.target.value)}
                              />
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  onClick={() => addCoachCommentMutation.mutate({ reflectionId: r.id, comment: coachCommentText })}
                                  disabled={!coachCommentText.trim() || addCoachCommentMutation.isPending}
                                >
                                  {addCoachCommentMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                                  Save
                                </Button>
                                <Button size="sm" variant="ghost" onClick={() => { setCommentingReflectionId(null); setCoachCommentText(""); }}>Cancel</Button>
                              </div>
                            </div>
                          )}

                          {/* AI Reflection Summary */}
                          {reflectionSummaries[r.id] ? (
                            <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                              <p className="text-[11px] text-violet-400 uppercase tracking-wide font-medium flex items-center gap-1">
                                <Sparkles className="h-3 w-3" /> AI Summary
                              </p>
                              <p className="text-sm">{reflectionSummaries[r.id].summary}</p>
                              {reflectionSummaries[r.id].highlights.length > 0 && (
                                <ul className="space-y-1">
                                  {reflectionSummaries[r.id].highlights.map((h, i) => (
                                    <li key={i} className="text-xs flex items-start gap-1.5">
                                      <CheckCircle2 className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />{h}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              {reflectionSummaries[r.id].concerns.length > 0 && (
                                <ul className="space-y-1">
                                  {reflectionSummaries[r.id].concerns.map((c, i) => (
                                    <li key={i} className="text-xs flex items-start gap-1.5">
                                      <AlertTriangle className="h-3 w-3 text-amber-400 shrink-0 mt-0.5" />{c}
                                    </li>
                                  ))}
                                </ul>
                              )}
                              <p className="text-[10px] text-muted-foreground italic">AI-generated draft. Coach review required.</p>
                            </div>
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="w-full text-xs gap-1.5 text-violet-400 hover:text-violet-300"
                              disabled={generatingReflectionId === r.id}
                              onClick={async () => {
                                if (!aiEnabled) { setShowAIModal(true); return; }
                                setGeneratingReflectionId(r.id);
                                try {
                                  const summary = await generateReflectionSummary({
                                    whatWentWell: r.what_went_well,
                                    needsImprovement: r.needs_improvement,
                                    selfRating: r.self_rating,
                                  });
                                  setReflectionSummaries((prev) => ({ ...prev, [r.id]: summary }));
                                } finally {
                                  setGeneratingReflectionId(null);
                                }
                              }}
                            >
                              {generatingReflectionId === r.id
                                ? <Loader2 className="h-3 w-3 animate-spin" />
                                : <Sparkles className="h-3 w-3" />}
                              Generate AI Summary
                            </Button>
                          )}
                        </CardContent>
                      </Card>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
      {/* Parent Invite Dialog */}
      <Dialog open={showParentInviteDialog} onOpenChange={(open) => { if (!open) { setShowParentInviteDialog(false); setParentInviteName(""); setParentInviteEmail(""); } }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] flex items-center gap-2">
              <UserPlus className="h-4 w-4" /> Invite Parent
            </DialogTitle>
            <DialogDescription>
              Send a signup link to the parent. They'll be linked to {selectedAthlete?.profile?.first_name}'s account automatically.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-2">
              <Label>Parent's Name</Label>
              <Input placeholder="Jane Doe" value={parentInviteName} onChange={(e) => setParentInviteName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Parent's Email</Label>
              <Input type="email" placeholder="parent@email.com" value={parentInviteEmail} onChange={(e) => setParentInviteEmail(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setShowParentInviteDialog(false); setParentInviteName(""); setParentInviteEmail(""); }}>Cancel</Button>
            <Button
              onClick={() => sendParentInviteMutation.mutate()}
              disabled={!parentInviteName.trim() || !parentInviteEmail.trim() || sendParentInviteMutation.isPending}
            >
              {sendParentInviteMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              <Mail className="h-4 w-4 mr-2" /> Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AIPremiumModal open={showAIModal} onClose={() => setShowAIModal(false)} athleteCount={athletes.length} />
      <UpgradeModal
        open={showUpgradeModal || trialExpired}
        onClose={() => setShowUpgradeModal(false)}
        reason={trialExpired ? "expired" : "athlete-cap"}
      />

      {/* AI Generate Workout Dialog */}
      <Dialog open={showAiGenDialog} onOpenChange={(open) => { if (!open) resetAiGenDialog(); }}>
        <DialogContent className={aiGenStep === "preview" ? "max-w-lg max-h-[85vh] overflow-y-auto" : "max-w-sm"}>
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              {aiGenStep === "config" ? "Generate At-Home Workout" : `${aiGenFocus} — ${aiGenDuration} min`}
            </DialogTitle>
            <DialogDescription>
              {aiGenStep === "config"
                ? "All exercises are bodyweight or resistance-band only — no free weights needed."
                : "Review and edit the exercises below, then assign to the athlete."}
            </DialogDescription>
          </DialogHeader>

          {/* ── Step 1: Config ── */}
          {aiGenStep === "config" && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Focus Area</Label>
                <Select value={aiGenFocus} onValueChange={setAiGenFocus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {AI_FOCUS_AREAS.map((area) => (
                      <SelectItem key={area} value={area}>{area}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Select value={aiGenDuration} onValueChange={setAiGenDuration}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="15">15 min — {DURATION_DRILL_COUNT["15"]} exercises</SelectItem>
                    <SelectItem value="30">30 min — {DURATION_DRILL_COUNT["30"]} exercises</SelectItem>
                    <SelectItem value="45">45 min — {DURATION_DRILL_COUNT["45"]} exercises</SelectItem>
                    <SelectItem value="60">60 min — {DURATION_DRILL_COUNT["60"]} exercises</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {selectedAthlete && (
                <p className="text-xs text-muted-foreground">
                  Will be assigned to{" "}
                  <span className="font-medium">
                    {selectedAthlete.profile?.first_name} {selectedAthlete.profile?.last_name}
                  </span>
                </p>
              )}
            </div>
          )}

          {/* ── Step 2: Preview & Edit ── */}
          {aiGenStep === "preview" && (
            <div className="space-y-3">
              {/* Drill list */}
              {generatedDrills.map((drill) => (
                <div key={drill.key} className="rounded-lg border bg-secondary/20 p-3 space-y-1.5">
                  {editingDrillKey === drill.key ? (
                    /* Inline edit mode */
                    <div className="space-y-2">
                      <Input
                        value={editDrillName}
                        onChange={(e) => setEditDrillName(e.target.value)}
                        className="h-8 text-sm font-medium"
                        placeholder="Exercise name"
                      />
                      <Input
                        value={editDrillReps}
                        onChange={(e) => setEditDrillReps(e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Reps / sets / duration"
                      />
                      <Input
                        value={editDrillInstructions}
                        onChange={(e) => setEditDrillInstructions(e.target.value)}
                        className="h-7 text-xs"
                        placeholder="Instructions (optional)"
                      />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 text-xs px-2" onClick={() => {
                          setGeneratedDrills((prev) => prev.map((d) =>
                            d.key === drill.key
                              ? { ...d, name: editDrillName || d.name, rep_scheme: editDrillReps || d.rep_scheme, instructions: editDrillInstructions }
                              : d
                          ));
                          setEditingDrillKey(null);
                        }}>
                          <Check className="h-3 w-3 mr-1" /> Save
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs px-2" onClick={() => setEditingDrillKey(null)}>
                          Cancel
                        </Button>
                      </div>
                    </div>
                  ) : (
                    /* Display mode */
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium leading-tight">{drill.name}</p>
                        <p className="text-xs text-primary font-medium mt-0.5">{drill.rep_scheme}</p>
                        {drill.instructions && (
                          <p className="text-xs text-muted-foreground mt-1 leading-snug">{drill.instructions}</p>
                        )}
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6"
                          onClick={() => {
                            setEditingDrillKey(drill.key);
                            setEditDrillName(drill.name);
                            setEditDrillReps(drill.rep_scheme);
                            setEditDrillInstructions(drill.instructions);
                          }}
                        >
                          <Pencil className="h-3 w-3" />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-6 w-6 text-destructive hover:text-destructive"
                          onClick={() => setGeneratedDrills((prev) => prev.filter((d) => d.key !== drill.key))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add custom exercise */}
              <div className="rounded-lg border border-dashed p-3 space-y-2">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Add Custom Exercise</p>
                <Input
                  value={customDrillName}
                  onChange={(e) => setCustomDrillName(e.target.value)}
                  placeholder="Exercise name"
                  className="h-8 text-sm"
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    value={customDrillReps}
                    onChange={(e) => setCustomDrillReps(e.target.value)}
                    placeholder="e.g. 3×10"
                    className="h-8 text-sm"
                  />
                  <Input
                    value={customDrillInstructions}
                    onChange={(e) => setCustomDrillInstructions(e.target.value)}
                    placeholder="Instructions (optional)"
                    className="h-8 text-sm"
                  />
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full h-8 text-xs"
                  disabled={!customDrillName.trim()}
                  onClick={() => {
                    setGeneratedDrills((prev) => [...prev, {
                      key: `custom-${Date.now()}`,
                      name: customDrillName.trim(),
                      rep_scheme: customDrillReps.trim() || "As prescribed",
                      instructions: customDrillInstructions.trim(),
                    }]);
                    setCustomDrillName("");
                    setCustomDrillReps("");
                    setCustomDrillInstructions("");
                  }}
                >
                  <Plus className="h-3 w-3 mr-1" /> Add Exercise
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            {aiGenStep === "config" ? (
              <>
                <Button variant="ghost" onClick={resetAiGenDialog}>Cancel</Button>
                <Button onClick={buildWorkoutPreview}>
                  <Sparkles className="h-4 w-4 mr-2" /> Preview Workout
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" onClick={() => { setAiGenStep("config"); setEditingDrillKey(null); }}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>
                <Button
                  disabled={generatedDrills.length === 0 || generateAiWorkout.isPending}
                  onClick={() => {
                    if (!selectedAthlete) return;
                    generateAiWorkout.mutate({
                      athleteId: selectedAthlete.athlete_user_id,
                      athleteName: `${selectedAthlete.profile?.first_name ?? ""} ${selectedAthlete.profile?.last_name ?? ""}`.trim(),
                    });
                  }}
                >
                  {generateAiWorkout.isPending ? (
                    <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Assigning...</>
                  ) : (
                    <>Assign to {selectedAthlete?.profile?.first_name ?? "Athlete"} ({generatedDrills.length} exercises)</>
                  )}
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachAthletes;
