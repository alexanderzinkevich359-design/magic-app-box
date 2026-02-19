import { useState, useMemo } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Plus, Loader2, Trash2, GripVertical } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, getDay, addMonths, subMonths, isSameDay, isToday, parseISO } from "date-fns";

const COLORS = [
  { value: "default", label: "Default", class: "bg-primary/20 border-primary/40 text-primary" },
  { value: "blue", label: "Blue", class: "bg-blue-500/20 border-blue-500/40 text-blue-400" },
  { value: "green", label: "Green", class: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400" },
  { value: "orange", label: "Orange", class: "bg-orange-500/20 border-orange-500/40 text-orange-400" },
  { value: "purple", label: "Purple", class: "bg-violet-500/20 border-violet-500/40 text-violet-400" },
];

const getColorClass = (color: string) => COLORS.find((c) => c.value === color)?.class || COLORS[0].class;

type ScheduleEntry = {
  id: string;
  coach_id: string;
  athlete_id: string;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  color: string | null;
};

const CoachSchedule = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [editEntry, setEditEntry] = useState<ScheduleEntry | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [formAthleteId, setFormAthleteId] = useState("");
  const [formTitle, setFormTitle] = useState("");
  const [formStartTime, setFormStartTime] = useState("");
  const [formEndTime, setFormEndTime] = useState("");
  const [formNotes, setFormNotes] = useState("");
  const [formColor, setFormColor] = useState("default");
  const [formDate, setFormDate] = useState("");

  // Fetch athletes
  const { data: athletes = [] } = useQuery({
    queryKey: ["coach-athletes-list", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id")
        .eq("coach_user_id", user.id);
      if (!links?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", links.map((l) => l.athlete_user_id));
      return (profiles || []).map((p) => ({
        id: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim() || "Unknown",
      }));
    },
    enabled: !!user,
  });

  // Fetch schedule for current month
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
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
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data || []) as ScheduleEntry[];
    },
    enabled: !!user,
  });

  // Group schedule by date
  const scheduleByDate = useMemo(() => {
    const map: Record<string, ScheduleEntry[]> = {};
    schedule.forEach((entry) => {
      const key = entry.scheduled_date;
      if (!map[key]) map[key] = [];
      map[key].push(entry);
    });
    return map;
  }, [schedule]);

  // Calendar days
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);

  const getAthleteName = (id: string) => athletes.find((a) => a.id === id)?.name || "Unknown";

  const resetForm = () => {
    setFormAthleteId("");
    setFormTitle("");
    setFormStartTime("");
    setFormEndTime("");
    setFormNotes("");
    setFormColor("default");
    setFormDate("");
    setEditEntry(null);
  };

  const openNewEntry = (date: Date) => {
    resetForm();
    setFormDate(format(date, "yyyy-MM-dd"));
    setSelectedDate(date);
    setShowForm(true);
  };

  const openEditEntry = (entry: ScheduleEntry) => {
    setEditEntry(entry);
    setFormAthleteId(entry.athlete_id);
    setFormTitle(entry.title);
    setFormStartTime(entry.start_time || "");
    setFormEndTime(entry.end_time || "");
    setFormNotes(entry.notes || "");
    setFormColor(entry.color || "default");
    setFormDate(entry.scheduled_date);
    setShowForm(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!user || !formAthleteId || !formDate) return;
      const payload = {
        coach_id: user.id,
        athlete_id: formAthleteId,
        title: formTitle || getAthleteName(formAthleteId),
        scheduled_date: formDate,
        start_time: formStartTime || null,
        end_time: formEndTime || null,
        notes: formNotes || null,
        color: formColor,
      };
      if (editEntry) {
        const { error } = await supabase.from("coach_schedule").update(payload).eq("id", editEntry.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("coach_schedule").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("coach_schedule").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-schedule"] });
      setShowForm(false);
      resetForm();
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Drag & drop state
  const [dragEntry, setDragEntry] = useState<ScheduleEntry | null>(null);

  const moveMut = useMutation({
    mutationFn: async ({ id, newDate }: { id: string; newDate: string }) => {
      const { error } = await supabase.from("coach_schedule").update({ scheduled_date: newDate }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-schedule"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <DashboardLayout role="coach">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Schedule</h1>
        <p className="text-muted-foreground mt-1">Manage your athlete sessions across the month</p>
      </div>

      {/* Month nav */}
      <div className="flex items-center justify-between mb-6">
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-semibold font-['Space_Grotesk']">{format(currentMonth, "MMMM yyyy")}</h2>
        <Button variant="outline" size="icon" onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}>
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      {/* Calendar grid */}
      <Card>
        <CardContent className="p-2 sm:p-4">
          {isLoading ? (
            <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
          ) : (
            <>
              {/* Day headers */}
              <div className="grid grid-cols-7 mb-1">
                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
                  <div key={d} className="text-center text-xs font-medium text-muted-foreground py-2">{d}</div>
                ))}
              </div>

              {/* Day cells */}
              <div className="grid grid-cols-7 auto-rows-[minmax(90px,1fr)] border-t border-l">
                {/* Empty cells for start offset */}
                {Array.from({ length: startDayOfWeek }).map((_, i) => (
                  <div key={`empty-${i}`} className="border-r border-b bg-secondary/20" />
                ))}

                {days.map((day) => {
                  const dateKey = format(day, "yyyy-MM-dd");
                  const entries = scheduleByDate[dateKey] || [];
                  const today = isToday(day);

                  return (
                    <div
                      key={dateKey}
                      className={`border-r border-b p-1 relative group cursor-pointer transition-colors hover:bg-secondary/30 ${today ? "bg-primary/5" : ""}`}
                      onClick={() => openNewEntry(day)}
                      onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add("bg-primary/10"); }}
                      onDragLeave={(e) => e.currentTarget.classList.remove("bg-primary/10")}
                      onDrop={(e) => {
                        e.preventDefault();
                        e.currentTarget.classList.remove("bg-primary/10");
                        if (dragEntry) {
                          moveMut.mutate({ id: dragEntry.id, newDate: dateKey });
                          setDragEntry(null);
                        }
                      }}
                    >
                      <span className={`text-xs font-medium ${today ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"}`}>
                        {format(day, "d")}
                      </span>
                      <div className="mt-1 space-y-0.5 overflow-hidden">
                        {entries.slice(0, 3).map((entry) => (
                          <div
                            key={entry.id}
                            draggable
                            onDragStart={(e) => { e.stopPropagation(); setDragEntry(entry); }}
                            onClick={(e) => { e.stopPropagation(); openEditEntry(entry); }}
                            className={`text-[10px] sm:text-xs truncate rounded px-1 py-0.5 border cursor-grab active:cursor-grabbing ${getColorClass(entry.color || "default")}`}
                            title={`${entry.title || getAthleteName(entry.athlete_id)} ${entry.start_time ? `at ${entry.start_time.slice(0, 5)}` : ""}`}
                          >
                            {entry.start_time && <span className="font-medium">{entry.start_time.slice(0, 5)} </span>}
                            {entry.title || getAthleteName(entry.athlete_id)}
                          </div>
                        ))}
                        {entries.length > 3 && (
                          <div className="text-[10px] text-muted-foreground px-1">+{entries.length - 3} more</div>
                        )}
                      </div>
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

      {/* Entry form dialog */}
      <Dialog open={showForm} onOpenChange={(open) => { if (!open) { setShowForm(false); resetForm(); } }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">
              {editEntry ? "Edit Session" : "New Session"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Athlete</Label>
              <Select value={formAthleteId} onValueChange={setFormAthleteId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select athlete" />
                </SelectTrigger>
                <SelectContent>
                  {athletes.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                  ))}
                  {athletes.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground text-center">No athletes linked</div>
                  )}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Title (optional)</Label>
              <Input placeholder="e.g. Batting practice" value={formTitle} onChange={(e) => setFormTitle(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input type="date" value={formDate} onChange={(e) => setFormDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Start Time</Label>
                <Input type="time" value={formStartTime} onChange={(e) => setFormStartTime(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>End Time</Label>
                <Input type="time" value={formEndTime} onChange={(e) => setFormEndTime(e.target.value)} />
              </div>
            </div>
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
            <div className="space-y-2">
              <Label>Notes</Label>
              <Textarea placeholder="Session notes..." value={formNotes} onChange={(e) => setFormNotes(e.target.value)} className="min-h-[60px]" />
            </div>
          </div>
          <DialogFooter className="flex gap-2 sm:gap-0">
            {editEntry && (
              <Button variant="destructive" size="sm" onClick={() => deleteMut.mutate(editEntry.id)} disabled={deleteMut.isPending} className="mr-auto">
                {deleteMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                Delete
              </Button>
            )}
            <Button variant="outline" onClick={() => { setShowForm(false); resetForm(); }}>Cancel</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!formAthleteId || !formDate || saveMut.isPending}>
              {saveMut.isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {editEntry ? "Update" : "Add Session"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachSchedule;
