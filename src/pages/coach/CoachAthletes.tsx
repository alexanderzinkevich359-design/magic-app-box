import { useState } from "react";
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
import { Users, Plus, StickyNote, Target, ChevronRight, Loader2, Sparkles, Dumbbell, Trash2, Video } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

const POSITIONS = ["Pitcher", "Catcher", "Infielder", "Outfielder", "Hitter"] as const;
type Position = (typeof POSITIONS)[number];
const HANDS = ["Right", "Left", "Switch"] as const;

type AthleteWithDetails = {
  id: string;
  athlete_user_id: string;
  sport_id: string;
  position?: string;
  throw_hand?: string | null;
  bat_hand?: string | null;
  profile: { first_name: string; last_name: string; avatar_url: string | null } | null;
  notes: { id: string; note: string; created_at: string }[];
  goals: { id: string; title: string; target: string; progress: number; deadline: string | null; completed_at: string | null }[];
  assignedPrograms: { id: string; program_id: string; status: string; program: { id: string; name: string; description: string | null } | null }[];
};

const CoachAthletes = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [showAssignProgram, setShowAssignProgram] = useState(false);

  // Add athlete form
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPosition, setNewPosition] = useState<Position | "">("");
  const [newThrowHand, setNewThrowHand] = useState("");
  const [newBatHand, setNewBatHand] = useState("");

  // Note form
  const [noteText, setNoteText] = useState("");

  // Goal form
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");

  // Program assignment
  const [selectedProgramId, setSelectedProgramId] = useState("");

  // Fetch athletes linked to this coach
  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ["coach-athletes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links, error } = await supabase
        .from("coach_athlete_links")
        .select("id, athlete_user_id, sport_id, position, throw_hand, bat_hand")
        .eq("coach_user_id", user.id);
      if (error) throw error;
      if (!links?.length) return [];

      const athleteIds = links.map((l) => l.athlete_user_id);
      const [profilesRes, notesRes, goalsRes, programsRes] = await Promise.all([
        supabase.from("profiles").select("user_id, first_name, last_name, avatar_url").in("user_id", athleteIds),
        supabase.from("coach_notes").select("id, athlete_id, note, created_at").eq("coach_id", user.id).in("athlete_id", athleteIds).order("created_at", { ascending: false }),
        supabase.from("athlete_goals").select("id, athlete_id, title, target, progress, deadline, completed_at").in("athlete_id", athleteIds),
        supabase.from("athlete_programs").select("id, athlete_id, program_id, status, program:programs(id, name, description)").in("athlete_id", athleteIds),
      ]);

      return links.map((link) => ({
        id: link.id,
        athlete_user_id: link.athlete_user_id,
        sport_id: link.sport_id || "",
        position: link.position,
        throw_hand: link.throw_hand,
        bat_hand: link.bat_hand,
        profile: profilesRes.data?.find((p) => p.user_id === link.athlete_user_id) || null,
        notes: notesRes.data?.filter((n) => n.athlete_id === link.athlete_user_id) || [],
        goals: goalsRes.data?.filter((g) => g.athlete_id === link.athlete_user_id) || [],
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

  // Mutations
  const addNoteMutation = useMutation({
    mutationFn: async ({ athleteId, note }: { athleteId: string; note: string }) => {
      const { error } = await supabase.from("coach_notes").insert({ coach_id: user!.id, athlete_id: athleteId, note });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setNoteText("");
      toast({ title: "Note added" });
    },
  });

  const addGoalMutation = useMutation({
    mutationFn: async ({ athleteId, title, target, deadline }: { athleteId: string; title: string; target: string; deadline: string }) => {
      const { error } = await supabase.from("athlete_goals").insert({ athlete_id: athleteId, coach_id: user!.id, title, target, deadline: deadline || null });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      setGoalTitle(""); setGoalTarget(""); setGoalDeadline("");
      setShowGoalForm(false);
      toast({ title: "Goal set" });
    },
  });

  const updateProgressMutation = useMutation({
    mutationFn: async ({ goalId, progress }: { goalId: string; progress: number }) => {
      const { error } = await supabase.from("athlete_goals").update({ progress }).eq("id", goalId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-athletes"] }),
  });

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

  const updateHandDominance = useMutation({
    mutationFn: async ({ linkId, throwHand, batHand }: { linkId: string; throwHand: string; batHand: string }) => {
      const { error } = await supabase.from("coach_athlete_links").update({
        throw_hand: throwHand || null,
        bat_hand: batHand || null,
      }).eq("id", linkId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      toast({ title: "Hand dominance updated" });
    },
  });

  const addAthleteByEmail = useMutation({
    mutationFn: async () => {
      if (!user || !newEmail || !newPosition) throw new Error("Missing fields");
      const { data: authUsers } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .or(`first_name.ilike.%${newFirstName}%,last_name.ilike.%${newLastName}%`);
      if (!authUsers?.length) throw new Error("Athlete not found. They need to create an account first.");

      const athleteUser = authUsers[0];
      const { data: sportData } = await supabase.from("sports").select("id").eq("slug", "baseball").single();

      const { error } = await supabase.from("coach_athlete_links").insert({
        coach_user_id: user.id,
        athlete_user_id: athleteUser.user_id,
        sport_id: sportData?.id || null,
        position: newPosition,
        throw_hand: newThrowHand || null,
        bat_hand: newBatHand || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-athletes"] });
      resetAddForm();
      toast({ title: "Athlete linked!" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

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
        <Button onClick={() => setShowAddDialog(true)}>
          <Plus className="h-4 w-4 mr-2" /> Add Athlete
        </Button>
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
            <p className="text-muted-foreground text-sm mt-1 mb-4">Link athletes to your roster to start coaching</p>
            <Button onClick={() => setShowAddDialog(true)}><Plus className="h-4 w-4 mr-2" /> Add Athlete</Button>
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
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                      {athlete.profile ? `${athlete.profile.first_name[0]}${athlete.profile.last_name[0]}` : "??"}
                    </div>
                    <div>
                      <p className="font-medium">
                        {athlete.profile ? `${athlete.profile.first_name} ${athlete.profile.last_name}` : "Unknown"}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-sm text-muted-foreground">{athlete.position || "No position"}</span>
                        {athlete.throw_hand && (
                          <Badge variant="outline" className="text-[10px]">Throws: {athlete.throw_hand}</Badge>
                        )}
                        {athlete.bat_hand && (
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

      {/* Add Athlete Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(open) => !open && resetAddForm()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Add Athlete</DialogTitle>
            <DialogDescription>Link an existing athlete to your roster</DialogDescription>
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
            <div className="space-y-2">
              <Label>Position</Label>
              <Select value={newPosition} onValueChange={(v) => setNewPosition(v as Position)}>
                <SelectTrigger><SelectValue placeholder="Select position..." /></SelectTrigger>
                <SelectContent>
                  {POSITIONS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Throwing Hand</Label>
                <Select value={newThrowHand} onValueChange={setNewThrowHand}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {HANDS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Batting Hand</Label>
                <Select value={newBatHand} onValueChange={setNewBatHand}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {HANDS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetAddForm}>Cancel</Button>
            <Button onClick={() => addAthleteByEmail.mutate()} disabled={!newPosition || !newFirstName || addAthleteByEmail.isPending}>
              {addAthleteByEmail.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Add Athlete
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
                <DialogTitle className="font-['Space_Grotesk'] text-xl">
                  {selectedAthlete.profile ? `${selectedAthlete.profile.first_name} ${selectedAthlete.profile.last_name}` : "Athlete"}
                </DialogTitle>
                <DialogDescription>
                  {selectedAthlete.position || "Baseball"} 
                  {selectedAthlete.throw_hand && ` · Throws: ${selectedAthlete.throw_hand}`}
                  {selectedAthlete.bat_hand && ` · Bats: ${selectedAthlete.bat_hand}`}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="overview" className="mt-2">
                <TabsList className="w-full">
                  <TabsTrigger value="overview" className="flex-1 gap-2">
                    <Target className="h-3.5 w-3.5" /> Overview
                  </TabsTrigger>
                  <TabsTrigger value="workouts" className="flex-1 gap-2">
                    <Dumbbell className="h-3.5 w-3.5" /> At-Home Workouts
                  </TabsTrigger>
                  <TabsTrigger value="notes" className="flex-1 gap-2">
                    <StickyNote className="h-3.5 w-3.5" /> Notes
                  </TabsTrigger>
                </TabsList>

                {/* Overview Tab — Goals & Hand Dominance */}
                <TabsContent value="overview" className="space-y-4 mt-4">
                  {/* Hand dominance edit */}
                  <Card>
                    <CardHeader className="py-3 px-4">
                      <CardTitle className="text-sm">Hand Dominance</CardTitle>
                    </CardHeader>
                    <CardContent className="px-4 pb-4">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-xs">Throwing Hand</Label>
                          <Select
                            value={selectedAthlete.throw_hand || ""}
                            onValueChange={(v) => updateHandDominance.mutate({
                              linkId: selectedAthlete.id,
                              throwHand: v,
                              batHand: selectedAthlete.bat_hand || "",
                            })}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="Set..." /></SelectTrigger>
                            <SelectContent>
                              {HANDS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Batting Hand</Label>
                          <Select
                            value={selectedAthlete.bat_hand || ""}
                            onValueChange={(v) => updateHandDominance.mutate({
                              linkId: selectedAthlete.id,
                              throwHand: selectedAthlete.throw_hand || "",
                              batHand: v,
                            })}
                          >
                            <SelectTrigger className="h-8"><SelectValue placeholder="Set..." /></SelectTrigger>
                            <SelectContent>
                              {HANDS.map((h) => <SelectItem key={h} value={h}>{h}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Goals */}
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Goals</h3>
                    {!showGoalForm && (
                      <Button onClick={() => setShowGoalForm(true)} size="sm" variant="outline">
                        <Plus className="h-3.5 w-3.5 mr-1" /> Set Goal
                      </Button>
                    )}
                  </div>
                  {showGoalForm && (
                    <Card>
                      <CardContent className="p-4 space-y-3">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Goal Title</Label>
                            <Input placeholder="e.g. Increase exit velocity" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Target</Label>
                            <Input placeholder="e.g. 90 mph" value={goalTarget} onChange={(e) => setGoalTarget(e.target.value)} />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-xs">Deadline</Label>
                          <Input type="date" value={goalDeadline} onChange={(e) => setGoalDeadline(e.target.value)} />
                        </div>
                        <div className="flex gap-2">
                          <Button
                            onClick={() => addGoalMutation.mutate({ athleteId: selectedAthlete.athlete_user_id, title: goalTitle, target: goalTarget, deadline: goalDeadline })}
                            size="sm" disabled={!goalTitle.trim() || !goalTarget.trim() || addGoalMutation.isPending}
                          >
                            {addGoalMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                            Save Goal
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
                              <p className="text-xs text-muted-foreground">Target: {goal.target} · Deadline: {goal.deadline || "TBD"}</p>
                            </div>
                            <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                          </div>
                          <Progress value={goal.progress} className="h-2" />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min={0} max={100} value={goal.progress}
                              onChange={(e) => updateProgressMutation.mutate({ goalId: goal.id, progress: parseInt(e.target.value) || 0 })}
                              className="w-20 h-8 text-xs"
                            />
                            <span className="text-xs text-muted-foreground">% complete</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </TabsContent>

                {/* At-Home Workouts Tab */}
                <TabsContent value="workouts" className="space-y-4 mt-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-sm font-semibold">Assigned Programs</h3>
                    <Button size="sm" variant="outline" onClick={() => setShowAssignProgram(true)}>
                      <Plus className="h-3.5 w-3.5 mr-1" /> Assign Workout
                    </Button>
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
                </TabsContent>

                {/* Notes Tab */}
                <TabsContent value="notes" className="space-y-4 mt-4">
                  <div className="space-y-2">
                    <Label>Add Private Note</Label>
                    <Textarea placeholder="Performance notes, areas to improve..." value={noteText} onChange={(e) => setNoteText(e.target.value)} className="min-h-[80px]" />
                    <Button onClick={() => addNoteMutation.mutate({ athleteId: selectedAthlete.athlete_user_id, note: noteText })} disabled={!noteText.trim() || addNoteMutation.isPending} size="sm">
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
                          <p className="text-xs text-muted-foreground mt-2">{new Date(note.created_at).toLocaleDateString()} · Private</p>
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

export default CoachAthletes;
