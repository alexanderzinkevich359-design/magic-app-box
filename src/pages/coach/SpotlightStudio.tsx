import { useState, useRef, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Sparkles, Loader2, Image, Link2, AlertCircle, CheckCircle2,
  Instagram, Facebook, X, RefreshCw, Clock, Send, Save, Trash2,
  ChevronRight, ChevronLeft, CalendarDays, Users, Target, Trophy, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAIPremium } from "@/hooks/useAIPremium";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import AIPremiumModal from "@/components/AIPremiumModal";
import UpgradeModal from "@/components/UpgradeModal";
import {
  generateSpotlightCaptions,
  type SpotlightContext,
  type SpotlightPostType,
  type SpotlightTone,
} from "@/lib/ai/spotlightService";

// ─── Types ────────────────────────────────────────────────────────────────────

interface SocialConnection {
  facebook_page_id: string;
  facebook_page_name: string;
  instagram_account_id: string | null;
  instagram_username: string | null;
  connected_at: string;
}

interface SpotlightPost {
  id: string;
  post_type: string;
  status: string;
  platforms: string[];
  instagram_caption: string | null;
  facebook_caption: string | null;
  hashtags: string[] | null;
  media_url: string | null;
  media_type: string | null;
  scheduled_at: string | null;
  published_at: string | null;
  publish_error: string | null;
  created_at: string;
  context_data: Record<string, unknown>;
}

interface AthleteOption {
  id: string;
  first_name: string;
  last_name: string;
  sport_id: string | null;
  sport_name: string | null;
  sport_slug: string | null;
  position: string | null;
  active_goals: string[];
}

// ─── Constants ────────────────────────────────────────────────────────────────

const POST_TYPES: { type: SpotlightPostType; label: string; desc: string; icon: typeof Sparkles }[] = [
  { type: "athlete_spotlight", label: "Athlete Spotlight", desc: "Celebrate an individual athlete's development and effort.", icon: Target },
  { type: "team_development", label: "Team Development", desc: "Share a group development update or team milestone.", icon: Users },
  { type: "tournament_recap", label: "Tournament Recap", desc: "Recap a recent competition with a development lens.", icon: Trophy },
  { type: "weekly_progress", label: "Weekly Progress", desc: "Highlight the team's weekly training focus and momentum.", icon: BarChart3 },
];

const TONES: { value: SpotlightTone; label: string; desc: string }[] = [
  { value: "professional", label: "Professional", desc: "Polished and measured — ideal for club/school accounts." },
  { value: "energetic", label: "Energetic", desc: "High-energy, hype-ready tone for training content." },
  { value: "recruiting", label: "Recruiting", desc: "Development-focused language aimed at prospects and coaches." },
];

const STATUS_COLORS: Record<string, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-blue-500/15 text-blue-400",
  published: "bg-emerald-500/15 text-emerald-400",
  failed: "bg-red-500/15 text-red-400",
};

// ─── Component ────────────────────────────────────────────────────────────────

