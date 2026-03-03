import { useState, useMemo, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { format, startOfWeek, addDays, differenceInCalendarWeeks } from "date-fns";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Plus, Pencil, Trash2, ChevronLeft, ChevronRight,
  Clock, Dumbbell, Loader2, GripVertical, X, CalendarDays, ClipboardList
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

// ─── Types ────────────────────────────────────────────────────────────────────

type DrillCategory = "warmup" | "skill" | "conditioning" | "scrimmage" | "cooldown" | "other";

interface CoachDrill {
  id: string;
  name: string;
  category: DrillCategory;
  duration_min: number | null;
  description: string | null;
  coaching_cues: string | null;
  equipment: string | null;
  rep_scheme: string | null;
  created_at: string;
}

interface TeamPractice {
  id: string;
  practice_date: string;
  title: string;
  duration_min: number;
  notes: string | null;
}

interface PracticeBlock {
  id: string;
  practice_id: string;
  drill_id: string | null;
  title: string;
  block_type: DrillCategory;
  duration_min: number | null;
  notes: string | null;
  order_index: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES: { value: DrillCategory; label: string }[] = [
  { value: "warmup",       label: "Warm-Up"      },
  { value: "skill",        label: "Skill Work"   },
  { value: "conditioning", label: "Conditioning" },
  { value: "scrimmage",    label: "Scrimmage"    },
  { value: "cooldown",     label: "Cool-Down"    },
  { value: "other",        label: "Other"        },
];

const CATEGORY_COLORS: Record<DrillCategory, string> = {
  warmup:       "bg-orange-500/15 text-orange-400 border-orange-500/20",
  skill:        "bg-blue-500/15 text-blue-400 border-blue-500/20",
  conditioning: "bg-green-500/15 text-green-400 border-green-500/20",
  scrimmage:    "bg-violet-500/15 text-violet-400 border-violet-500/20",
  cooldown:     "bg-slate-500/15 text-slate-400 border-slate-500/20",
  other:        "bg-secondary text-muted-foreground",
};

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ─── Blank form helpers ────────────────────────────────────────────────────────

const blankDrill = () => ({
  name: "", category: "skill" as DrillCategory, duration_min: "",
  description: "", coaching_cues: "", equipment: "", rep_scheme: "",
});

const blankBlock = () => ({
  title: "", block_type: "skill" as DrillCategory,
  duration_min: "", notes: "", drill_id: "",
});

// ─── Component ────────────────────────────────────────────────────────────────

const CoachDrills = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Tabs
  const [tab, setTab] = useState<"library" | "planner">("library");

  // Drill library
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [drillDialogOpen, setDrillDialogOpen] = useState(false);
  const [editingDrill, setEditingDrill] = useState<CoachDrill | null>(null);
  const [drillForm, setDrillForm] = useState(blankDrill());

  // Practice planner
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState<string | null>(null); // ISO date string
  const [practiceDialogOpen, setPracticeDialogOpen] = useState(false);
  const [practiceForm, setPracticeForm] = useState({ title: "Practice", duration_min: "90", notes: "" });
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<PracticeBlock | null>(null);
  const [blockForm, setBlockForm] = useState(blankBlock());
  const [useLibraryDrill, setUseLibraryDrill] = useState(false);

  // Derived week dates
  const weekStart = useMemo(
    () => addDays(startOfWeek(new Date(), { weekStartsOn: 1 }), weekOffset * 7),
    [weekOffset]
  );
  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart]
  );

  // ── Queries ──────────────────────────────────────────────────────────────

  const { data: drills = [], isLoading: drillsLoading } = useQuery<CoachDrill[]>({
    queryKey: ["coach-drills", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("coach_drills")
        .select("*")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });
      return (data as CoachDrill[]) ?? [];
    },
    enabled: !!user,
  });

  const weekStartISO = format(weekStart, "yyyy-MM-dd");
  const weekEndISO = format(weekDays[6], "yyyy-MM-dd");

  const { data: practices = [] } = useQuery<TeamPractice[]>({
    queryKey: ["team-practices", user?.id, weekStartISO],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("team_practices")
        .select("id, practice_date, title, duration_min, notes")
        .eq("coach_id", user.id)
        .gte("practice_date", weekStartISO)
        .lte("practice_date", weekEndISO);
      return (data as TeamPractice[]) ?? [];
    },
    enabled: !!user,
  });

  const selectedPractice = selectedDay
    ? practices.find((p) => p.practice_date === selectedDay) ?? null
    : null;

  const { data: blocks = [] } = useQuery<PracticeBlock[]>({
    queryKey: ["practice-blocks", selectedPractice?.id],
    queryFn: async () => {
      if (!selectedPractice) return [];
      const { data } = await (supabase as any)
        .from("practice_blocks")
        .select("*")
        .eq("practice_id", selectedPractice.id)
        .order("order_index", { ascending: true });
      return (data as PracticeBlock[]) ?? [];
    },
    enabled: !!selectedPractice,
  });

  // Schedule entries for the visible week (shown on day grid cells)
  const { data: weekSchedule = [] } = useQuery<Array<{ id: string; title: string; scheduled_date: string; color: string | null; start_time: string | null }>>({
    queryKey: ["week-schedule-drills", user?.id, weekStartISO],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("coach_schedule")
        .select("id, title, scheduled_date, color, start_time")
        .eq("coach_id", user.id)
        .gte("scheduled_date", weekStartISO)
        .lte("scheduled_date", weekEndISO)
        .order("start_time", { ascending: true });
      return data || [];
    },
    enabled: !!user,
  });

  // Auto-navigate to planner tab + correct week when arriving from Schedule page (?date=)
  useEffect(() => {
    const dateParam = searchParams.get("date");
    if (!dateParam) return;
    setTab("planner");
    const targetDate = new Date(dateParam + "T00:00:00");
    const todayWeekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    const targetWeekStart = startOfWeek(targetDate, { weekStartsOn: 1 });
    const diffWeeks = differenceInCalendarWeeks(targetWeekStart, todayWeekStart, { weekStartsOn: 1 });
    setWeekOffset(diffWeeks);
    setSelectedDay(dateParam);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally mount-only

  // ── Drill mutations ───────────────────────────────────────────────────────

  const saveDrillMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const payload = {
        coach_id: user.id,
        name: drillForm.name.trim(),
        category: drillForm.category,
        duration_min: drillForm.duration_min ? parseInt(drillForm.duration_min) : null,
        description: drillForm.description.trim() || null,
        coaching_cues: drillForm.coaching_cues.trim() || null,
        equipment: drillForm.equipment.trim() || null,
        rep_scheme: drillForm.rep_scheme.trim() || null,
      };
      if (editingDrill) {
        const { error } = await (supabase as any).from("coach_drills").update(payload).eq("id", editingDrill.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("coach_drills").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-drills"] });
      setDrillDialogOpen(false);
      toast({ title: editingDrill ? "Drill updated" : "Drill added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteDrillMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("coach_drills").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-drills"] });
      toast({ title: "Drill deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Practice mutations ────────────────────────────────────────────────────

  const savePracticeMutation = useMutation({
    mutationFn: async () => {
      if (!user || !selectedDay) throw new Error("Missing data");
      const payload = {
        coach_id: user.id,
        practice_date: selectedDay,
        title: practiceForm.title.trim() || "Practice",
        duration_min: parseInt(practiceForm.duration_min) || 90,
        notes: practiceForm.notes.trim() || null,
      };
      if (selectedPractice) {
        const { error } = await (supabase as any).from("team_practices").update(payload).eq("id", selectedPractice.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("team_practices").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-practices"] });
      setPracticeDialogOpen(false);
      toast({ title: selectedPractice ? "Practice updated" : "Practice created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deletePracticeMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("team_practices").delete().eq("id", id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-practices"] });
      setSelectedDay(null);
      toast({ title: "Practice deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Block mutations ───────────────────────────────────────────────────────

  const saveBlockMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPractice) throw new Error("No practice selected");
      const resolvedDrillId = useLibraryDrill && blockForm.drill_id ? blockForm.drill_id : null;
      const resolvedTitle = useLibraryDrill && blockForm.drill_id
        ? (drills.find((d) => d.id === blockForm.drill_id)?.name ?? blockForm.title.trim())
        : blockForm.title.trim();

      const payload = {
        practice_id: selectedPractice.id,
        drill_id: resolvedDrillId,
        title: resolvedTitle,
        block_type: blockForm.block_type,
        duration_min: blockForm.duration_min ? parseInt(blockForm.duration_min) : null,
        notes: blockForm.notes.trim() || null,
        order_index: editingBlock ? editingBlock.order_index : blocks.length,
      };

      if (editingBlock) {
        const { error } = await (supabase as any).from("practice_blocks").update(payload).eq("id", editingBlock.id);
        if (error) throw error;
      } else {
        const { error } = await (supabase as any).from("practice_blocks").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["practice-blocks"] });
      setBlockDialogOpen(false);
      toast({ title: editingBlock ? "Block updated" : "Block added" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteBlockMutation = useMutation({
    mutationFn: async (id: string) => {
      await (supabase as any).from("practice_blocks").delete().eq("id", id);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["practice-blocks"] }),
  });

  const moveBlock = async (blockId: string, direction: "up" | "down") => {
    const idx = blocks.findIndex((b) => b.id === blockId);
    if (direction === "up" && idx === 0) return;
    if (direction === "down" && idx === blocks.length - 1) return;

    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    const updated = [...blocks];
    [updated[idx], updated[swapIdx]] = [updated[swapIdx], updated[idx]];

    await Promise.all([
      (supabase as any).from("practice_blocks").update({ order_index: swapIdx }).eq("id", updated[swapIdx].id),
      (supabase as any).from("practice_blocks").update({ order_index: idx }).eq("id", updated[idx].id),
    ]);
    queryClient.invalidateQueries({ queryKey: ["practice-blocks"] });
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const openAddDrill = () => {
    setEditingDrill(null);
    setDrillForm(blankDrill());
    setDrillDialogOpen(true);
  };

  const openEditDrill = (d: CoachDrill) => {
    setEditingDrill(d);
    setDrillForm({
      name: d.name,
      category: d.category,
      duration_min: d.duration_min?.toString() ?? "",
      description: d.description ?? "",
      coaching_cues: d.coaching_cues ?? "",
      equipment: d.equipment ?? "",
      rep_scheme: d.rep_scheme ?? "",
    });
    setDrillDialogOpen(true);
  };

  const openDay = (isoDate: string) => {
    const practice = practices.find((p) => p.practice_date === isoDate);
    setSelectedDay(isoDate);
    if (!practice) {
      setPracticeForm({ title: "Practice", duration_min: "90", notes: "" });
    } else {
      setPracticeForm({
        title: practice.title,
        duration_min: practice.duration_min.toString(),
        notes: practice.notes ?? "",
      });
    }
  };

  const openAddBlock = () => {
    setEditingBlock(null);
    setBlockForm(blankBlock());
    setUseLibraryDrill(false);
    setBlockDialogOpen(true);
  };

  const openEditBlock = (b: PracticeBlock) => {
    setEditingBlock(b);
    setBlockForm({
      title: b.title,
      block_type: b.block_type,
      duration_min: b.duration_min?.toString() ?? "",
      notes: b.notes ?? "",
      drill_id: b.drill_id ?? "",
    });
    setUseLibraryDrill(!!b.drill_id);
    setBlockDialogOpen(true);
  };

  const totalPracticeMins = blocks.reduce((s, b) => s + (b.duration_min ?? 0), 0);

  const filteredDrills = categoryFilter === "all"
    ? drills
    : drills.filter((d) => d.category === categoryFilter);

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="coach">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Drills & Practices</h1>
        <p className="text-muted-foreground mt-1">Build your drill library and plan weekly practices.</p>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as "library" | "planner")}>
        <TabsList className="mb-6">
          <TabsTrigger value="library" className="gap-2">
            <Dumbbell className="h-4 w-4" /> Drill Library
          </TabsTrigger>
          <TabsTrigger value="planner" className="gap-2">
            <CalendarDays className="h-4 w-4" /> Practice Planner
          </TabsTrigger>
        </TabsList>

        {/* ── Drill Library ─────────────────────────────────────────────── */}
        <TabsContent value="library">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2 flex-wrap">
              {["all", ...CATEGORIES.map((c) => c.value)].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                    categoryFilter === cat
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border text-muted-foreground hover:border-primary/40"
                  }`}
                >
                  {cat === "all" ? "All" : CATEGORIES.find((c) => c.value === cat)?.label}
                </button>
              ))}
            </div>
            <Button onClick={openAddDrill}>
              <Plus className="h-4 w-4 mr-1" /> Add Drill
            </Button>
          </div>

          {drillsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : filteredDrills.length === 0 ? (
            <Card>
              <CardContent className="py-16 text-center">
                <Dumbbell className="h-8 w-8 mx-auto text-muted-foreground mb-3" />
                <p className="font-medium">No drills yet</p>
                <p className="text-sm text-muted-foreground mt-1">Add drills to your library to start building practices.</p>
                <Button className="mt-4" onClick={openAddDrill}><Plus className="h-4 w-4 mr-1" /> Add Your First Drill</Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDrills.map((drill) => (
                <Card key={drill.id} className="flex flex-col">
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <CardTitle className="text-base leading-snug">{drill.name}</CardTitle>
                      <div className="flex gap-1 shrink-0">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditDrill(drill)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => deleteDrillMutation.mutate(drill.id)}>
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      <Badge variant="outline" className={`text-[10px] capitalize ${CATEGORY_COLORS[drill.category]}`}>
                        {CATEGORIES.find((c) => c.value === drill.category)?.label ?? drill.category}
                      </Badge>
                      {drill.duration_min && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" /> {drill.duration_min} min
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0 flex-1 space-y-1.5">
                    {drill.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{drill.description}</p>
                    )}
                    {drill.rep_scheme && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Reps:</span> {drill.rep_scheme}
                      </p>
                    )}
                    {drill.equipment && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium text-foreground">Equipment:</span> {drill.equipment}
                      </p>
                    )}
                    {drill.coaching_cues && (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        <span className="font-medium text-foreground">Cues:</span> {drill.coaching_cues}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ── Practice Planner ──────────────────────────────────────────── */}
        <TabsContent value="planner">
          {/* Week navigator */}
          <div className="flex items-center justify-between mb-5">
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w - 1)}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="font-medium text-sm">
              Week of {format(weekStart, "MMM d")} – {format(weekDays[6], "MMM d, yyyy")}
            </span>
            <Button variant="outline" size="sm" onClick={() => setWeekOffset((w) => w + 1)}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          {/* 7-day grid */}
          <div className="grid grid-cols-7 gap-2 mb-6">
            {weekDays.map((day, i) => {
              const isoDate = format(day, "yyyy-MM-dd");
              const practice = practices.find((p) => p.practice_date === isoDate);
              const isToday = format(new Date(), "yyyy-MM-dd") === isoDate;
              const isSelected = selectedDay === isoDate;

              return (
                <button
                  key={isoDate}
                  onClick={() => openDay(isoDate)}
                  className={`rounded-xl border p-2 text-center transition-all flex flex-col items-center gap-1 min-h-[80px] ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : isToday
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-secondary/50"
                  }`}
                >
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                    {DAYS[i]}
                  </span>
                  <span className={`text-lg font-bold font-['Space_Grotesk'] ${isToday ? "text-primary" : ""}`}>
                    {format(day, "d")}
                  </span>
                  {(() => {
                    const dayEntries = weekSchedule.filter((e) => e.scheduled_date === isoDate);
                    return dayEntries.length > 0 ? (
                      <div className="w-full flex flex-col gap-0.5">
                        {dayEntries.slice(0, 2).map((e) => (
                          <span key={e.id} className="w-full rounded bg-blue-500/15 text-blue-400 text-[8px] px-0.5 py-0.5 leading-tight truncate text-center">
                            {e.title}
                          </span>
                        ))}
                        {dayEntries.length > 2 && (
                          <span className="text-[8px] text-muted-foreground text-center">+{dayEntries.length - 2}</span>
                        )}
                      </div>
                    ) : null;
                  })()}
                  {practice ? (
                    <span className="w-full mt-auto rounded-md bg-primary/10 text-primary text-[9px] font-semibold px-1 py-0.5 leading-tight text-center">
                      {practice.duration_min}m
                    </span>
                  ) : (
                    <span className="text-muted-foreground text-lg leading-none mt-auto">+</span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selected day panel */}
          {selectedDay && (
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base font-['Space_Grotesk']">
                    {format(new Date(selectedDay + "T00:00:00"), "EEEE, MMMM d")}
                    {selectedPractice && (
                      <span className="ml-2 text-sm font-normal text-muted-foreground">— {selectedPractice.title}</span>
                    )}
                  </CardTitle>
                  <div className="flex items-center gap-2">
                    {selectedPractice && (
                      <>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {totalPracticeMins > 0 ? `${totalPracticeMins}/${selectedPractice.duration_min} min` : `${selectedPractice.duration_min} min`}
                        </span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1 text-blue-400 border-blue-500/30 hover:bg-blue-500/10 hover:text-blue-300"
                          onClick={() => navigate(`/coach/schedule?date=${selectedDay}&title=${encodeURIComponent(selectedPractice.title)}`)}
                        >
                          <CalendarDays className="h-3.5 w-3.5" /> Schedule
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => {
                          setPracticeForm({
                            title: selectedPractice.title,
                            duration_min: selectedPractice.duration_min.toString(),
                            notes: selectedPractice.notes ?? "",
                          });
                          setPracticeDialogOpen(true);
                        }}>
                          <Pencil className="h-3.5 w-3.5 mr-1" /> Edit
                        </Button>
                        <Button
                          size="sm" variant="ghost"
                          onClick={() => deletePracticeMutation.mutate(selectedPractice.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5 text-muted-foreground" />
                        </Button>
                      </>
                    )}
                    <Button size="sm" variant="ghost" onClick={() => setSelectedDay(null)}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                {selectedPractice?.notes && (
                  <p className="text-xs text-muted-foreground mt-1">{selectedPractice.notes}</p>
                )}
              </CardHeader>

              <CardContent>
                {!selectedPractice ? (
                  <div className="py-8 text-center space-y-3">
                    <ClipboardList className="h-8 w-8 mx-auto text-muted-foreground" />
                    <p className="text-sm text-muted-foreground">No practice scheduled for this day.</p>
                    <Button onClick={() => setPracticeDialogOpen(true)}>
                      <Plus className="h-4 w-4 mr-1" /> Create Practice
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {blocks.length === 0 && (
                      <p className="text-sm text-muted-foreground py-2">No blocks yet. Add your first block below.</p>
                    )}

                    {blocks.map((block, idx) => (
                      <div
                        key={block.id}
                        className="flex items-start gap-3 rounded-lg border bg-secondary/20 p-3 group"
                      >
                        <GripVertical className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[block.block_type]}`}>
                              {CATEGORIES.find((c) => c.value === block.block_type)?.label}
                            </Badge>
                            <span className="font-medium text-sm">{block.title}</span>
                            {block.duration_min && (
                              <span className="text-xs text-muted-foreground flex items-center gap-0.5">
                                <Clock className="h-3 w-3" /> {block.duration_min}m
                              </span>
                            )}
                          </div>
                          {block.notes && (
                            <p className="text-xs text-muted-foreground mt-1">{block.notes}</p>
                          )}
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveBlock(block.id, "up")} disabled={idx === 0}>
                            <ChevronLeft className="h-3 w-3 rotate-90" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => moveBlock(block.id, "down")} disabled={idx === blocks.length - 1}>
                            <ChevronRight className="h-3 w-3 rotate-90" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEditBlock(block)}>
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => deleteBlockMutation.mutate(block.id)}>
                            <Trash2 className="h-3 w-3 text-muted-foreground" />
                          </Button>
                        </div>
                      </div>
                    ))}

                    <Button variant="outline" size="sm" className="mt-2" onClick={openAddBlock}>
                      <Plus className="h-4 w-4 mr-1" /> Add Block
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {!selectedDay && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Select a day above to view or create a practice.
            </p>
          )}
        </TabsContent>
      </Tabs>

      {/* ── Add/Edit Drill Dialog ────────────────────────────────────────── */}
      <Dialog open={drillDialogOpen} onOpenChange={setDrillDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingDrill ? "Edit Drill" : "Add Drill"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Name *</Label>
              <Input value={drillForm.name} onChange={(e) => setDrillForm((f) => ({ ...f, name: e.target.value }))} placeholder="e.g. Serve & Pass Drill" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={drillForm.category} onValueChange={(v) => setDrillForm((f) => ({ ...f, category: v as DrillCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Duration (min)</Label>
                <Input type="number" min="1" value={drillForm.duration_min} onChange={(e) => setDrillForm((f) => ({ ...f, duration_min: e.target.value }))} placeholder="15" />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={drillForm.description} onChange={(e) => setDrillForm((f) => ({ ...f, description: e.target.value }))} className="min-h-[70px]" placeholder="What the drill focuses on..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Rep Scheme</Label>
                <Input value={drillForm.rep_scheme} onChange={(e) => setDrillForm((f) => ({ ...f, rep_scheme: e.target.value }))} placeholder="3×10, 5 min, etc." />
              </div>
              <div className="space-y-1.5">
                <Label>Equipment</Label>
                <Input value={drillForm.equipment} onChange={(e) => setDrillForm((f) => ({ ...f, equipment: e.target.value }))} placeholder="Balls, cones..." />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Coaching Cues</Label>
              <Textarea value={drillForm.coaching_cues} onChange={(e) => setDrillForm((f) => ({ ...f, coaching_cues: e.target.value }))} className="min-h-[60px]" placeholder="Key points to emphasize..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDrillDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => saveDrillMutation.mutate()} disabled={!drillForm.name.trim() || saveDrillMutation.isPending}>
              {saveDrillMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {editingDrill ? "Save Changes" : "Add Drill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Create/Edit Practice Dialog ──────────────────────────────────── */}
      <Dialog open={practiceDialogOpen} onOpenChange={setPracticeDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedPractice ? "Edit Practice" : "Create Practice"} — {selectedDay ? format(new Date(selectedDay + "T00:00:00"), "MMM d") : ""}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Title</Label>
              <Input value={practiceForm.title} onChange={(e) => setPracticeForm((f) => ({ ...f, title: e.target.value }))} placeholder="Practice" />
            </div>
            <div className="space-y-1.5">
              <Label>Total Duration (min)</Label>
              <Input type="number" min="15" value={practiceForm.duration_min} onChange={(e) => setPracticeForm((f) => ({ ...f, duration_min: e.target.value }))} placeholder="90" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={practiceForm.notes} onChange={(e) => setPracticeForm((f) => ({ ...f, notes: e.target.value }))} className="min-h-[60px]" placeholder="Focus areas, location, etc." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPracticeDialogOpen(false)}>Cancel</Button>
            <Button onClick={() => savePracticeMutation.mutate()} disabled={savePracticeMutation.isPending}>
              {savePracticeMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {selectedPractice ? "Save" : "Create Practice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Add/Edit Block Dialog ─────────────────────────────────────────── */}
      <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editingBlock ? "Edit Block" : "Add Block"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select value={blockForm.block_type} onValueChange={(v) => setBlockForm((f) => ({ ...f, block_type: v as DrillCategory }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>

            {/* Toggle: use drill library or custom title */}
            {drills.length > 0 && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setUseLibraryDrill(false)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${!useLibraryDrill ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  Custom name
                </button>
                <button
                  onClick={() => setUseLibraryDrill(true)}
                  className={`flex-1 py-1.5 rounded-lg border text-sm transition-colors ${useLibraryDrill ? "border-primary bg-primary/10 text-primary" : "border-border text-muted-foreground"}`}
                >
                  From library
                </button>
              </div>
            )}

            {useLibraryDrill ? (
              <div className="space-y-1.5">
                <Label>Pick drill</Label>
                <Select value={blockForm.drill_id} onValueChange={(v) => setBlockForm((f) => ({ ...f, drill_id: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select a drill…" /></SelectTrigger>
                  <SelectContent>
                    {drills.map((d) => (
                      <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="space-y-1.5">
                <Label>Block name *</Label>
                <Input value={blockForm.title} onChange={(e) => setBlockForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Team Warm-Up, 6v6 Scrimmage…" />
              </div>
            )}

            <div className="space-y-1.5">
              <Label>Duration (min)</Label>
              <Input type="number" min="1" value={blockForm.duration_min} onChange={(e) => setBlockForm((f) => ({ ...f, duration_min: e.target.value }))} placeholder="15" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes (optional)</Label>
              <Textarea value={blockForm.notes} onChange={(e) => setBlockForm((f) => ({ ...f, notes: e.target.value }))} className="min-h-[60px]" placeholder="Instructions, cues…" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBlockDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveBlockMutation.mutate()}
              disabled={saveBlockMutation.isPending || (!useLibraryDrill && !blockForm.title.trim()) || (useLibraryDrill && !blockForm.drill_id)}
            >
              {saveBlockMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              {editingBlock ? "Save" : "Add Block"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachDrills;
