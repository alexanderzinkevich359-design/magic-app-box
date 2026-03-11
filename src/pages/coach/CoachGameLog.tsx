import { useState, useMemo, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Tooltip, TooltipContent, TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Trophy, Dumbbell, Swords, Users, Plus, ChevronRight, ChevronLeft,
  Download, Search, Lock, Loader2, BarChart2, ChevronUp, ChevronDown,
  Sparkles, CheckSquare, Square,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useAllSportConfigs } from "@/hooks/useSportConfig";
import {
  getStatGroupEntries, evalDerivedStat, formatBattingAvg,
  type GameStatGroups, type DerivedStatDef, type GameStatDef,
} from "@/lib/sports/types";
import { generateGameInsight, type GameInsightContext } from "@/lib/ai/gameInsightService";
import { format } from "date-fns";

// ─── Types ────────────────────────────────────────────────────────────────────

type EventType = "game" | "practice" | "scrimmage" | "tournament";
type ResultType = "W" | "L" | "T" | "";

interface GameEvent {
  id: string;
  event_type: EventType;
  event_date: string;
  opponent: string | null;
  location: string | null;
  result: string | null;
  score_us: number | null;
  score_them: number | null;
  notes: string | null;
  sport_id: string | null;
  team_id: string | null;
  created_at: string;
  athlete_count?: number;
}

