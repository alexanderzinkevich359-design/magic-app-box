import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { startOfWeek, format, isSameDay } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Collapsible, CollapsibleContent, CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  CheckCircle2, Circle, Plus, Trash2, ChevronDown, ChevronRight, ListChecks,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface WeeklyGoal {
  id: string;
  athlete_user_id: string;
  week_start: string;
  title: string;
  description: string | null;
  completed: boolean;
  created_at: string;
}

interface Props {
  /** Pass the athlete's user_id when rendering from the coach view */
  athleteId?: string;
  /** If true, disables all write controls (coach read-only view) */
  viewOnly?: boolean;
}

/** Monday of the given date's week */
function getWeekStart(d: Date): Date {
  return startOfWeek(d, { weekStartsOn: 1 });
}

function formatWeekLabel(weekStartStr: string, currentWeekStart: Date): string {
  const d = new Date(weekStartStr + "T12:00:00");
  if (isSameDay(d, currentWeekStart)) return "This Week";
  return `Week of ${format(d, "MMM d, yyyy")}`;
}

const AthleteWeeklyGoals = ({ athleteId, viewOnly = false }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // In athlete view, target is self; in coach view, use the passed athleteId
  const targetId = athleteId ?? user?.id;

  const currentWeekStart = getWeekStart(new Date());
  const currentWeekStr = format(currentWeekStart, "yyyy-MM-dd");

  const [addingGoal, setAddingGoal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [openWeeks, setOpenWeeks] = useState<Set<string>>(new Set());

  const toggleWeekOpen = (ws: string) =>
    setOpenWeeks((prev) => {
      const next = new Set(prev);
      next.has(ws) ? next.delete(ws) : next.add(ws);
      return next;
    });

  // ── Queries ──────────────────────────────────────────────────────────────────

  const { data: goals = [], isLoading } = useQuery<WeeklyGoal[]>({
    queryKey: ["athlete-weekly-goals", targetId],
    queryFn: async () => {
      if (!targetId) return [];
      const { data, error } = await (supabase as any)
        .from("athlete_weekly_goals")
        .select("*")
        .eq("athlete_user_id", targetId)
        .order("week_start", { ascending: false })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!targetId,
  });

  // Group by week_start
  const goalsByWeek = goals.reduce<Record<string, WeeklyGoal[]>>((acc, g) => {
    (acc[g.week_start] ??= []).push(g);
    return acc;
  }, {});

  // Ensure current week always appears (even if empty)
  if (!goalsByWeek[currentWeekStr]) {
    goalsByWeek[currentWeekStr] = [];
  }

  // Weeks in descending order; current week first
  const weeks = Object.keys(goalsByWeek).sort((a, b) => b.localeCompare(a));
  const pastWeeks = weeks.filter((w) => w !== currentWeekStr);

  // ── Mutations (athlete-only) ─────────────────────────────────────────────────

  const addGoal = useMutation({
    mutationFn: async () => {
      if (!targetId || !newTitle.trim()) return;
      const { error } = await (supabase as any)
        .from("athlete_weekly_goals")
        .insert({
          athlete_user_id: targetId,
          week_start: currentWeekStr,
          title: newTitle.trim(),
          description: newDesc.trim() || null,
          completed: false,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-weekly-goals", targetId] });
      setNewTitle("");
      setNewDesc("");
      setAddingGoal(false);
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleGoal = useMutation({
    mutationFn: async ({ id, completed }: { id: string; completed: boolean }) => {
      const { error } = await (supabase as any)
        .from("athlete_weekly_goals")
        .update({ completed })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["athlete-weekly-goals", targetId] }),
  });

  const deleteGoal = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any)
        .from("athlete_weekly_goals")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ["athlete-weekly-goals", targetId] }),
  });

  // ── Render helpers ────────────────────────────────────────────────────────────

  const renderGoal = (goal: WeeklyGoal, isCurrentWeek: boolean) => {
    const canInteract = isCurrentWeek && !viewOnly;
    return (
      <div
        key={goal.id}
        className="flex items-start gap-3 py-2.5 border-b last:border-b-0"
      >
        {canInteract ? (
          <button
            onClick={() => toggleGoal.mutate({ id: goal.id, completed: !goal.completed })}
            className="shrink-0 mt-0.5 text-muted-foreground hover:text-primary transition-colors"
          >
            {goal.completed ? (
              <CheckCircle2 className="h-4.5 w-4.5 text-emerald-400" />
            ) : (
              <Circle className="h-4.5 w-4.5" />
            )}
          </button>
        ) : (
          <span className="shrink-0 mt-0.5">
            {goal.completed ? (
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            ) : (
              <Circle className="h-4 w-4 text-muted-foreground" />
            )}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <p className={`text-sm leading-tight ${goal.completed ? "line-through text-muted-foreground" : ""}`}>
            {goal.title}
          </p>
          {goal.description && (
            <p className="text-xs text-muted-foreground mt-0.5">{goal.description}</p>
          )}
        </div>

        {canInteract && (
          <button
            onClick={() => deleteGoal.mutate(goal.id)}
            className="shrink-0 text-muted-foreground hover:text-red-400 transition-colors mt-0.5"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    );
  };

  const completedCount = (goalsByWeek[currentWeekStr] ?? []).filter((g) => g.completed).length;
  const totalCount = (goalsByWeek[currentWeekStr] ?? []).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ListChecks className="h-4 w-4 text-primary" />
            <CardTitle className="text-base font-['Space_Grotesk']">
              Weekly Goals
            </CardTitle>
            {totalCount > 0 && (
              <Badge variant="secondary" className="text-xs">
                {completedCount}/{totalCount}
              </Badge>
            )}
          </div>
          {!viewOnly && !addingGoal && (
            <Button
              size="sm"
              variant="outline"
              className="h-7 gap-1 text-xs"
              onClick={() => setAddingGoal(true)}
            >
              <Plus className="h-3.5 w-3.5" /> Add Goal
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-0 space-y-3">
        {/* Current week goals */}
        {isLoading ? (
          <p className="text-xs text-muted-foreground py-2">Loading…</p>
        ) : (goalsByWeek[currentWeekStr] ?? []).length === 0 && !addingGoal ? (
          <p className="text-xs text-muted-foreground py-2">
            {viewOnly ? "No goals set for this week." : "No goals yet — add your first goal for the week."}
          </p>
        ) : (
          <div>
            {(goalsByWeek[currentWeekStr] ?? []).map((g) => renderGoal(g, true))}
          </div>
        )}

        {/* Add goal form (current week only, athlete view only) */}
        {!viewOnly && addingGoal && (
          <div className="space-y-2 pt-1">
            <Input
              placeholder="Goal title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              className="h-8 text-sm"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter" && newTitle.trim()) addGoal.mutate();
                if (e.key === "Escape") {
                  setAddingGoal(false);
                  setNewTitle("");
                  setNewDesc("");
                }
              }}
            />
            <Textarea
              placeholder="Description (optional)…"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              className="text-sm min-h-[60px]"
            />
            <div className="flex gap-2">
              <Button
                size="sm"
                disabled={!newTitle.trim() || addGoal.isPending}
                onClick={() => addGoal.mutate()}
                className="h-7 text-xs"
              >
                Save
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-7 text-xs"
                onClick={() => {
                  setAddingGoal(false);
                  setNewTitle("");
                  setNewDesc("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Past weeks — collapsible history */}
        {pastWeeks.length > 0 && (
          <div className="pt-2 border-t space-y-1">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wide font-medium px-0.5">
              Previous Weeks
            </p>
            {pastWeeks.map((ws) => {
              const weekGoals = goalsByWeek[ws] ?? [];
              const done = weekGoals.filter((g) => g.completed).length;
              const isOpen = openWeeks.has(ws);
              return (
                <Collapsible key={ws} open={isOpen} onOpenChange={() => toggleWeekOpen(ws)}>
                  <CollapsibleTrigger className="w-full flex items-center justify-between py-2 text-left hover:text-foreground transition-colors group">
                    <span className="text-xs text-muted-foreground group-hover:text-foreground">
                      {formatWeekLabel(ws, currentWeekStart)}
                    </span>
                    <div className="flex items-center gap-2">
                      {weekGoals.length > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {done}/{weekGoals.length} done
                        </span>
                      )}
                      {isOpen ? (
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                      ) : (
                        <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                      )}
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent>
                    {weekGoals.length === 0 ? (
                      <p className="text-xs text-muted-foreground pb-2 pl-1">No goals that week.</p>
                    ) : (
                      <div className="pb-1">
                        {weekGoals.map((g) => renderGoal(g, false))}
                      </div>
                    )}
                  </CollapsibleContent>
                </Collapsible>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default AthleteWeeklyGoals;