const SpotlightStudio = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { isEnabled: aiEnabled, isLoading: aiLoading } = useAIPremium();
  const { isPaid } = useTrialStatus();

  const [showAIModal, setShowAIModal] = useState(false);
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);

  // Platform selection for OAuth connection
  const [platformChoice, setPlatformChoice] = useState<string[]>(["facebook", "instagram"]);

  // Tabs
  const [mainTab, setMainTab] = useState<"create" | "history">("create");

  // Step (1-4)
  const [step, setStep] = useState(1);

  // Step 1
  const [postType, setPostType] = useState<SpotlightPostType | null>(null);

  // Step 2
  const [selectedAthleteIds, setSelectedAthleteIds] = useState<string[]>([]);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [coachComment, setCoachComment] = useState("");
  const [postDate, setPostDate] = useState("");

  // Step 3
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [mediaType, setMediaType] = useState<"photo" | "video" | null>(null);
  const [uploadProgress, setUploadProgress] = useState(false);
  const [platforms, setPlatforms] = useState<string[]>([]);
  const [permissionConfirmed, setPermissionConfirmed] = useState(false);

  // Step 4
  const [tone, setTone] = useState<SpotlightTone>("professional");
  const [useEmoji, setUseEmoji] = useState(false);
  const [igCaption, setIgCaption] = useState("");
  const [fbCaption, setFbCaption] = useState("");
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [generating, setGenerating] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduleDateTime, setScheduleDateTime] = useState("");
  const [savingDraft, setSavingDraft] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [scheduling, setScheduling] = useState(false);

  // Show connected toast if redirected from OAuth (same-tab fallback)
  useEffect(() => {
    if (searchParams.get("connected") === "true") {
      toast({ title: "Connected!", description: "Your Facebook & Instagram account is now linked." });
      queryClient.invalidateQueries({ queryKey: ["social-connection"] });
      setSearchParams({}, { replace: true });
    }
  }, [searchParams, setSearchParams, toast, queryClient]);

  // Listen for postMessage from OAuth popup tab
  useEffect(() => {
    const handleMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin) return;
      if (e.data?.type === "spotlight_connected") {
        queryClient.invalidateQueries({ queryKey: ["social-connection"] });
        toast({ title: "Connected!", description: "Your account is now linked." });
      } else if (e.data?.type === "spotlight_error") {
        toast({ title: "Connection failed", description: e.data.message, variant: "destructive" });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [queryClient, toast]);

  // ── Queries ────────────────────────────────────────────────────────────────

  const { data: socialConn, isLoading: connLoading } = useQuery({
    queryKey: ["social-connection", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await (supabase as any)
        .from("social_connections")
        .select("facebook_page_id, facebook_page_name, instagram_account_id, instagram_username, connected_at")
        .eq("coach_id", user.id)
        .maybeSingle();
      return (data as SocialConnection | null) ?? null;
    },
    enabled: !!user,
  });

  const { data: athletes = [] } = useQuery<AthleteOption[]>({
    queryKey: ["spotlight-athletes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Fetch coach-athlete links with profiles + sports + active goals
      const { data: links } = await (supabase as any)
        .from("coach_athlete_links")
        .select("athlete_user_id, position, sport_id")
        .eq("coach_id", user.id);
      if (!links?.length) return [];

      const athleteIds = links.map((l: any) => l.athlete_user_id);

      // Profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", athleteIds);

      // Sports
      const sportIds = [...new Set(links.map((l: any) => l.sport_id).filter(Boolean))];
      const { data: sports } = sportIds.length
        ? await (supabase as any).from("sports").select("id, name, slug").in("id", sportIds)
        : { data: [] };

      // Active goals (one query for all athletes)
      const { data: goals } = await (supabase as any)
        .from("athlete_goals")
        .select("athlete_id, title")
        .in("athlete_id", athleteIds)
        .is("completed_at", null)
        .order("created_at", { ascending: false });

      const sportMap = new Map((sports ?? []).map((s: any) => [s.id, s]));
      const goalsByAthlete: Record<string, string[]> = {};
      for (const g of goals ?? []) {
        if (!goalsByAthlete[g.athlete_id]) goalsByAthlete[g.athlete_id] = [];
        goalsByAthlete[g.athlete_id].push(g.title);
      }

      return links.map((link: any) => {
        const profile = profiles?.find((p: any) => p.user_id === link.athlete_user_id);
        const sport = sportMap.get(link.sport_id);
        return {
          id: link.athlete_user_id,
          first_name: profile?.first_name ?? "",
          last_name: profile?.last_name ?? "",
          sport_id: link.sport_id ?? null,
          sport_name: sport?.name ?? null,
          sport_slug: sport?.slug ?? null,
          position: link.position ?? null,
          active_goals: goalsByAthlete[link.athlete_user_id] ?? [],
        };
      });
    },
    enabled: !!user,
  });

  const { data: posts = [], isLoading: postsLoading } = useQuery<SpotlightPost[]>({
    queryKey: ["spotlight-posts", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("spotlight_posts")
        .select("id, post_type, status, platforms, instagram_caption, facebook_caption, hashtags, media_url, media_type, scheduled_at, published_at, publish_error, created_at, context_data")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });
      return (data as SpotlightPost[]) ?? [];
    },
    enabled: !!user,
  });

  // ── Derived ────────────────────────────────────────────────────────────────

  const selectedAthletes = athletes.filter((a) => selectedAthleteIds.includes(a.id));
  const primarySport = selectedAthletes[0]?.sport_name ?? "your sport";
  const availableGoals = [...new Set(selectedAthletes.flatMap((a) => a.active_goals))];
  const fbAppId = import.meta.env.VITE_FACEBOOK_APP_ID as string | undefined;

  // ── OAuth ──────────────────────────────────────────────────────────────────

  const handleConnectMeta = (choices: string[] = platformChoice) => {
    if (!fbAppId) return;
    const state = crypto.randomUUID();
    // Use localStorage so the new tab can read it (sessionStorage is not shared)
    localStorage.setItem("spotlight_oauth_state", state);
    const redirectUri = encodeURIComponent(`${window.location.origin}/coach/spotlight/callback`);
    const withInstagram = choices.includes("instagram");
    const scope = encodeURIComponent(
      withInstagram
        ? "pages_manage_posts,pages_read_engagement,instagram_basic,instagram_content_publish,business_management"
        : "pages_manage_posts,pages_read_engagement,business_management"
    );
    const url = `https://www.facebook.com/v19.0/dialog/oauth?client_id=${fbAppId}&redirect_uri=${redirectUri}&state=${state}&scope=${scope}&response_type=code`;
    window.open(url, "_blank");
  };

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      await (supabase as any).from("social_connections").delete().eq("coach_id", user.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["social-connection"] });
      toast({ title: "Disconnected", description: "Your social account has been unlinked." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Media upload ───────────────────────────────────────────────────────────

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const isVideo = file.type.startsWith("video/");
    const isPhoto = file.type.startsWith("image/");
    const maxMB = isVideo ? 100 : 10;

    if (!isVideo && !isPhoto) {
      toast({ title: "Invalid file", description: "Please upload a photo (JPG/PNG/WEBP) or video (MP4).", variant: "destructive" });
      return;
    }
    if (file.size > maxMB * 1024 * 1024) {
      toast({ title: "File too large", description: `Max size is ${maxMB}MB.`, variant: "destructive" });
      return;
    }

    const ext = file.name.split(".").pop() ?? (isVideo ? "mp4" : "jpg");
    const path = `${user.id}/${Date.now()}.${ext}`;

    setUploadProgress(true);
    try {
      const { error: uploadErr } = await supabase.storage.from("spotlight-media").upload(path, file);
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage.from("spotlight-media").getPublicUrl(path);
      setMediaUrl(urlData.publicUrl);
      setMediaFile(file);
      setMediaType(isVideo ? "video" : "photo");
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadProgress(false);
    }
  };

  // ── Caption generation ─────────────────────────────────────────────────────

  const handleGenerateCaptions = async () => {
    if (!postType) return;
    setGenerating(true);
    try {
      const ctx: SpotlightContext = {
        postType,
        sport: primarySport,
        athleteNames: selectedAthletes.map((a) => `${a.first_name} ${a.last_name}`),
        goals: selectedGoals.length > 0 ? selectedGoals : availableGoals.slice(0, 2),
        progressStatus: "in_progress",
        tone,
        useEmoji,
        coachComment: coachComment.trim() || undefined,
        date: postDate || undefined,
      };
      const result = await generateSpotlightCaptions(ctx);
      setIgCaption(result.instagram);
      setFbCaption(result.facebook);
      setHashtags(result.hashtags);
    } catch (err: any) {
      toast({ title: "Generation failed", description: err.message, variant: "destructive" });
    } finally {
      setGenerating(false);
    }
  };

  // ── Save draft / schedule / publish ───────────────────────────────────────

  const buildPostPayload = (extra: Record<string, unknown> = {}) => ({
    coach_id: user!.id,
    post_type: postType,
    athlete_ids: selectedAthleteIds,
    context_data: { coachComment, postDate, goals: selectedGoals },
    media_url: mediaUrl,
    media_type: mediaType,
    platforms,
    instagram_caption: igCaption,
    facebook_caption: fbCaption,
    hashtags,
    tone,
    use_emoji: useEmoji,
    media_permission_confirmed: permissionConfirmed,
    ...extra,
  });

  const upsertPost = async (extra: Record<string, unknown> = {}) => {
    const { data, error } = await (supabase as any)
      .from("spotlight_posts")
      .insert(buildPostPayload(extra))
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  const handleSaveDraft = async () => {
    if (!user || !postType) return;
    setSavingDraft(true);
    try {
      await upsertPost({ status: "draft" });
      queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });
      toast({ title: "Draft saved" });
      resetForm();
      setMainTab("history");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSavingDraft(false);
    }
  };

  const handleSchedule = async () => {
    if (!user || !postType || !scheduleDateTime) return;
    setScheduling(true);
    try {
      await upsertPost({ status: "scheduled", scheduled_at: new Date(scheduleDateTime).toISOString() });
      queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });
      toast({ title: "Post scheduled", description: `Scheduled for ${new Date(scheduleDateTime).toLocaleString()}` });
      setScheduleOpen(false);
      resetForm();
      setMainTab("history");
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setScheduling(false);
    }
  };

  const handlePublishNow = async () => {
    if (!user || !postType) return;
    setPublishing(true);
    let postId: string | null = null;
    try {
      postId = await upsertPost({ status: "scheduled" }); // temp status
      queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });

      const { data: result, error: fnErr } = await supabase.functions.invoke("social-publish", {
        body: { postId },
      });
      if (fnErr) throw fnErr;
      if (!result?.success) throw new Error(result?.error ?? "Publish failed");

      toast({ title: "Published!", description: "Your post has been published to the selected platforms." });
      resetForm();
      setMainTab("history");
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
      if (postId) {
        // Already saved as failed by the edge function — just refresh
        queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });
      }
    } finally {
      setPublishing(false);
    }
  };

  const handleRetry = async (postId: string) => {
    try {
      const { data: result, error: fnErr } = await supabase.functions.invoke("social-publish", {
        body: { postId },
      });
      if (fnErr) throw fnErr;
      if (!result?.success) throw new Error(result?.error ?? "Retry failed");
      queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });
      toast({ title: "Published!" });
    } catch (e: any) {
      toast({ title: "Retry failed", description: e.message, variant: "destructive" });
      queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });
    }
  };

  const handleDeletePost = async (postId: string) => {
    await (supabase as any).from("spotlight_posts").delete().eq("id", postId);
    queryClient.invalidateQueries({ queryKey: ["spotlight-posts"] });
    toast({ title: "Post deleted" });
  };

  const resetForm = () => {
    setStep(1);
    setPostType(null);
    setSelectedAthleteIds([]);
    setSelectedGoals([]);
    setCoachComment("");
    setPostDate("");
    setMediaFile(null);
    setMediaUrl(null);
    setMediaType(null);
    setPlatforms([]);
    setPermissionConfirmed(false);
    setIgCaption("");
    setFbCaption("");
    setHashtags([]);
    setTone("professional");
    setUseEmoji(false);
  };

  // ── Step validation ────────────────────────────────────────────────────────
  const canNext1 = postType !== null;
  const canNext2 = true; // optional fields
  const canNext3 = platforms.length > 0 && mediaUrl !== null && permissionConfirmed;
  const canPublish = (igCaption.trim() || fbCaption.trim()) && platforms.length > 0;

  // ── Premium/paid gate ──────────────────────────────────────────────────────
  if (!aiLoading && !aiEnabled) {
    return (
      <DashboardLayout role="coach">
        <div className="mb-8">
          <h1 className="text-3xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
            <Sparkles className="h-7 w-7 text-violet-400" /> Spotlight Studio
          </h1>
          <p className="text-muted-foreground mt-1">AI-powered social content for your program.</p>
        </div>
        <Card className="max-w-lg">
          <CardContent className="py-12 text-center space-y-4">
            <div className="h-14 w-14 mx-auto rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-violet-400" />
            </div>
            <p className="font-semibold text-lg font-['Space_Grotesk']">AI Premium required</p>
            <p className="text-sm text-muted-foreground">Spotlight Studio uses AI to generate captions. Enable AI Premium to get started.</p>
            <Button className="bg-violet-600 hover:bg-violet-700" onClick={() => setShowAIModal(true)}>
              <Sparkles className="h-4 w-4 mr-2" /> Enable AI Premium
            </Button>
          </CardContent>
        </Card>
        <AIPremiumModal open={showAIModal} onClose={() => setShowAIModal(false)} athleteCount={athletes.length || 1} />
      </DashboardLayout>
    );
  }

  // ── Main render ────────────────────────────────────────────────────────────
  return (
    <DashboardLayout role="coach">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk'] flex items-center gap-2">
          <Sparkles className="h-7 w-7 text-violet-400" /> Spotlight Studio
        </h1>
        <p className="text-muted-foreground mt-1">Turn your athletes' development into compelling social content.</p>
      </div>

      {/* Social connection panel */}
      <div className="mb-8 flex justify-center">
        <Card className="w-full max-w-md">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-base font-['Space_Grotesk'] flex items-center justify-center gap-2">
              <Link2 className="h-4 w-4" /> Connect Your Accounts
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Choose which platforms to connect for publishing</p>
          </CardHeader>
          <CardContent>
            {connLoading ? (
              <div className="flex items-center justify-center gap-2 text-muted-foreground text-sm py-4">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading…
              </div>
            ) : socialConn ? (
              /* ── Connected state ── */
              <div className="space-y-3">
                <div className="rounded-xl border bg-secondary/30 p-4 space-y-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                      <Facebook className="h-4 w-4 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium leading-tight">{socialConn.facebook_page_name}</p>
                      <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                        <CheckCircle2 className="h-3 w-3" /> Connected
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <div className="h-8 w-8 rounded-lg bg-pink-500/15 flex items-center justify-center shrink-0">
                      <Instagram className="h-4 w-4 text-pink-400" />
                    </div>
                    <div>
                      {socialConn.instagram_username ? (
                        <>
                          <p className="text-sm font-medium leading-tight">@{socialConn.instagram_username}</p>
                          <p className="text-[11px] text-emerald-400 flex items-center gap-1 mt-0.5">
                            <CheckCircle2 className="h-3 w-3" /> Connected
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground leading-tight">Instagram</p>
                          <p className="text-[11px] text-yellow-400 flex items-center gap-1 mt-0.5">
                            <AlertCircle className="h-3 w-3" /> No Business account linked to this Page
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => disconnectMutation.mutate()}
                  disabled={disconnectMutation.isPending}
                >
                  {disconnectMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <X className="h-3 w-3 mr-1.5" />}
                  Disconnect Accounts
                </Button>
              </div>
            ) : fbAppId ? (
              /* ── Platform chooser ── */
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {/* Facebook card */}
                  <button
                    onClick={() => setPlatformChoice(prev =>
                      prev.includes("facebook") && prev.length > 1
                        ? prev.filter(p => p !== "facebook")
                        : prev.includes("facebook") ? prev : [...prev, "facebook"]
                    )}
                    className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                      platformChoice.includes("facebook")
                        ? "border-blue-500/60 bg-blue-500/10"
                        : "border-border bg-secondary/20 opacity-60"
                    }`}
                  >
                    {platformChoice.includes("facebook") && (
                      <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-blue-500 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                    <Facebook className="h-7 w-7 text-blue-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold">Facebook</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Page posts</p>
                  </button>

                  {/* Instagram card */}
                  <button
                    onClick={() => setPlatformChoice(prev =>
                      prev.includes("instagram") && prev.length > 1
                        ? prev.filter(p => p !== "instagram")
                        : prev.includes("instagram") ? prev : [...prev, "instagram"]
                    )}
                    className={`relative rounded-xl border-2 p-4 text-center transition-all ${
                      platformChoice.includes("instagram")
                        ? "border-pink-500/60 bg-pink-500/10"
                        : "border-border bg-secondary/20 opacity-60"
                    }`}
                  >
                    {platformChoice.includes("instagram") && (
                      <span className="absolute top-2 right-2 h-4 w-4 rounded-full bg-pink-500 flex items-center justify-center">
                        <CheckCircle2 className="h-3 w-3 text-white" />
                      </span>
                    )}
                    <Instagram className="h-7 w-7 text-pink-400 mx-auto mb-2" />
                    <p className="text-sm font-semibold">Instagram</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">Business account</p>
                  </button>
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  {platformChoice.length === 2
                    ? "Both platforms selected"
                    : platformChoice.includes("instagram")
                    ? "Instagram requires a Facebook Page to connect"
                    : "Facebook Page only"}
                </p>

                <Button
                  className="w-full"
                  onClick={() => handleConnectMeta(platformChoice)}
                  disabled={platformChoice.length === 0}
                >
                  <Link2 className="h-4 w-4 mr-2" />
                  Connect {platformChoice.includes("facebook") && platformChoice.includes("instagram")
                    ? "Facebook & Instagram"
                    : platformChoice.includes("instagram")
                    ? "Instagram (via Facebook)"
                    : "Facebook"}
                </Button>
              </div>
            ) : (
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
                <p className="text-sm font-medium text-yellow-400 flex items-center gap-1.5">
                  <AlertCircle className="h-4 w-4" /> Setup required
                </p>
                <p className="text-xs text-muted-foreground">
                  Set <code className="bg-secondary px-1 rounded">VITE_FACEBOOK_APP_ID</code> in your environment and add{" "}
                  <code className="bg-secondary px-1 rounded">{window.location.origin}/coach/spotlight/callback</code> as a Valid OAuth Redirect URI in your Meta App.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main tabs */}
      <Tabs value={mainTab} onValueChange={(v) => setMainTab(v as "create" | "history")}>
        <TabsList className="mb-6">
          <TabsTrigger value="create">Create Post</TabsTrigger>
          <TabsTrigger value="history">Post History</TabsTrigger>
        </TabsList>

        {/* ── Create Post tab ─────────────────────────────────────────────── */}
        <TabsContent value="create">
          {/* Step indicator */}
          <div className="flex items-center gap-2 mb-6 text-sm">
            {[1, 2, 3, 4].map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold ${
                  step === s ? "bg-primary text-primary-foreground" :
                  step > s ? "bg-emerald-500/20 text-emerald-400" : "bg-secondary text-muted-foreground"
                }`}>
                  {step > s ? <CheckCircle2 className="h-3.5 w-3.5" /> : s}
                </div>
                <span className={step === s ? "text-foreground font-medium" : "text-muted-foreground"}>
                  {["Post Type", "Context", "Media", "Captions"][s - 1]}
                </span>
                {s < 4 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
              </div>
            ))}
          </div>

          {/* ─ Step 1: Post Type ─────────────────────────────────────────── */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-semibold font-['Space_Grotesk']">What kind of post are you creating?</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {POST_TYPES.map(({ type, label, desc, icon: Icon }) => (
                  <button
                    key={type}
                    onClick={() => setPostType(type)}
                    className={`text-left rounded-xl border p-4 transition-all ${
                      postType === type
                        ? "border-primary bg-primary/5"
                        : "border-border hover:border-primary/40 hover:bg-secondary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-primary" />
                      </div>
                      <div>
                        <p className="font-medium text-sm">{label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <Button onClick={() => setStep(2)} disabled={!canNext1}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ─ Step 2: Context ───────────────────────────────────────────── */}
          {step === 2 && (
            <div className="space-y-5">
              <h2 className="font-semibold font-['Space_Grotesk']">Add context for your post</h2>

              {/* Athlete selector */}
              <div className="space-y-2">
                <Label>Athletes (optional)</Label>
                {athletes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No athletes linked yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {athletes.map((a) => (
                      <button
                        key={a.id}
                        onClick={() =>
                          setSelectedAthleteIds((prev) =>
                            prev.includes(a.id) ? prev.filter((x) => x !== a.id) : [...prev, a.id]
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          selectedAthleteIds.includes(a.id)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {a.first_name} {a.last_name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Goal selector */}
              {availableGoals.length > 0 && (
                <div className="space-y-2">
                  <Label>Focus goals (optional)</Label>
                  <div className="flex flex-wrap gap-2">
                    {availableGoals.map((g) => (
                      <button
                        key={g}
                        onClick={() =>
                          setSelectedGoals((prev) =>
                            prev.includes(g) ? prev.filter((x) => x !== g) : [...prev, g]
                          )
                        }
                        className={`px-3 py-1.5 rounded-full text-xs border transition-colors ${
                          selectedGoals.includes(g)
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {g}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Coach comment */}
              <div className="space-y-2">
                <Label>Coach's note (optional, max 280 chars)</Label>
                <Textarea
                  placeholder="Add a personal quote or observation to personalize the caption..."
                  value={coachComment}
                  onChange={(e) => setCoachComment(e.target.value.slice(0, 280))}
                  className="min-h-[80px]"
                />
                <p className="text-xs text-muted-foreground text-right">{coachComment.length}/280</p>
              </div>

              {/* Date */}
              <div className="space-y-2">
                <Label>Date (optional)</Label>
                <Input type="date" value={postDate} onChange={(e) => setPostDate(e.target.value)} className="max-w-xs" />
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(1)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(3)}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ─ Step 3: Media ─────────────────────────────────────────────── */}
          {step === 3 && (
            <div className="space-y-5">
              <h2 className="font-semibold font-['Space_Grotesk']">Upload media & select platforms</h2>

              {/* Media upload */}
              <div className="space-y-3">
                <Label>Media</Label>
                {mediaUrl ? (
                  <div className="space-y-2">
                    {mediaType === "photo" ? (
                      <img src={mediaUrl} alt="Post preview" className="rounded-xl max-h-64 object-cover border" />
                    ) : (
                      <video src={mediaUrl} controls className="rounded-xl max-h-64 w-full border" />
                    )}
                    <Button variant="outline" size="sm" onClick={() => { setMediaUrl(null); setMediaFile(null); setMediaType(null); }}>
                      <Trash2 className="h-3.5 w-3.5 mr-1" /> Remove
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {uploadProgress ? (
                      <Loader2 className="h-6 w-6 animate-spin mx-auto text-muted-foreground" />
                    ) : (
                      <>
                        <Image className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                        <p className="text-sm text-muted-foreground">Click to upload a photo (max 10MB) or video (max 100MB)</p>
                        <p className="text-xs text-muted-foreground mt-1">JPG, PNG, WEBP, MP4</p>
                      </>
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,video/mp4"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </div>
                )}
              </div>

              {/* Platform selection */}
              <div className="space-y-2">
                <Label>Publish to</Label>
                <div className="flex gap-3">
                  {[
                    { id: "instagram", label: "Instagram", icon: <Instagram className="h-4 w-4 text-pink-400" />, available: !!socialConn?.instagram_account_id },
                    { id: "facebook", label: "Facebook", icon: <Facebook className="h-4 w-4 text-blue-400" />, available: !!socialConn },
                  ].map(({ id, label, icon, available }) => (
                    <button
                      key={id}
                      disabled={!available}
                      onClick={() => setPlatforms((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id])}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border text-sm transition-colors ${
                        platforms.includes(id)
                          ? "border-primary bg-primary/10"
                          : available
                          ? "border-border hover:border-primary/40"
                          : "border-border opacity-40 cursor-not-allowed"
                      }`}
                    >
                      {icon} {label}
                      {!available && <span className="text-[10px] text-muted-foreground">(not connected)</span>}
                    </button>
                  ))}
                </div>
                {!socialConn && (
                  <p className="text-xs text-muted-foreground">Connect your social account above to publish.</p>
                )}
              </div>

              {/* Permission */}
              <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-4 space-y-2">
                <div className="flex items-start gap-2">
                  <Checkbox
                    id="permission"
                    checked={permissionConfirmed}
                    onCheckedChange={(v) => setPermissionConfirmed(!!v)}
                  />
                  <Label htmlFor="permission" className="text-sm leading-relaxed cursor-pointer">
                    I confirm I have permission to use this media and that the content follows Facebook and Instagram platform guidelines.
                  </Label>
                </div>
                <p className="text-[10px] text-muted-foreground pl-6">
                  The coach is responsible for all posted content and media permissions. ClipMVP is not liable for platform policy violations.
                </p>
              </div>

              <div className="flex justify-between">
                <Button variant="outline" onClick={() => setStep(2)}><ChevronLeft className="h-4 w-4 mr-1" /> Back</Button>
                <Button onClick={() => setStep(4)} disabled={!canNext3}>Next <ChevronRight className="h-4 w-4 ml-1" /></Button>
              </div>
            </div>
          )}

          {/* ─ Step 4: Captions & Publish ────────────────────────────────── */}
          {step === 4 && (
            <div className="space-y-6">
              <h2 className="font-semibold font-['Space_Grotesk']">Generate captions and publish</h2>

              {/* Tone + emoji */}
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="space-y-2 flex-1">
                  <Label>Tone</Label>
                  <div className="flex gap-2 flex-wrap">
                    {TONES.map(({ value, label }) => (
                      <button
                        key={value}
                        onClick={() => setTone(value)}
                        className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                          tone === value ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground">{TONES.find((t) => t.value === tone)?.desc}</p>
                </div>
                <div className="flex items-center gap-2 self-end pb-1">
                  <Checkbox id="emoji" checked={useEmoji} onCheckedChange={(v) => setUseEmoji(!!v)} />
                  <Label htmlFor="emoji" className="text-sm cursor-pointer">Use emoji</Label>
                </div>
              </div>

              {/* Generate button */}
              <Button onClick={handleGenerateCaptions} disabled={generating} variant="outline" className="w-full">
                {generating ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Sparkles className="h-4 w-4 mr-2 text-violet-400" />}
                {generating ? "Generating…" : "Generate Captions"}
              </Button>

              {/* Instagram caption */}
              {platforms.includes("instagram") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5 text-pink-400" /> Instagram Caption</Label>
                    <span className={`text-xs ${igCaption.length > 2000 ? "text-yellow-400" : igCaption.length > 2150 ? "text-red-400" : "text-muted-foreground"}`}>
                      {igCaption.length}/2200
                    </span>
                  </div>
                  <Textarea value={igCaption} onChange={(e) => setIgCaption(e.target.value)} className="min-h-[140px] font-mono text-sm" />
                </div>
              )}

              {/* Facebook caption */}
              {platforms.includes("facebook") && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-1.5"><Facebook className="h-3.5 w-3.5 text-blue-400" /> Facebook Caption</Label>
                    <span className="text-xs text-muted-foreground">{fbCaption.length} chars</span>
                  </div>
                  <Textarea value={fbCaption} onChange={(e) => setFbCaption(e.target.value)} className="min-h-[140px] font-mono text-sm" />
                </div>
              )}

              {/* Hashtag chips */}
              {hashtags.length > 0 && (
                <div className="space-y-2">
                  <Label>Hashtags</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {hashtags.map((h) => (
                      <span
                        key={h}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-secondary text-xs text-muted-foreground group"
                      >
                        {h}
                        <button onClick={() => setHashtags((prev) => prev.filter((x) => x !== h))} className="opacity-50 hover:opacity-100">
                          <X className="h-2.5 w-2.5" />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Preview card */}
              {(igCaption || fbCaption) && mediaUrl && (
                <div className="rounded-xl border bg-secondary/30 overflow-hidden">
                  <p className="text-xs text-muted-foreground px-4 pt-3 pb-2 font-medium uppercase tracking-wide">Preview</p>
                  {mediaType === "photo" ? (
                    <img src={mediaUrl} alt="preview" className="w-full max-h-56 object-cover" />
                  ) : (
                    <video src={mediaUrl} className="w-full max-h-56 object-cover" muted />
                  )}
                  <div className="p-4">
                    <p className="text-xs text-muted-foreground mb-1">
                      {platforms.includes("instagram") ? "Instagram" : "Facebook"}
                    </p>
                    <p className="text-sm whitespace-pre-line line-clamp-4">
                      {platforms.includes("instagram") ? igCaption : fbCaption}
                    </p>
                  </div>
                </div>
              )}

              {/* Action row */}
              <div className="flex flex-wrap items-center gap-3 pt-2 border-t">
                <Button variant="outline" onClick={() => setStep(3)}>
                  <ChevronLeft className="h-4 w-4 mr-1" /> Back
                </Button>

                <Button variant="secondary" onClick={handleSaveDraft} disabled={savingDraft || !postType}>
                  {savingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Save className="h-3.5 w-3.5 mr-1" />}
                  Save Draft
                </Button>

                {/* Schedule popover */}
                <Popover open={scheduleOpen} onOpenChange={setScheduleOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="secondary" disabled={!canPublish}>
                      <Clock className="h-3.5 w-3.5 mr-1" /> Schedule
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-72 space-y-3">
                    <p className="text-sm font-medium">Schedule post</p>
                    <Input
                      type="datetime-local"
                      value={scheduleDateTime}
                      onChange={(e) => setScheduleDateTime(e.target.value)}
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    <Button
                      className="w-full"
                      onClick={handleSchedule}
                      disabled={!scheduleDateTime || scheduling}
                    >
                      {scheduling ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CalendarDays className="h-3.5 w-3.5 mr-1" />}
                      Confirm Schedule
                    </Button>
                  </PopoverContent>
                </Popover>

                <Button
                  onClick={handlePublishNow}
                  disabled={!canPublish || publishing || !socialConn}
                  className="ml-auto"
                  title={!socialConn ? "Connect your social account first" : ""}
                >
                  {publishing ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Send className="h-3.5 w-3.5 mr-1" />}
                  Publish Now
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* ── Post History tab ─────────────────────────────────────────────── */}
        <TabsContent value="history">
          {postsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : posts.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Sparkles className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No posts yet</p>
                <p className="text-sm text-muted-foreground mt-1">Create your first spotlight post to see it here.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {posts.map((post) => (
                <Card key={post.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      {/* Thumbnail */}
                      {post.media_url ? (
                        post.media_type === "photo" ? (
                          <img src={post.media_url} alt="" className="h-16 w-16 rounded-lg object-cover shrink-0" />
                        ) : (
                          <video src={post.media_url} className="h-16 w-16 rounded-lg object-cover shrink-0" muted />
                        )
                      ) : (
                        <div className="h-16 w-16 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <Image className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <Badge variant="outline" className="text-[10px] capitalize">
                            {post.post_type.replace(/_/g, " ")}
                          </Badge>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full capitalize ${STATUS_COLORS[post.status]}`}>
                            {post.status}
                          </span>
                          {(post.platforms ?? []).includes("instagram") && <Instagram className="h-3.5 w-3.5 text-pink-400" />}
                          {(post.platforms ?? []).includes("facebook") && <Facebook className="h-3.5 w-3.5 text-blue-400" />}
                        </div>

                        <p className="text-sm text-muted-foreground line-clamp-1">
                          {post.instagram_caption ?? post.facebook_caption ?? "No caption"}
                        </p>

                        {post.status === "failed" && post.publish_error && (
                          <p className="text-xs text-red-400 mt-1 flex items-center gap-1">
                            <AlertCircle className="h-3 w-3 shrink-0" /> {post.publish_error}
                          </p>
                        )}

                        <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                          {post.scheduled_at && <span className="flex items-center gap-1"><Clock className="h-3 w-3" /> {new Date(post.scheduled_at).toLocaleDateString()}</span>}
                          {post.published_at && <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3 text-emerald-400" /> {new Date(post.published_at).toLocaleDateString()}</span>}
                          {!post.scheduled_at && !post.published_at && <span>{new Date(post.created_at).toLocaleDateString()}</span>}
                        </div>
                      </div>

                      <div className="flex flex-col gap-1 shrink-0">
                        {post.status === "failed" && (
                          <Button size="sm" variant="outline" onClick={() => handleRetry(post.id)}>
                            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Retry
                          </Button>
                        )}
                        <Button size="sm" variant="ghost" onClick={() => handleDeletePost(post.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <AIPremiumModal open={showAIModal} onClose={() => setShowAIModal(false)} athleteCount={athletes.length || 1} />
      <UpgradeModal open={showUpgradeModal} onClose={() => setShowUpgradeModal(false)} />
    </DashboardLayout>
  );
};

export default SpotlightStudio;
