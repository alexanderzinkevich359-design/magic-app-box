import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Users, Plus, StickyNote, Target, ChevronRight, Calendar, TrendingUp } from "lucide-react";

type CoachNote = { id: string; text: string; date: string; private: boolean };
type AthleteGoal = { id: string; title: string; target: string; progress: number; deadline: string };
type Athlete = {
  id: string;
  name: string;
  age: number;
  sport: string;
  skillRating: number;
  notes: CoachNote[];
  goals: AthleteGoal[];
};

const initialAthletes: Athlete[] = [
  {
    id: "1", name: "Marcus Johnson", age: 15, sport: "Basketball", skillRating: 72,
    notes: [
      { id: "n1", text: "Great footwork improvement this week. Needs to work on left-hand dribbling.", date: "2026-02-10", private: true },
      { id: "n2", text: "Shows strong leadership qualities during drills.", date: "2026-02-08", private: true },
    ],
    goals: [
      { id: "g1", title: "Free throw accuracy", target: "80%", progress: 65, deadline: "2026-04-01" },
      { id: "g2", title: "Vertical jump", target: "28 inches", progress: 78, deadline: "2026-05-15" },
    ],
  },
  {
    id: "2", name: "Sofia Martinez", age: 14, sport: "Soccer", skillRating: 81,
    notes: [
      { id: "n3", text: "Exceptional ball control. Ready for advanced drills.", date: "2026-02-11", private: true },
    ],
    goals: [
      { id: "g3", title: "Sprint speed", target: "Sub 7s 50m", progress: 55, deadline: "2026-03-20" },
    ],
  },
  {
    id: "3", name: "Tyler Chen", age: 16, sport: "Swimming", skillRating: 68,
    notes: [],
    goals: [
      { id: "g4", title: "100m freestyle", target: "Under 58s", progress: 42, deadline: "2026-06-01" },
    ],
  },
];

const CoachDashboard = () => {
  const [athletes, setAthletes] = useState<Athlete[]>(initialAthletes);
  const [selectedAthlete, setSelectedAthlete] = useState<Athlete | null>(null);
  const [noteText, setNoteText] = useState("");
  const [goalTitle, setGoalTitle] = useState("");
  const [goalTarget, setGoalTarget] = useState("");
  const [goalDeadline, setGoalDeadline] = useState("");
  const [showGoalForm, setShowGoalForm] = useState(false);

  const addNote = () => {
    if (!selectedAthlete || !noteText.trim()) return;
    const newNote: CoachNote = {
      id: `n${Date.now()}`, text: noteText.trim(),
      date: new Date().toISOString().split("T")[0], private: true,
    };
    setAthletes((prev) =>
      prev.map((a) => a.id === selectedAthlete.id ? { ...a, notes: [newNote, ...a.notes] } : a)
    );
    setSelectedAthlete((prev) => prev ? { ...prev, notes: [newNote, ...prev.notes] } : null);
    setNoteText("");
  };

  const addGoal = () => {
    if (!selectedAthlete || !goalTitle.trim() || !goalTarget.trim()) return;
    const newGoal: AthleteGoal = {
      id: `g${Date.now()}`, title: goalTitle.trim(),
      target: goalTarget.trim(), progress: 0, deadline: goalDeadline || "TBD",
    };
    setAthletes((prev) =>
      prev.map((a) => a.id === selectedAthlete.id ? { ...a, goals: [...a.goals, newGoal] } : a)
    );
    setSelectedAthlete((prev) => prev ? { ...prev, goals: [...prev.goals, newGoal] } : null);
    setGoalTitle(""); setGoalTarget(""); setGoalDeadline(""); setShowGoalForm(false);
  };

  const updateGoalProgress = (goalId: string, progress: number) => {
    if (!selectedAthlete) return;
    const clamped = Math.min(100, Math.max(0, progress));
    setAthletes((prev) =>
      prev.map((a) =>
        a.id === selectedAthlete.id
          ? { ...a, goals: a.goals.map((g) => g.id === goalId ? { ...g, progress: clamped } : g) }
          : a
      )
    );
    setSelectedAthlete((prev) =>
      prev ? { ...prev, goals: prev.goals.map((g) => g.id === goalId ? { ...g, progress: clamped } : g) } : null
    );
  };

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
          { label: "Active Goals", value: athletes.reduce((s, a) => s + a.goals.length, 0), icon: Target },
          { label: "Sessions This Week", value: 8, icon: Calendar },
          { label: "Avg Skill Rating", value: Math.round(athletes.reduce((s, a) => s + a.skillRating, 0) / athletes.length), icon: TrendingUp },
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
          <CardDescription>Click an athlete to manage notes and goals</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {athletes.map((athlete) => (
              <button
                key={athlete.id}
                onClick={() => setSelectedAthlete(athlete)}
                className="w-full flex items-center justify-between rounded-lg border p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/50"
              >
                <div className="flex items-center gap-4">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                    {athlete.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium">{athlete.name}</p>
                    <p className="text-sm text-muted-foreground">{athlete.sport} · Age {athlete.age}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-medium">{athlete.skillRating}/100</p>
                    <p className="text-xs text-muted-foreground">{athlete.notes.length} notes · {athlete.goals.length} goals</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Athlete detail dialog */}
      <Dialog open={!!selectedAthlete} onOpenChange={(open) => !open && setSelectedAthlete(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          {selectedAthlete && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Space_Grotesk'] text-xl">
                  {selectedAthlete.name}
                </DialogTitle>
                <DialogDescription>
                  {selectedAthlete.sport} · Age {selectedAthlete.age} · Skill Rating: {selectedAthlete.skillRating}/100
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
                      placeholder="Write a note about this athlete's performance, areas to improve, etc..."
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      className="min-h-[80px]"
                    />
                    <Button onClick={addNote} disabled={!noteText.trim()} size="sm">
                      <Plus className="h-3.5 w-3.5 mr-1" /> Add Note
                    </Button>
                  </div>
                  <div className="space-y-3">
                    {selectedAthlete.notes.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-6">No notes yet. Add your first note above.</p>
                    ) : (
                      selectedAthlete.notes.map((note) => (
                        <div key={note.id} className="rounded-lg border bg-secondary/30 p-4">
                          <p className="text-sm">{note.text}</p>
                          <p className="text-xs text-muted-foreground mt-2">{note.date} · Private</p>
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
                          <Button onClick={addGoal} size="sm" disabled={!goalTitle.trim() || !goalTarget.trim()}>Save Goal</Button>
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
                              <p className="text-xs text-muted-foreground">Target: {goal.target} · Deadline: {goal.deadline}</p>
                            </div>
                            <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                          </div>
                          <Progress value={goal.progress} className="h-2" />
                          <div className="flex items-center gap-2">
                            <Input
                              type="number" min={0} max={100}
                              value={goal.progress}
                              onChange={(e) => updateGoalProgress(goal.id, parseInt(e.target.value) || 0)}
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