interface AthleteStatRow {
  athlete_id: string;
  stat_group: string;
  stat_key: string;
  value: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const EVENT_TYPE_CONFIG: Record<EventType, { label: string; icon: React.ReactNode; color: string }> = {
  game:       { label: "Game",       icon: <Trophy className="h-4 w-4" />,  color: "bg-blue-500/10 text-blue-400 border-blue-500/20" },
  practice:   { label: "Practice",   icon: <Dumbbell className="h-4 w-4" />,color: "bg-green-500/10 text-green-400 border-green-500/20" },
  scrimmage:  { label: "Scrimmage",  icon: <Swords className="h-4 w-4" />,  color: "bg-orange-500/10 text-orange-400 border-orange-500/20" },
  tournament: { label: "Tournament", icon: <Trophy className="h-4 w-4" />,  color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
};

const RESULT_COLORS: Record<string, string> = {
  W: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  L: "bg-red-500/10 text-red-400 border-red-500/20",
  T: "bg-gray-500/10 text-gray-400 border-gray-500/20",
};

// ─── Season Stats helpers ──────────────────────────────────────────────────────

interface SeasonRow {
  athlete_id: string;
  name: string;
  position: string;
  stats: Record<string, number>;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CoachGameLog() {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const aiEnabled = (profile as any)?.ai_premium === true;

  const { data: sportConfigs = [] } = useAllSportConfigs();

  // ── Shared queries ──────────────────────────────────────────────────────────

  const { data: teams = [] } = useQuery({
    queryKey: ["coach-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("teams")
        .select("id, name")
        .eq("coach_id", user.id)
        .order("name");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: events = [], isLoading: eventsLoading } = useQuery({
    queryKey: ["game-events", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("game_events")
        .select("*, game_athlete_stats(count)")
        .eq("coach_id", user.id)
        .order("event_date", { ascending: false });
      return (data ?? []).map((e: any) => ({
        ...e,
        athlete_count: Number(e.game_athlete_stats?.[0]?.count ?? 0),
      })) as GameEvent[];
    },
    enabled: !!user,
  });

  // ── Tab state ───────────────────────────────────────────────────────────────
  const [tab, setTab] = useState<"events" | "log" | "season">("events");
  const [filterType, setFilterType] = useState<EventType | "all">("all");

  // ── Events tab ──────────────────────────────────────────────────────────────
  const [viewStatsEvent, setViewStatsEvent] = useState<GameEvent | null>(null);

  const filteredEvents = useMemo(() =>
    filterType === "all" ? events : events.filter((e) => e.event_type === filterType),
    [events, filterType]
  );

  // ─── Log Event stepper ─────────────────────────────────────────────────────
  const [step, setStep] = useState(1);
  const [formEventType, setFormEventType] = useState<EventType>("practice");
  const [formDate, setFormDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [formTeamId, setFormTeamId] = useState("");
  const [formSportId, setFormSportId] = useState("");
  const [formOpponent, setFormOpponent] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formResult, setFormResult] = useState<ResultType>("");
  const [formScoreUs, setFormScoreUs] = useState("");
  const [formScoreThem, setFormScoreThem] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [selectedAthletes, setSelectedAthletes] = useState<Set<string>>(new Set());
  // stat entry: athleteId -> group -> key -> value
  const [statValues, setStatValues] = useState<Record<string, Record<string, Record<string, string>>>>({});

  const isCompetitive = formEventType !== "practice";
  const selectedSportConfig = sportConfigs.find((s) => s.id === formSportId) ?? null;
  const statGroups = selectedSportConfig?.game_stat_groups ?? {};
  const statGroupEntries = getStatGroupEntries(statGroups);
  const derivedDefs = (statGroups.derived as DerivedStatDef[] | undefined) ?? [];
  const [activeStatGroup, setActiveStatGroup] = useState<string>("");

  const resetForm = useCallback(() => {
    setStep(1);
    setFormEventType("practice");
    setFormDate(format(new Date(), "yyyy-MM-dd"));
    setFormTeamId("");
    setFormSportId("");
    setFormOpponent("");
    setFormLocation("");
    setFormResult("");
    setFormScoreUs("");
    setFormScoreThem("");
    setFormNotes("");
    setSelectedAthletes(new Set());
    setStatValues({});
    setActiveStatGroup("");
  }, []);

  // Team athletes for step 2
  const { data: teamAthletes = [] } = useQuery({
    queryKey: ["team-athletes-for-log", formTeamId],
    queryFn: async () => {
      if (!formTeamId) return [];
      const { data: members } = await (supabase as any)
        .from("team_members")
        .select("athlete_user_id")
        .eq("team_id", formTeamId);
      if (!members?.length) return [];
      const athleteIds = members.map((m: any) => m.athlete_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", athleteIds);
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id, position")
        .in("athlete_user_id", athleteIds);
      const linkMap = Object.fromEntries(
        (links ?? []).map((l: any) => [l.athlete_user_id, l.position])
      );
      return (profiles ?? []).map((p: any) => ({
        id: p.user_id,
        name: `${p.first_name} ${p.last_name}`,
        position: linkMap[p.user_id] ?? "",
      }));
    },
    enabled: !!formTeamId,
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not logged in");

      // 1. Insert game_events row
      const { data: eventRow, error: evErr } = await (supabase as any)
        .from("game_events")
        .insert({
          coach_id: user.id,
          team_id: formTeamId || null,
          sport_id: formSportId || null,
          event_type: formEventType,
          event_date: formDate,
          opponent: formOpponent || null,
          location: formLocation || null,
          result: formResult || null,
          score_us: formScoreUs ? parseInt(formScoreUs, 10) : null,
          score_them: formScoreThem ? parseInt(formScoreThem, 10) : null,
          notes: formNotes || null,
        })
        .select("id")
        .single();
      if (evErr) throw evErr;
      const eventId = eventRow.id as string;

      // 2. Build stat rows
      const statsToInsert: any[] = [];
      const athleteList = teamAthletes.filter((a: any) => selectedAthletes.has(a.id));

      if (!isCompetitive) {
        // Practice → attendance only
        for (const a of athleteList) {
          statsToInsert.push({
            event_id: eventId,
            athlete_id: a.id,
            stat_group: "attendance",
            stat_key: "present",
            value: 1,
          });
        }
      } else {
        for (const a of athleteList) {
          const athleteStats = statValues[a.id] ?? {};
          for (const [group, keys] of Object.entries(athleteStats)) {
            for (const [key, rawVal] of Object.entries(keys)) {
              const v = parseFloat(rawVal);
              if (!isNaN(v)) {
                statsToInsert.push({
                  event_id: eventId,
                  athlete_id: a.id,
                  stat_group: group,
                  stat_key: key,
                  value: v,
                });
              }
            }
          }
        }
      }

      if (statsToInsert.length > 0) {
        const { error: sErr } = await (supabase as any)
          .from("game_athlete_stats")
          .upsert(statsToInsert, { onConflict: "event_id,athlete_id,stat_group,stat_key" });
        if (sErr) throw sErr;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["game-events", user?.id] });
      queryClient.invalidateQueries({ queryKey: ["season-stats", user?.id] });
      toast({ title: "Event saved", description: "The event has been logged successfully." });
      resetForm();
      setTab("events");
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ─── Stats Viewer Dialog ───────────────────────────────────────────────────

  const [viewStatsGroup, setViewStatsGroup] = useState<string>("");
  const [insightAthlete, setInsightAthlete] = useState<string | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightData, setInsightData] = useState<Record<string, any>>({});

  const { data: viewStats = [] } = useQuery({
    queryKey: ["event-stats", viewStatsEvent?.id],
    queryFn: async () => {
      if (!viewStatsEvent) return [];
      const { data } = await (supabase as any)
        .from("game_athlete_stats")
        .select("athlete_id, stat_group, stat_key, value")
        .eq("event_id", viewStatsEvent.id);
      return (data ?? []) as AthleteStatRow[];
    },
    enabled: !!viewStatsEvent,
  });

  const { data: viewAthleteProfiles = [] } = useQuery({
    queryKey: ["event-athlete-profiles", viewStatsEvent?.id],
    queryFn: async () => {
      if (!viewStats.length) return [];
      const ids = [...new Set(viewStats.map((r) => r.athlete_id))];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", ids);
      return (data ?? []) as { user_id: string; first_name: string; last_name: string }[];
    },
    enabled: viewStats.length > 0,
  });

  const viewSportConfig = sportConfigs.find((s) => s.id === viewStatsEvent?.sport_id) ?? null;
  const viewStatGroups: GameStatGroups = viewSportConfig?.game_stat_groups ?? {};
  const viewGroupEntries = getStatGroupEntries(viewStatGroups);
  const viewDerived = (viewStatGroups.derived as DerivedStatDef[] | undefined) ?? [];

  // Build per-athlete stats map
  const athleteStatsMap = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    for (const row of viewStats) {
      if (!map[row.athlete_id]) map[row.athlete_id] = {};
      map[row.athlete_id][row.stat_key] = row.value;
    }
    return map;
  }, [viewStats]);

  const viewAthleteIds = useMemo(() =>
    [...new Set(viewStats.map((r) => r.athlete_id))],
    [viewStats]
  );

  const currentViewGroup = viewGroupEntries[0]?.[0] ?? "";
  const [activeViewGroup, setActiveViewGroup] = useState<string>("");
  const effectiveViewGroup = activeViewGroup || currentViewGroup;

  const currentGroupDefs: GameStatDef[] = useMemo(() => {
    const entry = viewGroupEntries.find(([k]) => k === effectiveViewGroup);
    return entry ? entry[1] : [];
  }, [viewGroupEntries, effectiveViewGroup]);

  async function handleGenerateInsight(athleteId: string) {
    if (!viewSportConfig) return;
    setInsightAthlete(athleteId);
    setInsightLoading(true);
    try {
      const ap = viewAthleteProfiles.find((p) => p.user_id === athleteId);
      const name = ap ? `${ap.first_name} ${ap.last_name}` : "Athlete";
      // Fetch last 5 game events for this athlete
      const { data: recent } = await (supabase as any)
        .from("game_athlete_stats")
        .select("event_id, stat_group, stat_key, value")
        .eq("athlete_id", athleteId);
      const eventIds = [...new Set((recent ?? []).map((r: any) => r.event_id))] as string[];
      const { data: recentEvents } = await (supabase as any)
        .from("game_events")
        .select("id, event_date, event_type, opponent")
        .in("id", eventIds)
        .in("event_type", ["game", "scrimmage", "tournament"])
        .order("event_date", { ascending: false })
        .limit(5);
      const recentGames = (recentEvents ?? []).map((ev: any) => {
        const evStats: Record<string, number> = {};
        for (const r of (recent ?? []).filter((r: any) => r.event_id === ev.id)) {
          evStats[r.stat_key] = r.value;
        }
        return { date: ev.event_date, eventType: ev.event_type, opponent: ev.opponent, stats: evStats };
      });
      const ctx: GameInsightContext = {
        athleteName: name,
        position: "",
        sport: viewSportConfig.name,
        recentGames,
      };
      const result = await generateGameInsight(ctx);
      setInsightData((prev) => ({ ...prev, [athleteId]: result }));
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setInsightLoading(false);
    }
  }

  // ─── Season Stats tab ──────────────────────────────────────────────────────

  const [seasonSportId, setSeasonSportId] = useState("");
  const [seasonSearch, setSeasonSearch] = useState("");
  const [sortCol, setSortCol] = useState<string>("name");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const { data: seasonRawStats = [], isLoading: seasonLoading } = useQuery({
    queryKey: ["season-stats", user?.id, seasonSportId],
    queryFn: async () => {
      if (!user) return [];
      const currentYear = new Date().getFullYear();
      const { data: evs } = await (supabase as any)
        .from("game_events")
        .select("id, sport_id")
        .eq("coach_id", user.id)
        .in("event_type", ["game", "scrimmage", "tournament"])
        .gte("event_date", `${currentYear}-01-01`);
      if (!evs?.length) return [];

      const filteredEvs = seasonSportId
        ? evs.filter((e: any) => e.sport_id === seasonSportId)
        : evs;
      if (!filteredEvs.length) return [];

      const eventIds = filteredEvs.map((e: any) => e.id);
      const { data: stats } = await (supabase as any)
        .from("game_athlete_stats")
        .select("event_id, athlete_id, stat_key, value")
        .in("event_id", eventIds);
      return (stats ?? []) as { event_id: string; athlete_id: string; stat_key: string; value: number }[];
    },
    enabled: !!user,
  });

  const { data: seasonAthleteProfiles = [] } = useQuery({
    queryKey: ["season-athlete-profiles", seasonRawStats.map((r) => r.athlete_id).join(",")],
    queryFn: async () => {
      const ids = [...new Set(seasonRawStats.map((r) => r.athlete_id))];
      if (!ids.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", ids);
      return (data ?? []) as { user_id: string; first_name: string; last_name: string }[];
    },
    enabled: seasonRawStats.length > 0,
  });

  const seasonSportConfig = sportConfigs.find((s) => s.id === seasonSportId) ?? null;
  const seasonStatGroups: GameStatGroups = seasonSportConfig?.game_stat_groups ?? {};
  const seasonGroupEntries = getStatGroupEntries(seasonStatGroups);
  const seasonDerived = (seasonStatGroups.derived as DerivedStatDef[] | undefined) ?? [];

  const seasonRows: SeasonRow[] = useMemo(() => {
    const byAthlete: Record<string, Record<string, number>> = {};
    for (const row of seasonRawStats) {
      if (!byAthlete[row.athlete_id]) byAthlete[row.athlete_id] = {};
      byAthlete[row.athlete_id][row.stat_key] = (byAthlete[row.athlete_id][row.stat_key] ?? 0) + row.value;
    }
    return seasonAthleteProfiles.map((p) => ({
      athlete_id: p.user_id,
      name: `${p.first_name} ${p.last_name}`,
      position: "",
      stats: byAthlete[p.user_id] ?? {},
    }));
  }, [seasonRawStats, seasonAthleteProfiles]);

  const allSeasonKeys = useMemo(() => {
    const keys = new Set<string>();
    for (const row of seasonRows) Object.keys(row.stats).forEach((k) => keys.add(k));
    return [...keys];
  }, [seasonRows]);

  const filteredSeasonRows = useMemo(() => {
    let rows = seasonSearch
      ? seasonRows.filter((r) => r.name.toLowerCase().includes(seasonSearch.toLowerCase()))
      : seasonRows;
    rows = [...rows].sort((a, b) => {
      if (sortCol === "name") {
        return sortDir === "asc" ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name);
      }
      const av = a.stats[sortCol] ?? 0;
      const bv = b.stats[sortCol] ?? 0;
      return sortDir === "asc" ? av - bv : bv - av;
    });
    return rows;
  }, [seasonRows, seasonSearch, sortCol, sortDir]);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortCol(col); setSortDir("desc"); }
  }

  function downloadCSV() {
    const headers = ["Athlete", ...allSeasonKeys];
    const rows = filteredSeasonRows.map((r) => [r.name, ...allSeasonKeys.map((k) => r.stats[k] ?? 0)]);
    const csv = [headers, ...rows].map((row) => row.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "season-stats.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Stat cell handler ─────────────────────────────────────────────────────

  function setStatVal(athleteId: string, group: string, key: string, val: string) {
    setStatValues((prev) => ({
      ...prev,
      [athleteId]: {
        ...(prev[athleteId] ?? {}),
        [group]: {
          ...(prev[athleteId]?.[group] ?? {}),
          [key]: val,
        },
      },
    }));
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="coach">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk'] flex items-center gap-3">
          <BarChart2 className="h-7 w-7 text-primary" />
          Game Log
        </h1>
        <p className="text-muted-foreground mt-1">
          Log games, practices, and tournaments. Track stats and review season progress.
        </p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="mb-6">
          <TabsTrigger value="events">Events</TabsTrigger>
          <TabsTrigger value="log">Log Event</TabsTrigger>
          <TabsTrigger value="season">Season Stats</TabsTrigger>
        </TabsList>

        {/* ── Events Tab ────────────────────────────────────────────────────── */}
        <TabsContent value="events">
          {/* Filter chips */}
          <div className="flex flex-wrap gap-2 mb-4">
            {(["all", "game", "practice", "scrimmage", "tournament"] as const).map((ft) => (
              <button
                key={ft}
                onClick={() => setFilterType(ft)}
                className={`px-3 py-1 rounded-full text-sm font-medium border transition-colors ${
                  filterType === ft
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-secondary text-muted-foreground border-transparent hover:border-primary/30"
                }`}
              >
                {ft === "all" ? "All" : EVENT_TYPE_CONFIG[ft].label}
              </button>
            ))}
          </div>

          {eventsLoading && (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {!eventsLoading && filteredEvents.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <Trophy className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No events logged yet</p>
                <p className="text-sm text-muted-foreground mt-1">Switch to the Log Event tab to record your first event.</p>
                <Button className="mt-4" size="sm" onClick={() => setTab("log")}>
                  <Plus className="h-4 w-4 mr-2" /> Log Event
                </Button>
              </CardContent>
            </Card>
          )}

          <div className="space-y-3">
            {filteredEvents.map((ev) => {
              const cfg = EVENT_TYPE_CONFIG[ev.event_type];
              return (
                <Card key={ev.id} className="hover:border-primary/30 transition-colors">
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="shrink-0">
                      <Badge variant="outline" className={`${cfg.color} flex items-center gap-1.5`}>
                        {cfg.icon} {cfg.label}
                      </Badge>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">
                          {format(new Date(ev.event_date + "T12:00:00"), "MMM d, yyyy")}
                        </span>
                        {ev.opponent && (
                          <span className="text-sm text-muted-foreground">vs. {ev.opponent}</span>
                        )}
                        {ev.result && (
                          <Badge variant="outline" className={`text-xs ${RESULT_COLORS[ev.result] ?? ""}`}>
                            {ev.result}
                            {ev.score_us != null && ev.score_them != null && ` ${ev.score_us}–${ev.score_them}`}
                          </Badge>
                        )}
                      </div>
                      {ev.location && (
                        <p className="text-xs text-muted-foreground mt-0.5">{ev.location}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Users className="h-3.5 w-3.5" /> {ev.athlete_count}
                      </span>
                      <Button size="sm" variant="outline" onClick={() => {
                        setViewStatsEvent(ev);
                        setActiveViewGroup("");
                        setInsightAthlete(null);
                        setInsightData({});
                      }}>
                        View Stats
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        {/* ── Log Event Tab ─────────────────────────────────────────────────── */}
        <TabsContent value="log">
          <Card>
            <CardHeader>
              <CardTitle className="font-['Space_Grotesk'] flex items-center gap-2">
                <span className="text-muted-foreground text-sm font-normal">Step {step} of {isCompetitive ? 3 : 2}</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Step 1 — Event Setup */}
              {step === 1 && (
                <div className="space-y-6">
                  {/* Event type cards */}
                  <div>
                    <Label className="text-sm font-medium mb-3 block">Event Type</Label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {(["practice", "game", "scrimmage", "tournament"] as EventType[]).map((t) => {
                        const cfg = EVENT_TYPE_CONFIG[t];
                        return (
                          <button
                            key={t}
                            onClick={() => setFormEventType(t)}
                            className={`flex flex-col items-center gap-2 p-4 rounded-lg border text-sm font-medium transition-all ${
                              formEventType === t
                                ? "border-primary bg-primary/10 text-primary"
                                : "border-border bg-secondary/30 text-muted-foreground hover:border-primary/40"
                            }`}
                          >
                            {cfg.icon}
                            {cfg.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-4 sm:grid-cols-2">
                    <div>
                      <Label htmlFor="ev-date">Date</Label>
                      <Input
                        id="ev-date"
                        type="date"
                        value={formDate}
                        onChange={(e) => setFormDate(e.target.value)}
                        className="mt-1"
                      />
                    </div>

                    <div>
                      <Label htmlFor="ev-team">Team (optional)</Label>
                      <Select value={formTeamId} onValueChange={setFormTeamId}>
                        <SelectTrigger id="ev-team" className="mt-1">
                          <SelectValue placeholder="Select team…" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">No team</SelectItem>
                          {teams.map((t: any) => (
                            <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div>
                      <Label htmlFor="ev-sport">Sport</Label>
                      <Select value={formSportId} onValueChange={(v) => { setFormSportId(v); setActiveStatGroup(""); }}>
                        <SelectTrigger id="ev-sport" className="mt-1">
                          <SelectValue placeholder="Select sport…" />
                        </SelectTrigger>
                        <SelectContent>
                          {sportConfigs.map((s) => (
                            <SelectItem key={s.id} value={s.id}>{s.icon} {s.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Competitive fields */}
                  {isCompetitive && (
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div>
                        <Label htmlFor="ev-opp">Opponent</Label>
                        <Input id="ev-opp" value={formOpponent} onChange={(e) => setFormOpponent(e.target.value)} placeholder="Team name…" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="ev-loc">Location</Label>
                        <Input id="ev-loc" value={formLocation} onChange={(e) => setFormLocation(e.target.value)} placeholder="Field / venue…" className="mt-1" />
                      </div>
                      <div>
                        <Label htmlFor="ev-result">Result</Label>
                        <Select value={formResult} onValueChange={(v) => setFormResult(v as ResultType)}>
                          <SelectTrigger id="ev-result" className="mt-1">
                            <SelectValue placeholder="W / L / T…" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="W">Win</SelectItem>
                            <SelectItem value="L">Loss</SelectItem>
                            <SelectItem value="T">Tie</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      {formResult && (
                        <div className="flex gap-2 items-end">
                          <div className="flex-1">
                            <Label htmlFor="ev-score-us">Our Score</Label>
                            <Input id="ev-score-us" type="number" min="0" value={formScoreUs} onChange={(e) => setFormScoreUs(e.target.value)} className="mt-1" />
                          </div>
                          <span className="mb-2.5 text-muted-foreground">–</span>
                          <div className="flex-1">
                            <Label htmlFor="ev-score-them">Their Score</Label>
                            <Input id="ev-score-them" type="number" min="0" value={formScoreThem} onChange={(e) => setFormScoreThem(e.target.value)} className="mt-1" />
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <Label htmlFor="ev-notes">Notes (optional)</Label>
                    <Textarea id="ev-notes" value={formNotes} onChange={(e) => setFormNotes(e.target.value)} placeholder="Any additional notes…" className="mt-1 min-h-[80px]" />
                  </div>

                  <div className="flex justify-end">
                    <Button onClick={() => setStep(2)} disabled={!formDate || !formSportId}>
                      Next: Select Athletes <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Step 2 — Athlete Selection */}
              {step === 2 && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">
                    {isCompetitive ? "Select athletes who played in this event." : "Mark attendance for this practice."}
                  </p>

                  {teamAthletes.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      {formTeamId ? "No athletes found on this team." : "No team selected — athletes won't be pre-populated. Select a team in step 1 to load the roster."}
                    </p>
                  )}

                  <div className="space-y-2">
                    {teamAthletes.map((a: any) => {
                      const checked = selectedAthletes.has(a.id);
                      return (
                        <button
                          key={a.id}
                          onClick={() => setSelectedAthletes((prev) => {
                            const next = new Set(prev);
                            if (next.has(a.id)) next.delete(a.id); else next.add(a.id);
                            return next;
                          })}
                          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg border text-left transition-colors ${
                            checked
                              ? "border-primary bg-primary/10"
                              : "border-border bg-secondary/20 hover:border-primary/40"
                          }`}
                        >
                          {checked ? <CheckSquare className="h-4 w-4 text-primary shrink-0" /> : <Square className="h-4 w-4 text-muted-foreground shrink-0" />}
                          <span className="flex-1 font-medium text-sm">{a.name}</span>
                          {a.position && <span className="text-xs text-muted-foreground">{a.position}</span>}
                        </button>
                      );
                    })}
                  </div>

                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(1)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    {isCompetitive ? (
                      <Button onClick={() => { setStep(3); setActiveStatGroup(statGroupEntries[0]?.[0] ?? ""); }}
                        disabled={selectedAthletes.size === 0}>
                        Next: Enter Stats <ChevronRight className="h-4 w-4 ml-1" />
                      </Button>
                    ) : (
                      <Button onClick={() => saveMutation.mutate()} disabled={selectedAthletes.size === 0 || saveMutation.isPending}>
                        {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                        Save Practice
                      </Button>
                    )}
                  </div>
                </div>
              )}

              {/* Step 3 — Stat Entry (competitive only) */}
              {step === 3 && (
                <div className="space-y-4">
                  {statGroupEntries.length === 0 && (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No stat definitions configured for this sport. You can still save the event without stats.
                    </p>
                  )}

                  {statGroupEntries.length > 0 && (
                    <>
                      {/* Stat group tabs */}
                      <div className="flex gap-2 flex-wrap">
                        {statGroupEntries.map(([group]) => (
                          <button
                            key={group}
                            onClick={() => setActiveStatGroup(group)}
                            className={`px-3 py-1.5 rounded-md text-sm font-medium border transition-colors capitalize ${
                              activeStatGroup === group
                                ? "bg-primary text-primary-foreground border-primary"
                                : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                            }`}
                          >
                            {group}
                          </button>
                        ))}
                      </div>

                      {/* Stat table */}
                      <div className="overflow-x-auto rounded-lg border">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b bg-secondary/30">
                              <th className="text-left px-3 py-2 font-medium text-muted-foreground w-40">Athlete</th>
                              {(statGroupEntries.find(([k]) => k === activeStatGroup)?.[1] ?? []).map((def) => (
                                <th key={def.key} className="px-2 py-2 font-medium text-muted-foreground text-center w-16">
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className="cursor-help">{def.label}</span>
                                    </TooltipTrigger>
                                    <TooltipContent>{def.full}</TooltipContent>
                                  </Tooltip>
                                </th>
                              ))}
                              {derivedDefs.map((d) => (
                                <th key={d.key} className="px-2 py-2 font-medium text-muted-foreground text-center w-16 opacity-60">
                                  {d.label}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody>
                            {teamAthletes
                              .filter((a: any) => selectedAthletes.has(a.id))
                              .map((a: any) => {
                                const defs = statGroupEntries.find(([k]) => k === activeStatGroup)?.[1] ?? [];
                                const currentStats: Record<string, number> = {};
                                for (const [grp, keys] of Object.entries(statValues[a.id] ?? {})) {
                                  for (const [k, v] of Object.entries(keys as Record<string, string>)) {
                                    const n = parseFloat(v);
                                    if (!isNaN(n)) currentStats[k] = n;
                                  }
                                }
                                return (
                                  <tr key={a.id} className="border-b last:border-b-0 hover:bg-secondary/20">
                                    <td className="px-3 py-2 font-medium whitespace-nowrap">{a.name}</td>
                                    {defs.map((def) => (
                                      <td key={def.key} className="px-1 py-1 text-center">
                                        <Input
                                          type="number"
                                          min="0"
                                          step="any"
                                          value={statValues[a.id]?.[activeStatGroup]?.[def.key] ?? ""}
                                          onChange={(e) => setStatVal(a.id, activeStatGroup, def.key, e.target.value)}
                                          className="w-16 text-center h-8 px-1"
                                          placeholder="0"
                                        />
                                      </td>
                                    ))}
                                    {derivedDefs.map((d) => {
                                      const val = evalDerivedStat(d.formula, currentStats);
                                      return (
                                        <td key={d.key} className="px-2 py-2 text-center text-muted-foreground text-xs font-mono">
                                          {val !== null ? (d.precision === 3 ? formatBattingAvg(val) : val.toFixed(d.precision)) : "—"}
                                        </td>
                                      );
                                    })}
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}

                  <div className="flex justify-between pt-2">
                    <Button variant="outline" onClick={() => setStep(2)}>
                      <ChevronLeft className="h-4 w-4 mr-1" /> Back
                    </Button>
                    <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                      {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Event
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Season Stats Tab ───────────────────────────────────────────────── */}
        <TabsContent value="season">
          <div className="flex flex-wrap gap-3 mb-4 items-center justify-between">
            <div className="flex gap-3 flex-wrap">
              <div className="w-48">
                <Select value={seasonSportId} onValueChange={setSeasonSportId}>
                  <SelectTrigger>
                    <SelectValue placeholder="All sports…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">All sports</SelectItem>
                    {sportConfigs.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search athlete…"
                  value={seasonSearch}
                  onChange={(e) => setSeasonSearch(e.target.value)}
                  className="pl-9 w-52"
                />
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={downloadCSV} disabled={filteredSeasonRows.length === 0}>
              <Download className="h-4 w-4 mr-2" /> Download CSV
            </Button>
          </div>

          {seasonLoading && (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          )}

          {!seasonLoading && filteredSeasonRows.length === 0 && (
            <Card>
              <CardContent className="py-16 text-center">
                <BarChart2 className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No season stats yet</p>
                <p className="text-sm text-muted-foreground mt-1">Log competitive events to see season aggregates here.</p>
              </CardContent>
            </Card>
          )}

          {filteredSeasonRows.length > 0 && (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-secondary/30">
                    <th className="text-left px-3 py-2 font-medium">
                      <button onClick={() => toggleSort("name")} className="flex items-center gap-1">
                        Athlete
                        {sortCol === "name" ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                      </button>
                    </th>
                    {/* Defined stats from sport config */}
                    {seasonGroupEntries.flatMap(([, defs]) =>
                      (defs as GameStatDef[]).map((def) => (
                        <th key={def.key} className="px-2 py-2 text-center font-medium text-muted-foreground">
                          <button onClick={() => toggleSort(def.key)} className="flex items-center gap-1 mx-auto">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="cursor-help">{def.label}</span>
                              </TooltipTrigger>
                              <TooltipContent>{def.full}</TooltipContent>
                            </Tooltip>
                            {sortCol === def.key ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                          </button>
                        </th>
                      ))
                    )}
                    {/* Derived */}
                    {seasonDerived.map((d) => (
                      <th key={d.key} className="px-2 py-2 text-center font-medium text-muted-foreground opacity-60">
                        {d.label}
                      </th>
                    ))}
                    {/* Fallback: show all keys if no config */}
                    {seasonGroupEntries.length === 0 && allSeasonKeys.filter(k => k !== "present").map((k) => (
                      <th key={k} className="px-2 py-2 text-center font-medium text-muted-foreground capitalize">
                        <button onClick={() => toggleSort(k)} className="flex items-center gap-1 mx-auto">
                          {k}
                          {sortCol === k ? (sortDir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />) : null}
                        </button>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredSeasonRows.map((row) => (
                    <tr key={row.athlete_id} className="border-b last:border-b-0 hover:bg-secondary/20">
                      <td className="px-3 py-2 font-medium whitespace-nowrap">{row.name}</td>
                      {seasonGroupEntries.flatMap(([, defs]) =>
                        (defs as GameStatDef[]).map((def) => (
                          <td key={def.key} className="px-2 py-2 text-center">
                            {row.stats[def.key] ?? "—"}
                          </td>
                        ))
                      )}
                      {seasonDerived.map((d) => {
                        const val = evalDerivedStat(d.formula, row.stats);
                        return (
                          <td key={d.key} className="px-2 py-2 text-center text-muted-foreground font-mono text-xs">
                            {val !== null ? (d.precision === 3 ? formatBattingAvg(val) : val.toFixed(d.precision)) : "—"}
                          </td>
                        );
                      })}
                      {seasonGroupEntries.length === 0 && allSeasonKeys.filter(k => k !== "present").map((k) => (
                        <td key={k} className="px-2 py-2 text-center">{row.stats[k] ?? "—"}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Stats Viewer Dialog ──────────────────────────────────────────────── */}
      <Dialog open={!!viewStatsEvent} onOpenChange={(o) => { if (!o) { setViewStatsEvent(null); setInsightAthlete(null); } }}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          {viewStatsEvent && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Space_Grotesk'] flex items-center gap-2">
                  {EVENT_TYPE_CONFIG[viewStatsEvent.event_type].icon}
                  {EVENT_TYPE_CONFIG[viewStatsEvent.event_type].label}
                  {viewStatsEvent.opponent && ` vs. ${viewStatsEvent.opponent}`}
                  <span className="text-muted-foreground text-sm font-normal ml-1">
                    {format(new Date(viewStatsEvent.event_date + "T12:00:00"), "MMM d, yyyy")}
                  </span>
                </DialogTitle>
              </DialogHeader>

              <div className="flex flex-wrap gap-2 mb-2 mt-1">
                {viewStatsEvent.result && (
                  <Badge variant="outline" className={RESULT_COLORS[viewStatsEvent.result]}>
                    {viewStatsEvent.result}
                    {viewStatsEvent.score_us != null && viewStatsEvent.score_them != null &&
                      ` ${viewStatsEvent.score_us}–${viewStatsEvent.score_them}`}
                  </Badge>
                )}
                {viewStatsEvent.location && (
                  <span className="text-xs text-muted-foreground">{viewStatsEvent.location}</span>
                )}
              </div>

              {viewGroupEntries.length === 0 && viewStats.length === 0 && (
                <p className="text-sm text-muted-foreground py-4 text-center">No stats recorded for this event.</p>
              )}

              {/* Practice attendance */}
              {viewStatsEvent.event_type === "practice" && viewStats.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide text-[11px]">Attendance</p>
                  <div className="flex flex-wrap gap-2">
                    {viewAthleteIds.map((id) => {
                      const ap = viewAthleteProfiles.find((p) => p.user_id === id);
                      return (
                        <Badge key={id} variant="outline" className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">
                          {ap ? `${ap.first_name} ${ap.last_name}` : id}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Competitive stat table */}
              {viewStatsEvent.event_type !== "practice" && viewGroupEntries.length > 0 && (
                <>
                  {/* Group tabs */}
                  <div className="flex gap-2 flex-wrap mb-3">
                    {viewGroupEntries.map(([group]) => (
                      <button
                        key={group}
                        onClick={() => setActiveViewGroup(group)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium border capitalize transition-colors ${
                          effectiveViewGroup === group
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {group}
                      </button>
                    ))}
                  </div>

                  <div className="overflow-x-auto rounded-lg border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b bg-secondary/30">
                          <th className="text-left px-3 py-2 font-medium text-muted-foreground">Athlete</th>
                          {currentGroupDefs.map((def) => (
                            <th key={def.key} className="px-2 py-2 text-center font-medium text-muted-foreground">
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="cursor-help">{def.label}</span>
                                </TooltipTrigger>
                                <TooltipContent>{def.full}</TooltipContent>
                              </Tooltip>
                            </th>
                          ))}
                          {viewDerived.map((d) => (
                            <th key={d.key} className="px-2 py-2 text-center font-medium text-muted-foreground opacity-60">{d.label}</th>
                          ))}
                          <th className="px-2 py-2 text-right font-medium text-muted-foreground w-28">Insights</th>
                        </tr>
                      </thead>
                      <tbody>
                        {viewAthleteIds.map((athleteId) => {
                          const ap = viewAthleteProfiles.find((p) => p.user_id === athleteId);
                          const stats = athleteStatsMap[athleteId] ?? {};
                          return (
                            <tr key={athleteId} className="border-b last:border-b-0 hover:bg-secondary/20">
                              <td className="px-3 py-2 font-medium whitespace-nowrap">
                                {ap ? `${ap.first_name} ${ap.last_name}` : "—"}
                              </td>
                              {currentGroupDefs.map((def) => (
                                <td key={def.key} className="px-2 py-2 text-center">
                                  {stats[def.key] ?? "—"}
                                </td>
                              ))}
                              {viewDerived.map((d) => {
                                const val = evalDerivedStat(d.formula, stats);
                                return (
                                  <td key={d.key} className="px-2 py-2 text-center text-muted-foreground font-mono text-xs">
                                    {val !== null ? (d.precision === 3 ? formatBattingAvg(val) : val.toFixed(d.precision)) : "—"}
                                  </td>
                                );
                              })}
                              <td className="px-2 py-2 text-right">
                                {aiEnabled ? (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 text-xs gap-1"
                                    onClick={() => handleGenerateInsight(athleteId)}
                                    disabled={insightLoading && insightAthlete === athleteId}
                                  >
                                    {insightLoading && insightAthlete === athleteId
                                      ? <Loader2 className="h-3 w-3 animate-spin" />
                                      : <Sparkles className="h-3 w-3" />}
                                    AI
                                  </Button>
                                ) : (
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 opacity-40" disabled>
                                        <Lock className="h-3 w-3" /> AI
                                      </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>AI Insights require AI Premium</TooltipContent>
                                  </Tooltip>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* AI Insight display */}
                  {insightAthlete && insightData[insightAthlete] && (
                    <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 space-y-3 mt-2">
                      <p className="text-[11px] text-primary uppercase tracking-wide font-semibold flex items-center gap-1">
                        <Sparkles className="h-3 w-3" /> AI Development Insights
                      </p>
                      <p className="text-sm">{insightData[insightAthlete].summary}</p>
                      {insightData[insightAthlete].highlights?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Highlights</p>
                          <ul className="space-y-1">
                            {insightData[insightAthlete].highlights.map((h: string, i: number) => (
                              <li key={i} className="text-sm flex gap-2">
                                <span className="text-primary shrink-0 mt-0.5">•</span>
                                {h}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                      {insightData[insightAthlete].developmentNotes?.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground mb-1">Development Notes</p>
                          <ul className="space-y-1">
                            {insightData[insightAthlete].developmentNotes.map((n: string, i: number) => (
                              <li key={i} className="text-sm flex gap-2">
                                <span className="text-primary shrink-0 mt-0.5">→</span>
                                {n}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {viewStatsEvent.notes && (
                <div className="mt-3 p-3 rounded-lg bg-secondary/30 border">
                  <p className="text-xs text-muted-foreground font-medium mb-1">Notes</p>
                  <p className="text-sm">{viewStatsEvent.notes}</p>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
