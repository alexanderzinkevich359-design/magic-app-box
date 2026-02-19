import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, StickyNote, Target, ChevronRight, Calendar, TrendingUp, Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";

const CoachDashboard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [noteText, setNoteText] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  // Fetch linked athletes with their profiles
  const { data: athletes = [], isLoading: loadingAthletes } = useQuery({
    queryKey: ["coach-athletes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links, error } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id, sport_id")
        .eq("coach_user_id", user.id);
      if (error) throw error;
      if (!links.length) return [];

      const athleteIds = links.map((l) => l.athlete_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, date_of_birth")
        .in("user_id", athleteIds);

      return (profiles || []).map((p) => ({
        id: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim() || "Unknown",
        age: p.date_of_birth ? Math.floor((Date.now() - new Date(p.date_of_birth).getTime()) / 31557600000) : null,
      }));
    },
    enabled: !!user,
  });

  // Fetch notes for all linked athletes
  const { data: allNotes = [] } = useQuery({
    queryKey: ["coach-notes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("coach_notes")
        .select("*")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  // Fetch goals for all linked athletes
  const { data: allGoals = [] } = useQuery({
    queryKey: ["coach-goals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await supabase
        .from("athlete_goals")
        .select("*")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const selectedAthlete = athletes.find((a) => a.id === selectedAthleteId) || null;
  const selectedNotes = allNotes.filter((n) => n.athlete_id === selectedAthleteId);
  const selectedGoals = allGoals.filter((g) => g.athlete_id === selectedAthleteId);

  // Add note mutation
  const addNoteMut = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAthleteId || !noteText.trim()) return;
      const { error } = await supabase.from("coach_notes").insert({
        coach_id: user.id,
        athlete_id: selectedAthleteId,
        note: noteText.trim(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setNoteText("");
      queryClient.invalidateQueries({ queryKey: ["coach-notes"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Add goal mutation
  const addGoalMut = useMutation({
    mutationFn: async () => {
      if (!user || !selectedAthleteId || !goalTitle.trim() || !goalTarget.trim()) return;
      const { error } = await supabase.from("athlete_goals").insert({
        coach_id: user.id,
        athlete_id: selectedAthleteId,
        title: goalTitle.trim(),
        target: goalTarget.trim(),
        deadline: goalDeadline || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setGoalTitle(""); setGoalTarget(""); setGoalDeadline(""); setShowGoalForm(false);
      queryClient.invalidateQueries({ queryKey: ["coach-goals"] });
    },
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Update goal progress mutation
  const updateProgressMut = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const clamped = Math.min(100, Math.max(0, progress));
      const { error } = await supabase
        .from("athlete_goals")
        .update({ progress: clamped })
        .eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-goals"] }),
    onError: (e: Error) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const totalGoals = allGoals.length;

  return (
    <DashboardLayout role="coach">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Coach Dashboard</h1>
        <p className="text-muted-foreground mt-1">Manage your athletes, add notes, and set goals</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {[
          { label: "Athletes", value: athletes.length, icon: Users },
          { label: "Active Goals", value: totalGoals, icon: Target },
          { label: "Total Notes", value: allNotes.length, icon: StickyNote },
          { label: "Avg Progress", value: totalGoals ? Math.round(allGoals.reduce((s, g) => s + g.progress, 0) / totalGoals) + "%" : "—", icon: TrendingUp },
        ].map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <stat.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold font-['Space_Grotesk']">{stat.value}</p>
                <p className="text-xs text-muted-foreground">{stat.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Athlete roster */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Space_Grotesk']">Athlete Roster</CardTitle>
          <CardDescription>
            {athletes.length > 0
              ? "Click an athlete to manage notes and goals"
              : "No athletes linked yet. Add athletes from the Athletes page."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loadingAthletes ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="space-y-2">
              {athletes.map((athlete) => {
                const notes = allNotes.filter((n) => n.athlete_id === athlete.id);
                const goals = allGoals.filter((g) => g.athlete_id === athlete.id);
                return (
                  <button
                    key={athlete.id}
                    onClick={() => setSelectedAthleteId(athlete.id)}
                    className="w-full flex items-center justify-between rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50"
                  >
                    <div className="flex items-center gap-4">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                        {athlete.name.split(" ").map((n) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="font-medium">{athlete.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {athlete.age ? `Age ${athlete.age}` : "Age unknown"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-muted-foreground">{notes.length} notes · {goals.length} goals</p>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Athlete detail dialog */}
      <Dialog open={!!selectedAthlete} onOpenChange={(open) => !open && setSelectedAthleteId(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAthlete && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Space_Grotesk'] text-xl">
                  {selectedAthlete.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedAthlete.age ? `Age ${selectedAthlete.age}` : "Age unknown"}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="notes" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="notes" className="flex-1 gap-2">
                    <StickyNote className="h-3.5 w-3.5" /> Coach Notes
                  </TabsTrigger>
                  <TabsTrigger value="goals" className="flex-1 gap-2">
                    <Target className="h-3.5 w-3.5" /> Goals
                  </TabsTrigger>
                </TabsList>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Add Private Note</Label>
                    <Textarea
                      placeholder="Write a note about this athlete's performance..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button onClick={() => addNoteMut.mutate()} disabled={!noteText.trim() || addNoteMut.isPending} size="sm">
                      {addNoteMut.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Plus className="h-3.5 w-3.5 mr-1" />}
                      Add Note
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedNotes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No notes yet. Add your first note above.</p>
                    ) : (
                      selectedNotes.map((note) => (
                        <div key={note.id} className="rounded-lg border bg-secondary/30 p-4">
                          <p className="text-sm">{note.note}</p>
                          <p className="text-xs text-muted-foreground mt-2">{new Date(note.created_at).toLocaleDateString()} · Private</p>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* Goals Tab */}
                <TabsContent value="goals" className="space-y-4 mt-4">
                  {!showGoalForm ? (
                    <Button onClick={() => setShowGoalForm(true)} size="sm" variant="outline">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Set New Goal
                    </Button>
                  ) : (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Goal Title</Label>
                            <Input placeholder="e.g. Free throw accuracy" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target</Label>
                            <Input placeholder="e.g. 80%" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Deadline</Label>
                          <Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button onClick={() => addGoalMut.mutate()} size="sm" disabled={!goalTitle.trim() || !goalTarget.trim() || addGoalMut.isPending}>
                            {addGoalMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
                            Save Goal
                          </Button>
                          <Button onClick={() => setShowGoalForm(false)} size="sm" variant="ghost">Cancel</Button>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                  <div className="space-y-3">
                    {selectedGoals.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No goals set. Create one above.</p>
                    ) : (
                      selectedGoals.map((goal) => (
                        <div key={goal.id} className="rounded-lg border p-4 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <p className="font-medium text-sm">{goal.title}</p>
                              <p className="text-xs text-muted-foreground">Target: {goal.target} · Deadline: {goal.deadline || "None"}</p>
                            </div>
                            <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                          </div>
                          <Progress value={goal.progress} className="h-2" />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min={0} max={100}
                              value={goal.progress}
                              onChange={(e) => updateProgressMut.mutate({ goalId: goal.id, progress: parseInt(e.target.value) || 0 })}
                              className="w-20 h-8 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">% complete</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachDashboard;
