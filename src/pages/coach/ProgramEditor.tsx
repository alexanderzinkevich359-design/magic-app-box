import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, Plus, Trash2, GripVertical, Clock } from "lucide-react";
import { toast } from "sonner";

const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

const ProgramEditor = () => {
  const { programId } = useParams<{ programId: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  // Workout creation state
  const [showWorkoutForm, setShowWorkoutForm] = useState(false);
  const [workoutTitle, setWorkoutTitle] = useState("");
  const [workoutDesc, setWorkoutDesc] = useState("");
  const [workoutDuration, setWorkoutDuration] = useState("");

  // Drill creation state
  const [drillWorkoutId, setDrillWorkoutId] = useState<string | null>(null);
  const [drillName, setDrillName] = useState("");
  const [drillInstructions, setDrillInstructions] = useState("");
  const [drillDifficulty, setDrillDifficulty] = useState("beginner");
  const [drillRepScheme, setDrillRepScheme] = useState("");
  const [drillEquipment, setDrillEquipment] = useState("");
  const [drillCoachingCues, setDrillCoachingCues] = useState("");
  const [drillSkillCategory, setDrillSkillCategory] = useState("");
  const [drillVideoUrl, setDrillVideoUrl] = useState("");

  const { data: program, isLoading } = useQuery({
    queryKey: ["program", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*")
        .eq("id", programId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!programId,
  });

  const { data: workouts } = useQuery({
    queryKey: ["workouts", programId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("workouts")
        .select("*, drills(*)")
        .eq("program_id", programId!)
        .order("order_index")
        .order("order_index", { referencedTable: "drills" });
      if (error) throw error;
      return data;
    },
    enabled: !!programId,
  });

  const addWorkout = useMutation({
    mutationFn: async () => {
      const nextIndex = (workouts?.length ?? 0);
      const { error } = await supabase.from("workouts").insert({
        program_id: programId!,
        title: workoutTitle.trim(),
        description: workoutDesc.trim() || null,
        estimated_duration_min: workoutDuration ? parseInt(workoutDuration) : null,
        order_index: nextIndex,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts", programId] });
      setShowWorkoutForm(false);
      setWorkoutTitle(""); setWorkoutDesc(""); setWorkoutDuration("");
      toast.success("Workout added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteWorkout = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("workouts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts", programId] });
      toast.success("Workout removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const addDrill = useMutation({
    mutationFn: async () => {
      if (!drillWorkoutId) return;
      const workout = workouts?.find((w: any) => w.id === drillWorkoutId);
      const nextIndex = workout?.drills?.length ?? 0;
      const { error } = await supabase.from("drills").insert({
        workout_id: drillWorkoutId,
        name: drillName.trim(),
        instructions: drillInstructions.trim() || null,
        difficulty: drillDifficulty,
        rep_scheme: drillRepScheme.trim() || null,
        equipment: drillEquipment.trim() || null,
        coaching_cues: drillCoachingCues.trim() || null,
        skill_category: drillSkillCategory.trim() || null,
        video_url: drillVideoUrl.trim() || null,
        order_index: nextIndex,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts", programId] });
      closeDrillForm();
      toast.success("Drill added");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteDrill = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drills").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["workouts", programId] });
      toast.success("Drill removed");
    },
    onError: (e) => toast.error(e.message),
  });

  const togglePublish = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("programs")
        .update({ is_published: !program?.is_published })
        .eq("id", programId!);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["program", programId] });
      toast.success(program?.is_published ? "Unpublished" : "Published");
    },
    onError: (e) => toast.error(e.message),
  });

  const closeDrillForm = () => {
    setDrillWorkoutId(null);
    setDrillName(""); setDrillInstructions(""); setDrillDifficulty("beginner");
    setDrillRepScheme(""); setDrillEquipment(""); setDrillCoachingCues("");
    setDrillSkillCategory(""); setDrillVideoUrl("");
  };

  if (isLoading) return <DashboardLayout role="coach"><p className="text-muted-foreground py-12 text-center">Loading...</p></DashboardLayout>;
  if (!program) return <DashboardLayout role="coach"><p className="text-muted-foreground py-12 text-center">Program not found</p></DashboardLayout>;

  return (
    <DashboardLayout role="coach">
      <div className="mb-6">
        <Button variant="ghost" size="sm" onClick={() => navigate("/coach/programs")} className="mb-4">
          <ArrowLeft className="h-4 w-4 mr-1" /> Back to Programs
        </Button>
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">{program.name}</h1>
            {program.description && <p className="text-muted-foreground mt-1 max-w-xl">{program.description}</p>}
            <div className="flex flex-wrap gap-2 mt-2">
              <Badge variant="secondary" className="capitalize">{program.skill_level}</Badge>
              {program.duration_weeks && <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{program.duration_weeks}w</Badge>}
              {program.position_type && <Badge variant="outline">{program.position_type}</Badge>}
              <Badge variant={program.is_published ? "default" : "outline"}>
                {program.is_published ? "Published" : "Draft"}
              </Badge>
            </div>
          </div>
          <Button variant="outline" onClick={() => togglePublish.mutate()} disabled={togglePublish.isPending}>
            {program.is_published ? "Unpublish" : "Publish"}
          </Button>
        </div>
      </div>

      {/* Workouts */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold font-['Space_Grotesk']">Workouts</h2>
        <Button size="sm" onClick={() => setShowWorkoutForm(true)}>
          <Plus className="h-3.5 w-3.5 mr-1" /> Add Workout
        </Button>
      </div>

      {!workouts?.length ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">No workouts yet. Add your first workout to this program.</p>
          </CardContent>
        </Card>
      ) : (
        <Accordion type="multiple" className="space-y-3">
          {workouts.map((workout: any, idx: number) => (
            <AccordionItem key={workout.id} value={workout.id} className="border rounded-lg px-4">
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <span className="text-xs text-muted-foreground font-mono w-6">{idx + 1}</span>
                  <div>
                    <p className="font-medium">{workout.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {workout.drills?.length ?? 0} drills
                      {workout.estimated_duration_min && ` · ${workout.estimated_duration_min} min`}
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pb-4">
                {workout.description && <p className="text-sm text-muted-foreground mb-4">{workout.description}</p>}

                {/* Drills list */}
                <div className="space-y-2 mb-3">
                  {workout.drills?.map((drill: any, dIdx: number) => (
                    <div key={drill.id} className="flex items-start justify-between rounded-md border bg-secondary/30 p-3">
                      <div className="flex gap-3">
                        <span className="text-xs text-muted-foreground font-mono mt-0.5">{dIdx + 1}</span>
                        <div>
                          <p className="text-sm font-medium">{drill.name}</p>
                          <div className="flex flex-wrap gap-1.5 mt-1">
                            <Badge variant="outline" className="text-[10px] capitalize">{drill.difficulty}</Badge>
                            {drill.rep_scheme && <Badge variant="outline" className="text-[10px]">{drill.rep_scheme}</Badge>}
                            {drill.skill_category && <Badge variant="outline" className="text-[10px]">{drill.skill_category}</Badge>}
                            {drill.equipment && <Badge variant="outline" className="text-[10px]">{drill.equipment}</Badge>}
                          </div>
                          {drill.instructions && <p className="text-xs text-muted-foreground mt-1.5">{drill.instructions}</p>}
                          {drill.coaching_cues && <p className="text-xs text-muted-foreground mt-1 italic">💡 {drill.coaching_cues}</p>}
                        </div>
                      </div>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive shrink-0"
                        onClick={() => deleteDrill.mutate(drill.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="flex gap-2">
                  <Button size="sm" variant="outline" onClick={() => setDrillWorkoutId(workout.id)}>
                    <Plus className="h-3 w-3 mr-1" /> Add Drill
                  </Button>
                  <Button
                    size="sm" variant="ghost" className="text-destructive hover:text-destructive"
                    onClick={() => deleteWorkout.mutate(workout.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" /> Remove Workout
                  </Button>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      )}

      {/* Add Workout Dialog */}
      <Dialog open={showWorkoutForm} onOpenChange={setShowWorkoutForm}>
        <DialogContent>
          <DialogHeader><DialogTitle className="font-['Space_Grotesk']">Add Workout</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Title</Label>
              <Input placeholder="e.g. Day 1 — Arm Care & Long Toss" value={workoutTitle} onChange={(e) => setWorkoutTitle(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description (optional)</Label>
              <Textarea placeholder="Focus areas, warm-up notes..." value={workoutDesc} onChange={(e) => setWorkoutDesc(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Estimated Duration (min)</Label>
              <Input type="number" min={1} placeholder="e.g. 45" value={workoutDuration} onChange={(e) => setWorkoutDuration(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowWorkoutForm(false)}>Cancel</Button>
            <Button onClick={() => addWorkout.mutate()} disabled={!workoutTitle.trim() || addWorkout.isPending}>
              {addWorkout.isPending ? "Adding..." : "Add Workout"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Drill Dialog */}
      <Dialog open={!!drillWorkoutId} onOpenChange={(open) => !open && closeDrillForm()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="font-['Space_Grotesk']">Add Drill</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Drill Name</Label>
              <Input placeholder="e.g. Band Pull-Aparts" value={drillName} onChange={(e) => setDrillName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Instructions</Label>
              <Textarea placeholder="Step-by-step instructions..." value={drillInstructions} onChange={(e) => setDrillInstructions(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Difficulty</Label>
                <Select value={drillDifficulty} onValueChange={setDrillDifficulty}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTIES.map((d) => <SelectItem key={d} value={d} className="capitalize">{d}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Rep Scheme</Label>
                <Input placeholder="e.g. 3x10" value={drillRepScheme} onChange={(e) => setDrillRepScheme(e.target.value)} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Skill Category</Label>
                <Input placeholder="e.g. Arm care" value={drillSkillCategory} onChange={(e) => setDrillSkillCategory(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Equipment</Label>
                <Input placeholder="e.g. Resistance band" value={drillEquipment} onChange={(e) => setDrillEquipment(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Coaching Cues</Label>
              <Textarea placeholder="Key tips for the athlete..." value={drillCoachingCues} onChange={(e) => setDrillCoachingCues(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Video URL (optional)</Label>
              <Input placeholder="https://youtube.com/..." value={drillVideoUrl} onChange={(e) => setDrillVideoUrl(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeDrillForm}>Cancel</Button>
            <Button onClick={() => addDrill.mutate()} disabled={!drillName.trim() || addDrill.isPending}>
              {addDrill.isPending ? "Adding..." : "Add Drill"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default ProgramEditor;
