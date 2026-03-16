import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, Clock, Users, Layers, SplitSquareHorizontal, ClipboardList, XCircle, RotateCcw, Eraser, Trophy } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSportConfigById, usePrimarySportId } from "@/hooks/useSportConfig";
import { useToast } from "@/hooks/use-toast";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday, addDays, parseISO, isBefore,
  startOfDay, startOfWeek, differenceInWeeks,
} from "date-fns";

// ── Constants ──────────────────────────────────────────────────────────────────

const COLORS = [
  { value: "default", label: "Default", class: "bg-primary/20 border-primary/40 text-primary" },
  { value: "blue",    label: "Blue",    class: "bg-blue-500/20 border-blue-500/40 text-blue-400" },
  { value: "green",   label: "Green",   class: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
  { value: "orange",  label: "Orange",  class: "bg-orange-500/20 border-orange-500/40 text-orange-400" },
  { value: "purple",  label: "Purple",  class: "bg-violet-500/20 border-violet-500/40 text-violet-400" },
];

const GENERIC_PRESETS = [
  { label: "Team Practice",    color: "default" },
  { label: "Skills Session",   color: "orange"  },
  { label: "Conditioning",     color: "green"   },
  { label: "Film Session",     color: "purple"  },
];

const DAYS_OF_WEEK = [
  { label: "Su", value: 0 },
  { label: "Mo", value: 1 },
  { label: "Tu", value: 2 },
  { label: "We", value: 3 },
  { label: "Th", value: 4 },
  { label: "Fr", value: 5 },
  { label: "Sa", value: 6 },
];

const getColorClass = (color: string) => COLORS.find((c) => c.value === color)?.class || COLORS[0].class;

// ── Time helpers ───────────────────────────────────────────────────────────────

const MINUTE_OPTIONS = ["00","05","10","15","20","25","30","35","40","45","50","55"];

/** Parse a HH:MM 24-hour string into 12-hour parts for the picker. */
const parseTimeParts = (t: string): { h: string; m: string; ampm: "AM" | "PM" } => {
  if (!t) return { h: "", m: "00", ampm: "AM" };
  const [hStr, mStr] = t.split(":");
  let h = parseInt(hStr || "0");
  const ampm: "AM" | "PM" = h >= 12 ? "PM" : "AM";
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  // Round minute to nearest 5
  const raw = parseInt(mStr || "0");
  const roundedM = String(Math.round(raw / 5) * 5).padStart(2, "0");
  const m = MINUTE_OPTIONS.includes(roundedM) ? roundedM : "00";
  return { h: String(h), m, ampm };
};

/** Build a HH:MM 24-hour string from 12-hour parts. */
const buildTime = (h: string, m: string, ampm: "AM" | "PM"): string => {
  if (!h) return "";
  let hour = parseInt(h);
  if (ampm === "AM" && hour === 12) hour = 0;
  if (ampm === "PM" && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${m}`;
};

// ── Types ──────────────────────────────────────────────────────────────────────

type ScheduleEntry = {
  id: string;
  coach_id: string;
  athlete_id: string;
  team_id: string | null;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  color: string | null;
  status: string;
  session_type: string;
  game_opponent: string | null;
  game_location: string | null;
  game_home_away: string | null;
};

type AthleteOption = {
  id: string;
  name: string;
  sport_position: string | null;
  sport_id: string | null;
};

type TeamOption = {
  id: string;
  name: string;
  season_start: string | null;
  season_end: string | null;
  memberIds: string[];
};

// ── Helpers ────────────────────────────────────────────────────────────────────

const isTeamInSeason = (t: TeamOption): boolean => {
  if (!t.season_start || !t.season_end) return false;
  const today = new Date().toISOString().split("T")[0];
  return today >= t.season_start && today <= t.season_end;
};

// ── Component ──────────────────────────────────────────────────────────────────

const CoachSchedule = () => {
  const { user, profile } = useAuth();
  const isTeamCoach = profile?.coach_type === "team";
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Undo last schedule action
  const [undoIds, setUndoIds] = useState<string[]>([]);
  const [showUndo, setShowUndo] = useState(false);
  const undoTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Core form state
  const [formMode, setFormMode]         = useState<"individual" | "team">("individual");
  const [formTeamId, setFormTeamId]     = useState("");
  const [formAthleteIds, setFormAthleteIds] = useState<string[]>([]);
  const [formTitle, setFormTitle]       = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime]   = useState("");
  const [formNotes, setFormNotes]       = useState("");
  const [formColor, setFormColor]       = useState("default");
  const [formDate, setFormDate]         = useState("");

  // Game fields
  const [formIsGame, setFormIsGame]               = useState(false);
  const [formGameOpponent, setFormGameOpponent]   = useState("");
  const [formGameLocation, setFormGameLocation]   = useState("");
  const [formGameHomeAway, setFormGameHomeAway]   = useState<"home" | "away" | "neutral">("home");

  // Recurrence: day-of-week + weeks
  const [formDays, setFormDays]     = useState<number[]>([]);
  const [formWeeks, setFormWeeks]   = useState(1);

  // Delete confirmation (two-step to prevent accidents)
  const [deleteConfirm, setDeleteConfirm] = useState(false);

  // Mass clear dialog
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [clearRange, setClearRange] = useState<"month" | "future" | "all">("month");
  const [clearTeamId, setClearTeamId] = useState<string>("__all__");

  // Quick schedule team selection (sidebar)
  const [quickScheduleTeamId, setQuickScheduleTeamId] = useState<string>("");

  // Edit mode: pending team reassignment (requires explicit confirmation)
  const [pendingReassignTeamId, setPendingReassignTeamId] = useState<string>("");

  // Calendar team filter — null = all teams
  const [calendarTeamFilter, setCalendarTeamFilter] = useState<string | null>(null);

  // Position split (Group B)
  const [formSplitEnabled, setFormSplitEnabled] = useState(false);
  const [formGroupBAthleteIds, setFormGroupBAthleteIds] = useState<string[]>([]);
  const [formGroupBTitle, setFormGroupBTitle] = useState("");

  // ── Data fetching ────────────────────────────────────────────────────────────

  const { data: athletes = [] } = useQuery<AthleteOption[]>({
    queryKey: ["coach-athletes-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id, sport_id")
        .eq("coach_user_id", user.id);
      if (!links?.length) return [];
      const { data: profiles } = await (supabase as any)
        .from("profiles")
        .select("user_id, first_name, last_name, sport_position")
        .in("user_id", links.map((l) => l.athlete_user_id));
      return (profiles || []).map((p: any) => {
        const link = links.find((l) => l.athlete_user_id === p.user_id);
        return {
          id: p.user_id,
          name: `${p.first_name} ${p.last_name}`.trim() || "Unknown",
          sport_position: p.sport_position ?? null,
          sport_id: link?.sport_id ?? null,
        };
      });
    },
    enabled: !!user,
  });

  const { data: teams = [] } = useQuery<TeamOption[]>({
    queryKey: ["coach-teams-schedule", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: teamsData } = await (supabase as any)
        .from("teams")
        .select("id, name, season_start, season_end")
        .eq("coach_id", user.id);
      if (!teamsData?.length) return [];
      const teamIds = teamsData.map((t: any) => t.id);
      const { data: members } = await (supabase as any)
        .from("team_members")
        .select("team_id, athlete_user_id")
        .in("team_id", teamIds);
      return teamsData.map((t: any) => ({
        id: t.id,
        name: t.name,
        season_start: t.season_start,
        season_end: t.season_end,
        memberIds: (members || [])
          .filter((m: any) => m.team_id === t.id)
          .map((m: any) => m.athlete_user_id),
      }));
    },
    enabled: !!user,
  });

  const monthStart = startOfMonth(currentMonth);
  const monthEnd   = endOfMonth(currentMonth);

  const { data: schedule = [], isLoading } = useQuery({
    queryKey: ["coach-schedule", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coach_schedule")
        .select("*")
        .eq("coach_id", user.id)
        .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduleEntry[];
    },
    enabled: !!user,
  });

  // Practice dates for the visible month (violet dot indicators on calendar cells)
  const { data: practiceDates = [] } = useQuery<string[]>({
    queryKey: ["practice-dates-schedule", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("team_practices")
        .select("practice_date")
        .eq("coach_id", user.id)
        .gte("practice_date", format(monthStart, "yyyy-MM-dd"))
        .lte("practice_date", format(monthEnd, "yyyy-MM-dd"));
      return (data || []).map((r: any) => r.practice_date as string);
    },
    enabled: !!user,
  });
  const practiceDatesSet = useMemo(() => new Set(practiceDates), [practiceDates]);

  // Practice plan for the currently selected dialog date (preview inside dialog)
  const { data: formDatePlan } = useQuery<{
    id: string; title: string; duration_min: number | null;
    blocks: Array<{ id: string; title: string; block_type: string; duration_min: number | null }>;
  } | null>({
    queryKey: ["practice-plan-dialog", user?.id, formDate],
    queryFn: async () => {
      if (!user || !formDate) return null;
      const { data: practice } = await (supabase as any)
        .from("team_practices")
        .select("id, title, duration_min")
        .eq("coach_id", user.id)
        .eq("practice_date", formDate)
        .maybeSingle();
      if (!practice) return null;
      const { data: blocks } = await (supabase as any)
        .from("practice_blocks")
        .select("id, title, block_type, duration_min, order_index")
        .eq("practice_id", practice.id)
        .order("order_index", { ascending: true });
      return { ...practice, blocks: blocks || [] };
    },
    enabled: !!user && !!formDate && showForm,
  });

  // ── Derived data ─────────────────────────────────────────────────────────────

  const today = startOfDay(new Date());

  const getAthleteName = (id: string) => athletes.find((a) => a.id === id)?.name || "Unknown";
  const getTeamForAthlete = (athleteId: string) => teams.find((t) => t.memberIds.includes(athleteId)) ?? null;
  const entryTeamKey = (e: ScheduleEntry): string =>
    e.team_id ?? getTeamForAthlete(e.athlete_id)?.id ?? `solo_${e.athlete_id}`;

  const upcomingSessions = useMemo(() => {
    const cutoff = addDays(today, 14);
    const filtered = schedule.filter((e) => {
      const d = parseISO(e.scheduled_date);
      if (!(!isBefore(d, today) && isBefore(d, cutoff))) return false;
      if (calendarTeamFilter && entryTeamKey(e) !== calendarTeamFilter) return false;
      return true;
    });
    // Deduplicate team sessions — keep one representative per (team + session) group
    const seen = new Set<string>();
    return filtered.filter((e) => {
      const key = `${e.scheduled_date}|${e.title}|${e.start_time}|${e.color}|${e.status}|${entryTeamKey(e)}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 10);
  }, [schedule, today]);

  // Raw map (used for cancel/restore logic that needs per-athlete rows)
  const scheduleByDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    schedule.forEach((entry) => {
      if (!map[entry.scheduled_date]) map[entry.scheduled_date] = [];
      map[entry.scheduled_date].push(entry);
    });
    return map;
  }, [schedule]);

  // Deduplicated: same (team_id + title + start_time + color + status) on same date → one chip
  const scheduleByDateDeduped = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    schedule.forEach((entry) => {
      if (!map[entry.scheduled_date]) map[entry.scheduled_date] = [];
      const key = `${entry.title}|${entry.start_time}|${entry.color}|${entry.status}|${entryTeamKey(entry)}`;
      if (!map[entry.scheduled_date].some(
        (e) => `${e.title}|${e.start_time}|${e.color}|${e.status}|${entryTeamKey(e)}` === key
      )) {
        map[entry.scheduled_date].push(entry);
      }
    });
    return map;
  }, [schedule]);

  // Calendar-visible schedule — filtered by calendarTeamFilter when set
  const calendarSchedule = useMemo(() => {
    if (!calendarTeamFilter) return scheduleByDateDeduped;
    const out: Record<string, ScheduleEntry[]> = {};
    for (const [date, entries] of Object.entries(scheduleByDateDeduped)) {
      const f = entries.filter((e) => entryTeamKey(e) === calendarTeamFilter);
      if (f.length) out[date] = f;
    }
    return out;
  }, [scheduleByDateDeduped, calendarTeamFilter]);

  // How many athletes share each (team_id + date + title + start_time + color + status) group
  const teamGroupCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    schedule.forEach((entry) => {
      const key = `${entry.scheduled_date}|${entry.title}|${entry.start_time}|${entry.color}|${entry.status}|${entryTeamKey(entry)}`;
      counts[key] = (counts[key] || 0) + 1;
    });
    return counts;
  }, [schedule]);

  const days          = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const inSeasonTeams = teams.filter(isTeamInSeason);
  const selectedTeam  = teams.find((t) => t.id === formTeamId) ?? null;

  const primarySportId = usePrimarySportId(athletes.map((a) => a.sport_id));
  const { data: sportConfig } = useSportConfigById(primarySportId);
  const activePresets = useMemo(() => {
    const presets = sportConfig?.schedule_presets;
    if (!presets) return GENERIC_PRESETS;
    const useInSeason = (selectedTeam && isTeamInSeason(selectedTeam)) || inSeasonTeams.length > 0;
    return useInSeason ? presets.inSeason : presets.offSeason;
  }, [sportConfig, selectedTeam, inSeasonTeams]);

  /** Return all row IDs that belong to the same session group as `entry`. */
  const getGroupIds = (entry: ScheduleEntry): string[] => {
    const key = `${entry.title}|${entry.start_time}|${entry.color}|${entry.status}|${entryTeamKey(entry)}`;
    return (scheduleByDate[entry.scheduled_date] || [])
      .filter((e) => `${e.title}|${e.start_time}|${e.color}|${e.status}|${entryTeamKey(e)}` === key)
      .map((e) => e.id);
  };

  // Unique positions among currently selected athletes (for split labels)
  const positionsInRoster = useMemo(() => {
    const positions = athletes.map((a) => a.sport_position).filter(Boolean) as string[];
    return [...new Set(positions)].sort();
  }, [athletes]);

  // ── Auto-fill athletes when team changes ─────────────────────────────────────

  // Only auto-fill athletes on team change during CREATE mode.
  // In edit mode the athletes come from the existing session group; team changes
  // are handled inline via onValueChange to avoid overwriting the loaded group.
  useEffect(() => {
    if (editEntry || !formTeamId) return;
    const team = teams.find((t) => t.id === formTeamId);
    if (team) {
      setFormAthleteIds(team.memberIds);
    }
  }, [formTeamId, teams, athletes, editEntry]);

  // Default quick-schedule team only when there is exactly ONE in-season team.
  // With multiple teams the coach must pick explicitly to avoid wrong-team assignment.
  useEffect(() => {
    if (quickScheduleTeamId || inSeasonTeams.length !== 1) return;
    setQuickScheduleTeamId(inSeasonTeams[0].id);
  }, [inSeasonTeams, quickScheduleTeamId]);

  // ── Form helpers ─────────────────────────────────────────────────────────────

  const resetForm = () => {
    setFormMode(isTeamCoach ? "team" : "individual");
    setFormTeamId("");
    setFormAthleteIds([]);
    setFormTitle("");
    setFormStartTime("");
    setFormEndTime("");
    setFormNotes("");
    setFormColor("default");
    setFormDate("");
    setFormIsGame(false);
    setFormGameOpponent("");
    setFormGameLocation("");
    setFormGameHomeAway("home");
    setFormDays([]);
    setFormWeeks(1);
    setFormSplitEnabled(false);
    setFormGroupBAthleteIds([]);
    setFormGroupBTitle("");
    setEditEntry(null);
    setDeleteConfirm(false);
    setPendingReassignTeamId("");
  };

  // Auto-open form when navigated from Drills page (?date=&title=)
  useEffect(() => {
    const dateParam = searchParams.get("date");
    const titleParam = searchParams.get("title");
    if (dateParam) {
      resetForm();
      setFormDate(dateParam);
      if (titleParam) setFormTitle(titleParam);
      setShowForm(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only — reads params once on navigation

  const openNewEntry = (date: Date) => {
    resetForm();
    setFormDate(format(date, "yyyy-MM-dd"));
    setShowForm(true);
  };

  const openEditEntry = (entry: ScheduleEntry) => {
    resetForm();
    setEditEntry(entry);
    // Find all athletes in the same group — team_id is part of the key so
    // sessions for different teams with the same title/time never merge.
    const groupKey = `${entry.title}|${entry.start_time}|${entry.color}|${entry.status}|${entryTeamKey(entry)}`;
    const groupEntries = (scheduleByDate[entry.scheduled_date] || []).filter(
      (e) => `${e.title}|${e.start_time}|${e.color}|${e.status}|${entryTeamKey(e)}` === groupKey
    );
    setFormAthleteIds(groupEntries.map((e) => e.athlete_id));
    // Use the stored team_id directly (not derived from athlete membership)
    if (entry.team_id) setFormTeamId(entry.team_id);
    setFormTitle(entry.title);
    setFormStartTime(entry.start_time?.slice(0, 5) || "");
    setFormEndTime(entry.end_time?.slice(0, 5) || "");
    setFormNotes(entry.notes || "");
    setFormColor(entry.color || "default");
    setFormDate(entry.scheduled_date);
    setFormIsGame(entry.session_type === "game");
    setFormGameOpponent(entry.game_opponent || "");
    setFormGameLocation(entry.game_location || "");
    setFormGameHomeAway((entry.game_home_away as "home" | "away" | "neutral") || "home");
    setShowForm(true);
  };

  const toggleAthlete = (id: string, group: "A" | "B") => {
    if (group === "A") {
      setFormAthleteIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    } else {
      setFormGroupBAthleteIds((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
    }
  };

  const toggleDay = (d: number) => {
    setFormDays((prev) => prev.includes(d) ? prev.filter((x) => x !== d) : [...prev, d]);
  };

  const quickSelectPositionGroup = (position: string) => {
    const ids = athletes.filter((a) => a.sport_position === position).map((a) => a.id);
    setFormAthleteIds(ids);
  };

  const selectAllAthletes = () => {
    if (formAthleteIds.length === athletes.length) {
      setFormAthleteIds([]);
    } else {
      setFormAthleteIds(athletes.map((a) => a.id));
    }
  };

  // ── Build date list from recurrence settings ─────────────────────────────────

  const buildDates = (baseDate: string): string[] => {
    if (formDays.length === 0) return [baseDate];
    const weekStart = startOfWeek(parseISO(baseDate), { weekStartsOn: 0 });
    const dates: string[] = [];
    for (let w = 0; w < formWeeks; w++) {
      for (const dayNum of formDays) {
        const dStr = format(addDays(weekStart, w * 7 + dayNum), "yyyy-MM-dd");
        if (dStr >= baseDate) dates.push(dStr);
      }
    }
    return [...new Set(dates)].sort();
  };

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const saveMut = useMutation({
    mutationFn: async (vars: { isEdit: boolean }) => {
      if (!user || !formDate) return;
      const dates = buildDates(formDate);

      if (vars.isEdit && editEntry) {
        // Resolve the full group — team_id is part of the key so edits
        // are scoped to one team and never touch another team's rows.
        const origKey = `${editEntry.title}|${editEntry.start_time}|${editEntry.color}|${editEntry.status}|${entryTeamKey(editEntry)}`;
        const groupEntries = (scheduleByDate[editEntry.scheduled_date] || []).filter(
          (e) => `${e.title}|${e.start_time}|${e.color}|${e.status}|${entryTeamKey(e)}` === origKey
        );
        const currentAthleteIds = groupEntries.map((e) => e.athlete_id);
        const updates = {
          title: formTitle,
          scheduled_date: formDate,
          start_time: formStartTime || null,
          end_time: formEndTime || null,
          notes: formNotes || null,
          color: formColor,
          team_id: formTeamId || null,
          session_type: formIsGame ? "game" : "regular",
          game_opponent: formIsGame ? formGameOpponent || null : null,
          game_location: formIsGame ? formGameLocation || null : null,
          game_home_away: formIsGame ? formGameHomeAway : null,
        };
        // 1. Update all existing entries in the group
        if (groupEntries.length > 0) {
          const { error } = await supabase.from("coach_schedule")
            .update(updates).in("id", groupEntries.map((e) => e.id));
          if (error) throw error;
        }
        // 2. Insert rows for newly added athletes
        const toAdd = formAthleteIds.filter((id) => !currentAthleteIds.includes(id));
        if (toAdd.length > 0) {
          const { error } = await supabase.from("coach_schedule").insert(
            toAdd.map((athleteId) => ({ coach_id: user.id, athlete_id: athleteId, ...updates }))
          );
          if (error) throw error;
        }
        // 3. Delete rows for removed athletes
        const toRemove = groupEntries.filter((e) => !formAthleteIds.includes(e.athlete_id)).map((e) => e.id);
        if (toRemove.length > 0) {
          const { error } = await supabase.from("coach_schedule").delete().in("id", toRemove);
          if (error) throw error;
        }
        return;
      }

      // For team coaches, auto-fill athletes from selected team if not already set
      const effectiveAthleteIds = (isTeamCoach && formAthleteIds.length === 0 && formTeamId)
        ? (teams.find((t) => t.id === formTeamId)?.memberIds ?? [])
        : formAthleteIds;
      if (effectiveAthleteIds !== formAthleteIds) setFormAthleteIds(effectiveAthleteIds);

      if (effectiveAthleteIds.length === 0 && formGroupBAthleteIds.length === 0) {
        throw new Error("No athletes selected. Add athletes to the team or select them individually.");
      }

      const rows: object[] = [];

      // Group A
      if (effectiveAthleteIds.length > 0) {
        dates.forEach((date) => {
          effectiveAthleteIds.forEach((athleteId) => {
            rows.push({
              coach_id: user.id,
              athlete_id: athleteId,
              team_id: formTeamId || null,
              title: formTitle || "Practice",
              scheduled_date: date,
              start_time: formStartTime || null,
              end_time: formEndTime || null,
              notes: formNotes || null,
              color: formColor,
              session_type: formIsGame ? "game" : "regular",
              game_opponent: formIsGame ? formGameOpponent || null : null,
              game_location: formIsGame ? formGameLocation || null : null,
              game_home_away: formIsGame ? formGameHomeAway : null,
            });
          });
        });
      }

      // Group B (split practice)
      if (formSplitEnabled && formGroupBAthleteIds.length > 0) {
        dates.forEach((date) => {
          formGroupBAthleteIds.forEach((athleteId) => {
            rows.push({
              coach_id: user.id,
              athlete_id: athleteId,
              team_id: formTeamId || null,
              title: formGroupBTitle || "Practice",
              scheduled_date: date,
              start_time: formStartTime || null,
              end_time: formEndTime || null,
              notes: formNotes || null,
              color: formColor,
              session_type: "regular",
              game_opponent: null,
              game_location: null,
              game_home_away: null,
            });
          });
        });
      }

      if (rows.length > 0) {
        const { data: inserted, error } = await supabase.from("coach_schedule").insert(rows).select("id");
        if (error) throw error;
        return (inserted ?? []).map((r: { id: string }) => r.id);
      }
      return [] as string[];
    },
    onSuccess: (insertedIds, vars) => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      if (vars.isEdit) {
        toast({ title: "Session updated." });
      } else {
        const totalAthletes = formAthleteIds.length + (formSplitEnabled ? formGroupBAthleteIds.length : 0);
        const dates = buildDates(formDate);
        const count = dates.length * Math.max(totalAthletes, 1);
        const teamName = teams.find((t) => t.id === formTeamId)?.name;
        const label = teamName ? ` for ${teamName}` : "";
        toast({ title: count > 1 ? `${count} sessions scheduled${label}!` : `Session scheduled${label}!` });
        if (insertedIds?.length) {
          setUndoIds(insertedIds);
          setShowUndo(true);
          if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
          undoTimerRef.current = setTimeout(() => setShowUndo(false), 10000);
        }
      }
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const undoMut = useMutation({
    mutationFn: async () => {
      if (!undoIds.length) return;
      const { error } = await supabase.from("coach_schedule").delete().in("id", undoIds);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowUndo(false);
      setUndoIds([]);
      if (undoTimerRef.current) clearTimeout(undoTimerRef.current);
      toast({ title: "Undone." });
    },
    onError: (e: Error) => toast({ title: "Undo failed", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("coach_schedule").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("coach_schedule").update({ status: "canceled" }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Practice canceled", description: "Athletes will see it as canceled." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const restoreMut = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("coach_schedule").update({ status: "active" }).in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowForm(false);
      resetForm();
      toast({ title: "Practice restored!" });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const clearMut = useMutation({
    mutationFn: async ({ range, teamId }: { range: "month" | "future" | "all"; teamId: string }) => {
      if (!user) return;
      let query = supabase.from("coach_schedule").delete().eq("coach_id", user.id);
      if (range === "month") {
        query = query
          .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
          .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"));
      } else if (range === "future") {
        query = query.gte("scheduled_date", format(today, "yyyy-MM-dd"));
      }
      if (teamId !== "__all__") {
        const memberIds = teams.find((t) => t.id === teamId)?.memberIds ?? [];
        if (memberIds.length > 0) {
          query = query.in("athlete_id", memberIds);
        }
      }
      const { error } = await query;
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowClearDialog(false);
      toast({ title: "Sessions cleared." });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const [dragEntry, setDragEntry] = useState<ScheduleEntry | null>(null);
  const moveMut = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const { error } = await supabase.from("coach_schedule").update({ scheduled_date: newDate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-schedule"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const isThisMonth = format(currentMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="coach">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Schedule</h1>
          <p className="text-muted-foreground mt-1">Click any day to add a session. Drag to reschedule.</p>
        </div>
        <div className="flex items-center gap-2">
          {showUndo && (
            <Button
              variant="outline"
              size="sm"
              className="text-amber-400 border-amber-500/40 hover:bg-amber-500/10"
              onClick={() => undoMut.mutate()}
              disabled={undoMut.isPending}
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1.5" /> Undo
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            className="text-muted-foreground hover:text-destructive hover:border-destructive/50"
            onClick={() => { setClearRange("month"); setShowClearDialog(true); }}
          >
            <Eraser className="h-4 w-4 mr-1.5" /> Clear
          </Button>
          <Button onClick={() => { resetForm(); setFormDate(format(new Date(), "yyyy-MM-dd")); setShowForm(true); }}>
            <Plus className="h-4 w-4 mr-2" /> Schedule Session
          </Button>
        </div>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-4">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-semibold font-['Space_Grotesk']">{format(currentMonth, "MMMM yyyy")}</h2>
          {!isThisMonth && (
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setCurrentMonth(new Date())}>
              Today
            </Button>
          )}
        </div>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        {/* Calendar grid */}
        <Card>
          <CardContent className="p-2 sm:p-5">
            {isLoading ? (
              <div className="flex justify-center py-16">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-7 mb-1">
                  {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                    <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                  ))}
                </div>
                <div className="grid grid-cols-7 auto-rows-[minmax(110px,1fr)] border-t border-l">
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-r border-b bg-secondary/20" />
                  ))}
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const entries = calendarSchedule[dateKey] || [];
                    const todayDay = isToday(day);
                    return (
                      <div
                        key={dateKey}
                        className={`border-r border-b p-1 relative group cursor-pointer transition-colors hover:bg-secondary/30 ${todayDay ? "bg-primary/5" : ""}`}
                        onClick={() => openNewEntry(day)}
                        onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
                        onDragLeave={(e) => e.currentTarget.classList.remove("bg-primary/10")}
                        onDrop={(e) => {
                          e.preventDefault();
                          e.currentTarget.classList.remove("bg-primary/10");
                          if (dragEntry) { moveMut.mutate({ id: dragEntry.id, newDate: dateKey }); setDragEntry(null); }
                        }}
                      >
                        <span className={`text-xs font-medium ${todayDay ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-1 space-y-0.5 overflow-hidden">
                          {entries.slice(0, 3).map((entry) => (
                            <div
                              key={entry.id}
                              draggable={entry.status !== "canceled"}
                              onDragStart={(e) => { e.stopPropagation(); if (entry.status !== "canceled") setDragEntry(entry); }}
                              onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}
                              className={`text-[10px] sm:text-xs truncate rounded px-1 py-0.5 border cursor-pointer ${
                                entry.status === "canceled"
                                  ? "bg-secondary/30 border-border text-muted-foreground opacity-60 line-through"
                                  : entry.session_type === "game"
                                    ? "cursor-grab active:cursor-grabbing bg-amber-500/20 border-amber-500/40 text-amber-300 font-semibold"
                                    : `cursor-grab active:cursor-grabbing ${getColorClass(entry.color || "default")}`
                              }`}
                              title={`${entry.status === "canceled" ? "CANCELED: " : ""}${
                                entry.session_type === "game"
                                  ? `${entry.game_home_away === "away" ? "✈️" : "🏠"} ${entry.game_opponent ? `vs. ${entry.game_opponent}` : entry.title}${entry.game_location ? ` · ${entry.game_location}` : ""}`
                                  : entry.title || getTeamForAthlete(entry.athlete_id)?.name || "Practice"
                              } ${entry.start_time ? `at ${entry.start_time.slice(0, 5)}` : ""}`}
                            >
                              {entry.status === "canceled"
                                ? <span className="not-italic">✕ </span>
                                : entry.start_time && <span className="font-medium">{entry.start_time.slice(0, 5)} </span>
                              }
                              {entry.session_type === "game"
                                ? <>
                                    <span className="mr-0.5">{entry.game_home_away === "away" ? "✈️" : "🏠"}</span>
                                    {entry.game_opponent ? `vs. ${entry.game_opponent}` : entry.title}
                                  </>
                                : entry.title || getTeamForAthlete(entry.athlete_id)?.name || "Practice"
                              }
                            </div>
                          ))}
                          {entries.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">+{entries.length - 3} more</div>
                          )}
                        </div>
                        {practiceDatesSet.has(dateKey) && (
                          <div className="absolute bottom-1 left-1 w-2 h-2 rounded-full bg-violet-400 pointer-events-none" title="Practice plan exists" />
                        )}
                        <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Plus className="h-3.5 w-3.5 text-muted-foreground" />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Team view filter — only shown when coach has multiple teams */}
          {teams.length > 1 && (
            <Card>
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5" /> View Schedule
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                <button
                  onClick={() => setCalendarTeamFilter(null)}
                  className={`w-full text-left text-xs rounded-lg border px-3 py-2 transition-colors ${
                    calendarTeamFilter === null
                      ? "border-primary bg-primary/10 text-primary font-medium"
                      : "border-border hover:bg-secondary/50 text-muted-foreground"
                  }`}
                >
                  All Teams
                </button>
                {teams.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => setCalendarTeamFilter(calendarTeamFilter === t.id ? null : t.id)}
                    className={`w-full text-left text-xs rounded-lg border px-3 py-2 transition-colors ${
                      calendarTeamFilter === t.id
                        ? "border-primary bg-primary/10 text-primary font-medium"
                        : "border-border hover:bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    {t.name}
                    {isTeamInSeason(t) && (
                      <span className="ml-1.5 text-emerald-400 text-[10px]">● In Season</span>
                    )}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* In-season teams banner */}
          {inSeasonTeams.length > 0 && (
            <Card className="border-emerald-500/30 bg-emerald-500/5">
              <CardHeader className="pb-2 pt-3 px-4">
                <CardTitle className="text-xs font-semibold text-emerald-400 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" /> In Season
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-3 space-y-1">
                {inSeasonTeams.map((t) => (
                  <button
                    key={t.id}
                    className="w-full text-left text-xs font-medium hover:text-primary transition-colors truncate"
                    onClick={() => {
                      resetForm();
                      setFormMode("team");
                      setFormTeamId(t.id);
                      setFormDate(format(new Date(), "yyyy-MM-dd"));
                      setShowForm(true);
                    }}
                  >
                    {t.name}
                  </button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Upcoming */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-['Space_Grotesk'] flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Upcoming (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {upcomingSessions.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No upcoming sessions.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingSessions.map((entry) => (
                    <button
                      key={entry.id}
                      onClick={() => openEditEntry(entry)}
                      className="w-full text-left rounded-lg border p-2.5 hover:bg-secondary/50 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {entry.session_type === "game"
                          ? <span className="text-sm leading-none shrink-0">{entry.game_home_away === "away" ? "✈️" : "🏠"}</span>
                          : <span className={`w-2 h-2 rounded-full shrink-0 ${getColorClass(entry.color || "default").split(" ")[0]}`} />
                        }
                        <p className={`text-xs font-medium truncate ${entry.session_type === "game" ? "text-amber-300" : ""}`}>
                          {entry.session_type === "game"
                            ? (entry.game_opponent ? `vs. ${entry.game_opponent}` : entry.title)
                            : entry.title || getTeamForAthlete(entry.athlete_id)?.name || "Practice"
                          }
                        </p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 pl-5">
                        {format(parseISO(entry.scheduled_date), "EEE, MMM d")}
                        {entry.start_time && ` · ${entry.start_time.slice(0, 5)}`}
                      </p>
                      <p className="text-[10px] text-muted-foreground pl-4">
                        {entry.session_type === "game"
                          ? entry.game_location ?? ""
                          : getTeamForAthlete(entry.athlete_id)?.name ?? ""
                        }
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick schedule presets (season-aware) */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-['Space_Grotesk']">
                {inSeasonTeams.length > 0 ? "In-Season Quick Schedule" : "Quick Schedule"}
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-2">
              {/* Team selector — shown when multiple teams exist */}
              {teams.length > 1 && (
                <div className="flex flex-wrap gap-1.5 pb-1 border-b border-border">
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setQuickScheduleTeamId(t.id)}
                      className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                        quickScheduleTeamId === t.id
                          ? "border-primary bg-primary/10 text-primary font-medium"
                          : "border-border hover:bg-secondary text-muted-foreground"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              )}
              <div className="space-y-1.5">
                {activePresets.map((p) => (
                  <Button
                    key={p.label}
                    variant="outline"
                    size="sm"
                    className="w-full justify-start text-xs h-8"
                    onClick={() => {
                      resetForm();
                      setFormTitle(p.label);
                      setFormColor(p.color);
                      setFormDate(format(new Date(), "yyyy-MM-dd"));
                      if (quickScheduleTeamId) {
                        setFormMode("team");
                        setFormTeamId(quickScheduleTeamId);
                      } else if (inSeasonTeams.length > 0) {
                        setFormMode("team");
                      }
                      setShowForm(true);
                    }}
                  >
                    <span className={`w-2 h-2 rounded-full mr-2 shrink-0 ${getColorClass(p.color).split(" ")[0]}`} />
                    {p.label}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ── Entry form dialog ── */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">
              {editEntry ? "Edit Session" : "Schedule Practice"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* ── Team / mode selector — always at the very top ── */}
            {(teams.length > 0) && (
              <div className={`rounded-lg border p-3 space-y-2 ${
                !editEntry && (formMode === "team" || isTeamCoach) && !formTeamId
                  ? "border-amber-500/40 bg-amber-500/5"
                  : "border-primary/20 bg-primary/5"
              }`}>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary shrink-0" />
                  <span className="text-sm font-semibold">
                    {editEntry ? "Team" : "Scheduling for"}
                  </span>
                </div>

                {/* Create mode only: Individual vs Team toggle */}
                {!editEntry && !isTeamCoach && (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => { setFormMode("individual"); setFormTeamId(""); }}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors ${
                        formMode === "individual" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                      }`}
                    >
                      Individual athletes
                    </button>
                    <button
                      onClick={() => setFormMode("team")}
                      className={`rounded-lg border px-3 py-2 text-sm transition-colors flex items-center justify-center gap-1.5 ${
                        formMode === "team" ? "border-primary bg-primary/10 text-primary" : "border-border hover:bg-secondary"
                      }`}
                    >
                      <Users className="h-3.5 w-3.5" /> Team
                    </button>
                  </div>
                )}

                {/* Team dropdown — create mode */}
                {!editEntry && (formMode === "team" || isTeamCoach) && (
                  <Select value={formTeamId} onValueChange={setFormTeamId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a team" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{isTeamInSeason(t) && " (In Season)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* Team dropdown — edit mode */}
                {editEntry && (
                  <Select
                    value={pendingReassignTeamId || formTeamId}
                    onValueChange={(newId) => {
                      if (newId !== formTeamId) {
                        setPendingReassignTeamId(newId);
                      } else {
                        setPendingReassignTeamId("");
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="No team assigned" />
                    </SelectTrigger>
                    <SelectContent>
                      {teams.map((t) => (
                        <SelectItem key={t.id} value={t.id}>
                          {t.name}{isTeamInSeason(t) && " (In Season)"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}

                {/* In-season indicator */}
                {selectedTeam && isTeamInSeason(selectedTeam) && !pendingReassignTeamId && (
                  <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
                    This team is currently in season
                  </div>
                )}

                {/* Confirmation banner for edit-mode team change */}
                {editEntry && pendingReassignTeamId && (
                  <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2.5 space-y-2">
                    <p className="text-xs font-medium text-amber-400">
                      Reassign to {teams.find((t) => t.id === pendingReassignTeamId)?.name}?
                    </p>
                    <p className="text-xs text-muted-foreground">
                      The current team's athletes will be replaced with{" "}
                      {teams.find((t) => t.id === pendingReassignTeamId)?.name}'s full roster.
                    </p>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => {
                          const newTeam = teams.find((t) => t.id === pendingReassignTeamId);
                          setFormTeamId(pendingReassignTeamId);
                          if (newTeam) setFormAthleteIds(newTeam.memberIds);
                          setPendingReassignTeamId("");
                        }}
                      >
                        Confirm reassignment
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-7 text-xs"
                        onClick={() => setPendingReassignTeamId("")}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Practice plan preview — shown when a practice plan exists for the selected date */}
            {formDatePlan && (
              <div className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ClipboardList className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                    <span className="text-sm font-medium text-violet-400 truncate">{formDatePlan.title}</span>
                    {formDatePlan.duration_min && (
                      <span className="text-xs text-muted-foreground shrink-0">· {formDatePlan.duration_min} min</span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs text-violet-400 hover:text-violet-300 px-2 shrink-0"
                    type="button"
                    onClick={() => { setShowForm(false); resetForm(); navigate(`/coach/drills?date=${formDate}`); }}
                  >
                    View/Edit →
                  </Button>
                </div>
                {formDatePlan.blocks.length > 0 ? (
                  <div className="space-y-1">
                    {formDatePlan.blocks.slice(0, 4).map((b) => (
                      <div key={b.id} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="w-1.5 h-1.5 rounded-full bg-violet-400/50 shrink-0" />
                        <span className="flex-1 truncate">{b.title}</span>
                        {b.duration_min && <span className="shrink-0">{b.duration_min}min</span>}
                      </div>
                    ))}
                    {formDatePlan.blocks.length > 4 && (
                      <p className="text-xs text-muted-foreground pl-3.5">+{formDatePlan.blocks.length - 4} more</p>
                    )}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No blocks added yet.</p>
                )}
              </div>
            )}

            {/* Presets (new sessions only) */}
            {!editEntry && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">Quick fill</Label>
                <div className="flex flex-wrap gap-1.5">
                  {activePresets.map((p) => (
                    <button
                      key={p.label}
                      onClick={() => { setFormTitle(p.label); setFormColor(p.color); }}
                      className={`text-xs rounded-full px-2.5 py-1 border transition-all ${
                        formTitle === p.label
                          ? getColorClass(p.color) + " ring-1 ring-offset-1 ring-offset-background ring-primary"
                          : "border-border hover:bg-secondary"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Session title */}
            <div className="space-y-2">
              <Label>Session Title {formSplitEnabled && <span className="text-muted-foreground font-normal">(Group A)</span>}</Label>
              <Input placeholder="e.g. Batting Practice" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>

            {/* Game Day toggle */}
            <div className={`rounded-lg border p-3 transition-colors ${formIsGame ? "border-amber-500/40 bg-amber-500/5" : ""}`}>
              <button
                type="button"
                onClick={() => {
                  const next = !formIsGame;
                  setFormIsGame(next);
                  if (next) {
                    if (!formTitle) setFormTitle("Game Day");
                    setFormColor("blue");
                  }
                }}
                className="w-full flex items-center justify-between text-sm"
              >
                <div className="flex items-center gap-2">
                  <Trophy className={`h-4 w-4 ${formIsGame ? "text-amber-400" : "text-muted-foreground"}`} />
                  <span className="font-medium">Game Day</span>
                  <span className="text-xs text-muted-foreground">(opponent, location & more)</span>
                </div>
                <div className={`w-8 h-4 rounded-full transition-colors ${formIsGame ? "bg-amber-500" : "bg-muted"}`}>
                  <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${formIsGame ? "ml-[18px]" : "ml-0.5"}`} />
                </div>
              </button>

              {formIsGame && (
                <div className="space-y-3 pt-3 border-t border-amber-500/20 mt-3">
                  {/* Opponent */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Opponent <span className="text-amber-400">*</span></Label>
                    <Input
                      placeholder="e.g. Lincoln High School"
                      value={formGameOpponent}
                      onChange={(e) => setFormGameOpponent(e.target.value)}
                    />
                  </div>
                  {/* Location */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Location</Label>
                    <Input
                      placeholder="e.g. Home Field · 123 Park Ave"
                      value={formGameLocation}
                      onChange={(e) => setFormGameLocation(e.target.value)}
                    />
                  </div>
                  {/* Home / Away / Neutral */}
                  <div className="space-y-1.5">
                    <Label className="text-sm">Home / Away</Label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(["home", "away", "neutral"] as const).map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => setFormGameHomeAway(opt)}
                          className={`rounded-lg border py-2 text-xs font-medium capitalize transition-colors ${
                            formGameHomeAway === opt
                              ? "border-amber-500 bg-amber-500/10 text-amber-400"
                              : "border-border hover:bg-secondary text-muted-foreground"
                          }`}
                        >
                          {opt === "home" ? "🏠 Home" : opt === "away" ? "✈️ Away" : "⚖️ Neutral"}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Date */}
            <div className="space-y-2">
              <Label>Start Date</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>

            {/* Time */}
            <div className="grid grid-cols-2 gap-3">
              {(["start", "end"] as const).map((which) => {
                const val = which === "start" ? formStartTime : formEndTime;
                const set = which === "start" ? setFormStartTime : setFormEndTime;
                const defaultH = which === "start" ? "9" : "11";
                const defaultAmpm: "AM" | "PM" = which === "start" ? "AM" : "AM";
                const { h, m, ampm: rawAmpm } = parseTimeParts(val);
                // Only highlight AM/PM when a time has actually been selected
                const ampm = h ? rawAmpm : null;
                return (
                  <div key={which} className="space-y-2">
                    <Label>{which === "start" ? "Start Time" : "End Time"}</Label>
                    <div className="flex items-center gap-1">
                      {/* Hour */}
                      <Select
                        value={h}
                        onValueChange={(v) => set(buildTime(v, m || "00", rawAmpm))}
                      >
                        <SelectTrigger className="w-14 px-2 text-center">
                          <SelectValue placeholder="--" />
                        </SelectTrigger>
                        <SelectContent>
                          {Array.from({ length: 12 }, (_, i) => String(i + 1)).map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <span className="text-muted-foreground font-semibold text-sm">:</span>
                      {/* Minute */}
                      <Select
                        value={m}
                        onValueChange={(v) => set(buildTime(h || defaultH, v, rawAmpm))}
                      >
                        <SelectTrigger className="w-14 px-2 text-center">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MINUTE_OPTIONS.map((v) => (
                            <SelectItem key={v} value={v}>{v}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {/* AM/PM */}
                      <div className="flex rounded-md border text-xs overflow-hidden ml-0.5">
                        <button
                          type="button"
                          onClick={() => set(buildTime(h || defaultH, m || "00", "AM"))}
                          className={`px-2.5 py-1.5 transition-colors ${ampm === "AM" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}
                        >AM</button>
                        <button
                          type="button"
                          onClick={() => set(buildTime(h || defaultH, m || "00", "PM"))}
                          className={`px-2.5 py-1.5 border-l transition-colors ${ampm === "PM" ? "bg-primary text-primary-foreground" : "hover:bg-secondary text-muted-foreground"}`}
                        >PM</button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>


            {/* Athlete selection — individual coaches see checkboxes; team coaches skip (team set above) */}
            {!isTeamCoach && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>
                    {formSplitEnabled ? "Group A Athletes" : "Athletes"}
                  </Label>
                  {!editEntry && athletes.length > 1 && (
                    <button
                      onClick={selectAllAthletes}
                      className="text-xs text-primary hover:underline"
                    >
                      {formAthleteIds.length === athletes.length ? "Deselect all" : "Select all"}
                    </button>
                  )}
                </div>

                {/* Position quick-select buttons */}
                {positionsInRoster.length > 0 && !editEntry && (
                  <div className="flex flex-wrap gap-1.5">
                    {positionsInRoster.map((pos) => (
                      <button
                        key={pos}
                        onClick={() => quickSelectPositionGroup(pos)}
                        className="text-xs rounded-full px-2 py-0.5 border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                      >
                        All {pos}s
                      </button>
                    ))}
                  </div>
                )}

                <div className="rounded-lg border divide-y max-h-48 overflow-y-auto">
                  {athletes.map((a) => (
                    <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/30">
                      <Checkbox
                        checked={formAthleteIds.includes(a.id)}
                        onCheckedChange={() => editEntry ? setFormAthleteIds([a.id]) : toggleAthlete(a.id, "A")}
                      />
                      <span className="text-sm flex-1">{a.name}</span>
                      {a.sport_position && (
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.sport_position}</Badge>
                      )}
                    </label>
                  ))}
                  {athletes.length === 0 && (
                    <p className="text-sm text-muted-foreground text-center py-3">No athletes linked yet.</p>
                  )}
                </div>

                {formAthleteIds.length > 1 && !formSplitEnabled && (
                  <p className="text-xs text-muted-foreground">
                    {formAthleteIds.length} athletes selected.
                  </p>
                )}
              </div>
            )}

            {/* Split practice toggle */}
            {!editEntry && (
              <div className="rounded-lg border p-3 space-y-3">
                <button
                  onClick={() => setFormSplitEnabled(!formSplitEnabled)}
                  className="w-full flex items-center justify-between text-sm"
                >
                  <div className="flex items-center gap-2">
                    <SplitSquareHorizontal className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">Split practice by group</span>
                    <span className="text-xs text-muted-foreground">(e.g. Pitchers / Batters)</span>
                  </div>
                  <div className={`w-8 h-4 rounded-full transition-colors ${formSplitEnabled ? "bg-primary" : "bg-muted"}`}>
                    <div className={`w-3 h-3 rounded-full bg-white mt-0.5 transition-all ${formSplitEnabled ? "ml-4.5" : "ml-0.5"}`} />
                  </div>
                </button>

                {formSplitEnabled && (
                  <div className="space-y-3 pt-1 border-t">
                    <div className="space-y-1.5">
                      <Label className="text-sm">Group B Title</Label>
                      <Input
                        placeholder="e.g. Batting Practice - Cage"
                        value={formGroupBTitle}
                        onChange={(e) => setFormGroupBTitle(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">Group B Athletes</Label>
                        {positionsInRoster.length > 0 && (
                          <div className="flex gap-1">
                            {positionsInRoster.map((pos) => (
                              <button
                                key={pos}
                                onClick={() => {
                                  const ids = athletes.filter((a) => a.sport_position === pos).map((a) => a.id);
                                  setFormGroupBAthleteIds(ids);
                                }}
                                className="text-[10px] rounded-full px-2 py-0.5 border border-dashed border-border hover:border-primary hover:text-primary transition-colors"
                              >
                                {pos}s
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="rounded-lg border divide-y max-h-36 overflow-y-auto">
                        {athletes.map((a) => (
                          <label key={a.id} className="flex items-center gap-3 px-3 py-2 cursor-pointer hover:bg-secondary/30">
                            <Checkbox
                              checked={formGroupBAthleteIds.includes(a.id)}
                              onCheckedChange={() => toggleAthlete(a.id, "B")}
                            />
                            <span className="text-sm flex-1">{a.name}</span>
                            {a.sport_position && (
                              <Badge variant="outline" className="text-[10px] px-1.5 py-0">{a.sport_position}</Badge>
                            )}
                          </label>
                        ))}
                      </div>
                      {formGroupBAthleteIds.length > 0 && (
                        <p className="text-xs text-muted-foreground">{formGroupBAthleteIds.length} athletes in Group B.</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Recurrence: day-of-week + weeks (new sessions only) */}
            {!editEntry && (
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label>Repeat on days</Label>
                  <div className="flex gap-1.5">
                    {DAYS_OF_WEEK.map((d) => (
                      <button
                        key={d.value}
                        onClick={() => toggleDay(d.value)}
                        className={`w-9 h-9 rounded-full text-xs font-medium transition-colors ${
                          formDays.includes(d.value)
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-muted-foreground hover:bg-primary/20"
                        }`}
                      >
                        {d.label}
                      </button>
                    ))}
                  </div>
                  {formDays.length === 0 && (
                    <p className="text-xs text-muted-foreground">No days selected: schedules only on the start date.</p>
                  )}
                </div>

                {formDays.length > 0 && (() => {
                  const selTeam = teams.find((t) => t.id === formTeamId) ?? null;
                  const seasonWeeks = selTeam?.season_end && formDate
                    ? Math.max(1, differenceInWeeks(parseISO(selTeam.season_end), parseISO(formDate)) + 1)
                    : null;
                  const PRESETS = [
                    { label: "4 wks", value: 4 },
                    { label: "8 wks", value: 8 },
                    { label: "12 wks", value: 12 },
                    ...(seasonWeeks ? [{ label: `Full Season (${seasonWeeks}w)`, value: seasonWeeks }] : []),
                  ];
                  return (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>For how many weeks?</Label>
                        <div className="flex gap-1.5">
                          {PRESETS.map((p) => (
                            <button
                              key={p.label}
                              onClick={() => setFormWeeks(p.value)}
                              className={`text-xs rounded-full px-2.5 py-1 border transition-colors ${
                                formWeeks === p.value
                                  ? "bg-primary text-primary-foreground border-primary"
                                  : "border-border hover:bg-secondary"
                              }`}
                            >
                              {p.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <input
                          type="range"
                          min={1}
                          max={52}
                          value={formWeeks}
                          onChange={(e) => setFormWeeks(Number(e.target.value))}
                          className="flex-1"
                        />
                        <span className="text-sm font-medium w-16 text-right">
                          {formWeeks} {formWeeks === 1 ? "week" : "weeks"}
                        </span>
                      </div>
                      {formDate && (
                        <p className="text-xs text-muted-foreground">
                          {buildDates(formDate).length} date(s) total
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>
            )}

            {/* Color */}
            <div className="space-y-2">
              <Label>Color</Label>
              <div className="flex gap-2">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setFormColor(c.value)}
                    className={`w-8 h-8 rounded-full border-2 transition-all ${getColorClass(c.value)} ${formColor === c.value ? "ring-2 ring-offset-2 ring-offset-background ring-primary scale-110" : ""}`}
                    title={c.label}
                  />
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label>Notes (optional)</Label>
              <Textarea
                placeholder="Focus areas, equipment needed..."
                value={formNotes}
                onChange={(e) => setFormNotes(e.target.value)}
                className="min-h-[60px]"
              />
            </div>

            {/* Session count preview */}
            {!editEntry && formDate && (formAthleteIds.length > 0 || formGroupBAthleteIds.length > 0) && (
              <p className="text-xs text-muted-foreground rounded-lg bg-secondary/40 px-3 py-2">
                Will create{" "}
                <span className="font-semibold text-foreground">
                  {buildDates(formDate).length * (formAthleteIds.length + (formSplitEnabled ? formGroupBAthleteIds.length : 0))}
                </span>{" "}
                session(s) across{" "}
                <span className="font-semibold text-foreground">{buildDates(formDate).length}</span> date(s) for{" "}
                <span className="font-semibold text-foreground">
                  {formAthleteIds.length + (formSplitEnabled ? formGroupBAthleteIds.length : 0)}
                </span>{" "}
                athlete(s){formSplitEnabled ? " (2 groups)" : ""}.
              </p>
            )}
          </div>

          <DialogFooter className="flex gap-2 sm:gap-0">
            {editEntry && (
              <div className="mr-auto flex items-center gap-2">
                {deleteConfirm ? (
                  <>
                    <span className="text-xs text-destructive">Delete permanently?</span>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => deleteMut.mutate(getGroupIds(editEntry))}
                      disabled={deleteMut.isPending}
                    >
                      {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Yes, delete"}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteConfirm(false)}>No</Button>
                  </>
                ) : (
                  <>
                    {editEntry.status === "canceled" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-emerald-400 border-emerald-400/40 hover:bg-emerald-400/10"
                        onClick={() => restoreMut.mutate(getGroupIds(editEntry))}
                        disabled={restoreMut.isPending}
                      >
                        {restoreMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><RotateCcw className="h-3.5 w-3.5 mr-1" />Restore</>}
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-orange-400 border-orange-400/40 hover:bg-orange-400/10"
                        onClick={() => cancelMut.mutate(getGroupIds(editEntry))}
                        disabled={cancelMut.isPending}
                      >
                        {cancelMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <><XCircle className="h-3.5 w-3.5 mr-1" />Cancel Practice</>}
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => setDeleteConfirm(true)}
                      title="Delete session"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            )}
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Close</Button>
            <Button
              onClick={() => saveMut.mutate({ isEdit: !!editEntry })}
              disabled={
                (!isTeamCoach && formAthleteIds.length === 0 && !(formSplitEnabled && formGroupBAthleteIds.length > 0)) ||
                (isTeamCoach && !editEntry && !formTeamId) ||
                !formDate ||
                saveMut.isPending
              }
            >
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editEntry ? "Update" : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* ── Mass clear dialog ── */}
      <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] text-destructive flex items-center gap-2">
              <Eraser className="h-5 w-5" /> Clear Sessions
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Choose which sessions to permanently delete:</p>

            {/* Team filter — only shown when there are teams */}
            {teams.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Team</p>
                <div className="grid grid-cols-1 gap-1.5">
                  <button
                    onClick={() => setClearTeamId("__all__")}
                    className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                      clearTeamId === "__all__"
                        ? "border-destructive bg-destructive/10 text-destructive font-medium"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    All teams
                  </button>
                  {teams.map((t) => (
                    <button
                      key={t.id}
                      onClick={() => setClearTeamId(t.id)}
                      className={`w-full text-left rounded-lg border px-3 py-2 text-sm transition-colors ${
                        clearTeamId === t.id
                          ? "border-destructive bg-destructive/10 text-destructive font-medium"
                          : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      {t.name}
                      <span className="text-xs text-muted-foreground font-normal ml-1.5">· {t.memberIds.length} athletes</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Time range</p>
              <div className="space-y-1.5">
                {([
                  { value: "month", label: `This month (${format(monthStart, "MMMM yyyy")})`, desc: "Only sessions in the current calendar view" },
                  { value: "future", label: "All future sessions", desc: "Today and all upcoming sessions" },
                  { value: "all", label: "Everything", desc: "All sessions ever — cannot be undone" },
                ] as const).map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setClearRange(opt.value)}
                    className={`w-full text-left rounded-lg border p-3 transition-colors ${
                      clearRange === opt.value
                        ? "border-destructive bg-destructive/10"
                        : "border-border hover:bg-secondary/50"
                    }`}
                  >
                    <p className={`text-sm font-medium ${clearRange === opt.value ? "text-destructive" : ""}`}>{opt.label}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowClearDialog(false)}>Cancel</Button>
            <Button
              variant="destructive"
              onClick={() => clearMut.mutate({ range: clearRange, teamId: clearTeamId })}
              disabled={clearMut.isPending}
            >
              {clearMut.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Trash2 className="h-4 w-4 mr-1" />}
              Delete {clearRange === "month" ? "This Month" : clearRange === "future" ? "All Future" : "Everything"}
              {clearTeamId !== "__all__" && ` · ${teams.find((t) => t.id === clearTeamId)?.name}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachSchedule;
