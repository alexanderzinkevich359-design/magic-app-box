import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, Loader2, Clock } from "lucide-react";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval, getDay,
  addMonths, subMonths, isToday, parseISO, addDays,
  isBefore, startOfDay,
} from "date-fns";

// ── Types ─────────────────────────────────────────────────────────────────────

type PracticeSession = {
  id: string;
  title: string;
  scheduled_date: string;
  start_time: string | null;
  end_time: string | null;
  notes: string | null;
  color: string | null;
  status: string | null;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

const PRACTICE_COLOR: Record<string, string> = {
  default: "bg-primary/20 border-primary/40 text-primary",
  blue: "bg-blue-500/20 border-blue-500/40 text-blue-400",
  green: "bg-emerald-500/20 border-emerald-500/40 text-emerald-400",
  orange: "bg-orange-500/20 border-orange-500/40 text-orange-400",
  purple: "bg-violet-500/20 border-violet-500/40 text-violet-400",
};
const getPracticeColor = (c: string | null) =>
  PRACTICE_COLOR[c ?? "default"] ?? PRACTICE_COLOR.default;

const formatTime = (t: string | null) => t ? t.slice(0, 5) : null;

// ── Component ─────────────────────────────────────────────────────────────────

const AthleteSchedule = () => {
  const { user } = useAuth();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedPractice, setSelectedPractice] = useState<PracticeSession | null>(null);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startDayOfWeek = getDay(monthStart);
  const today = startOfDay(new Date());

  // ── Query ─────────────────────────────────────────────────────────────────

  const { data: practices = [], isLoading } = useQuery({
    queryKey: ["athlete-practice", user?.id, format(monthStart, "yyyy-MM")],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coach_schedule")
        .select("id, title, scheduled_date, start_time, end_time, notes, color, status")
        .eq("athlete_id", user.id)
        .gte("scheduled_date", format(monthStart, "yyyy-MM-dd"))
        .lte("scheduled_date", format(monthEnd, "yyyy-MM-dd"))
        .order("scheduled_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PracticeSession[];
    },
    enabled: !!user,
  });

  // ── Derived ───────────────────────────────────────────────────────────────

  const practiceByDate = useMemo(() => {
    const map: Record<string, PracticeSession[]> = {};
    practices.forEach((p) => {
      if (!map[p.scheduled_date]) map[p.scheduled_date] = [];
      map[p.scheduled_date].push(p);
    });
    return map;
  }, [practices]);

  const upcomingPractices = useMemo(() => {
    const cutoff = addDays(today, 14);
    return practices
      .filter((p) => {
        const d = parseISO(p.scheduled_date);
        return !isBefore(d, today) && isBefore(d, cutoff);
      })
      .slice(0, 8);
  }, [practices, today]);

  const isThisMonth = format(currentMonth, "yyyy-MM") === format(new Date(), "yyyy-MM");

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <DashboardLayout role="athlete">
      <div className="mb-6">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Schedule</h1>
        <p className="text-muted-foreground mt-1">Your practice schedule from your coach</p>
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

      <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
        {/* Calendar */}
        <Card>
          <CardContent className="p-2 sm:p-4">
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
                <div className="grid grid-cols-7 auto-rows-[minmax(80px,1fr)] border-t border-l">
                  {Array.from({ length: startDayOfWeek }).map((_, i) => (
                    <div key={`empty-${i}`} className="border-r border-b bg-secondary/20" />
                  ))}
                  {days.map((day) => {
                    const dateKey = format(day, "yyyy-MM-dd");
                    const todayDay = isToday(day);
                    const dayPractices = practiceByDate[dateKey] ?? [];
                    return (
                      <div
                        key={dateKey}
                        className={`border-r border-b p-1 ${todayDay ? "bg-primary/5" : ""}`}
                      >
                        <span className={`text-xs font-medium ${todayDay ? "bg-primary text-primary-foreground rounded-full w-6 h-6 flex items-center justify-center" : "text-muted-foreground"}`}>
                          {format(day, "d")}
                        </span>
                        <div className="mt-0.5 space-y-0.5 overflow-hidden">
                          {dayPractices.slice(0, 3).map((p) => (
                            <div
                              key={p.id}
                              onClick={() => setSelectedPractice(p)}
                              className={`text-[10px] truncate rounded px-1 py-0.5 border cursor-pointer hover:opacity-80 ${
                                p.status === "canceled"
                                  ? "bg-secondary/30 border-border text-muted-foreground opacity-60 line-through"
                                  : getPracticeColor(p.color)
                              }`}
                              title={`${p.status === "canceled" ? "CANCELED: " : ""}${formatTime(p.start_time) ? formatTime(p.start_time) + " · " : ""}${p.title || "Practice"}`}
                            >
                              {p.status === "canceled"
                                ? <span className="not-italic">✕ </span>
                                : formatTime(p.start_time) && <span className="font-bold">{formatTime(p.start_time)} </span>
                              }
                              {p.title || "Practice"}
                            </div>
                          ))}
                          {dayPractices.length > 3 && (
                            <div className="text-[10px] text-muted-foreground px-1">+{dayPractices.length - 3} more</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Sidebar — Upcoming */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-['Space_Grotesk'] flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" /> Upcoming (14 days)
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4">
              {upcomingPractices.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No sessions scheduled.</p>
              ) : (
                <div className="space-y-2">
                  {upcomingPractices.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => setSelectedPractice(p)}
                      className={`w-full text-left rounded-lg border p-2.5 hover:bg-secondary/50 transition-colors ${p.status === "canceled" ? "opacity-60" : ""}`}
                    >
                      <div className="flex items-center gap-2">
                        {p.status === "canceled" ? (
                          <span className="text-[10px] font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded px-1.5 py-0.5 shrink-0">CANCELED</span>
                        ) : (
                          <span className={`w-2 h-2 rounded-full shrink-0 ${getPracticeColor(p.color).split(" ")[0]}`} />
                        )}
                        <p className={`text-xs font-medium truncate ${p.status === "canceled" ? "line-through text-muted-foreground" : ""}`}>{p.title || "Practice"}</p>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 pl-4">
                        {format(parseISO(p.scheduled_date), "EEE, MMM d")}
                        {p.status !== "canceled" && formatTime(p.start_time) && (
                          <span className="font-semibold text-foreground"> · {formatTime(p.start_time)}</span>
                        )}
                        {p.status !== "canceled" && formatTime(p.end_time) && (
                          <span> – {formatTime(p.end_time)}</span>
                        )}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Practice detail dialog (read-only) */}
      <Dialog open={!!selectedPractice} onOpenChange={(o) => !o && setSelectedPractice(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk'] flex items-center gap-2">
              {selectedPractice?.status === "canceled" && (
                <span className="text-xs font-semibold text-red-400 bg-red-400/10 border border-red-400/20 rounded px-1.5 py-0.5">CANCELED</span>
              )}
              <span className={selectedPractice?.status === "canceled" ? "line-through text-muted-foreground" : ""}>{selectedPractice?.title || "Practice"}</span>
            </DialogTitle>
          </DialogHeader>
          {selectedPractice && (
            <div className="space-y-3 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4 shrink-0" />
                <span>
                  {format(parseISO(selectedPractice.scheduled_date), "EEEE, MMMM d")}
                  {formatTime(selectedPractice.start_time) && (
                    <span className="font-semibold text-foreground"> · {formatTime(selectedPractice.start_time)}</span>
                  )}
                  {formatTime(selectedPractice.end_time) && (
                    <span className="text-foreground"> – {formatTime(selectedPractice.end_time)}</span>
                  )}
                </span>
              </div>
              {selectedPractice.notes && (
                <p className="text-sm text-muted-foreground rounded-lg bg-secondary/30 p-3">{selectedPractice.notes}</p>
              )}
              {!selectedPractice.notes && !formatTime(selectedPractice.start_time) && (
                <p className="text-sm text-muted-foreground">No additional details.</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => setSelectedPractice(null)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AthleteSchedule;
