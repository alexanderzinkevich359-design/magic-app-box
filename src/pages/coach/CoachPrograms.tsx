import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Dumbbell, ChevronRight, Clock, BarChart3 } from "lucide-react";
import { toast } from "sonner";

const DIFFICULTY_LEVELS = [1, 2, 3, 4, 5];

const CoachPrograms = () => {
  const { user, profile } = useAuth();
  const tier = profile?.tier ?? "free";
  const PROGRAM_LIMITS: Record<string, number> = { free: 1, basic: 5, max: Infinity };
  const programLimit = PROGRAM_LIMITS[tier] ?? 1;
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [difficultyLevel, setDifficultyLevel] = useState("1");
  const [durationWeeks, setDurationWeeks] = useState("");
  const [positionType, setPositionType] = useState("");

  const { data: sports } = useQuery({
    queryKey: ["sports"],
    queryFn: async () => {
      const { data, error } = await supabase.from("sports").select("id, name").eq("is_active", true);
      if (error) throw error;
      return data;
    },
  });

  const { data: programs, isLoading } = useQuery({
    queryKey: ["coach-programs", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("programs")
        .select("*, workouts(count)")
        .eq("coach_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const createProgram = useMutation({
    mutationFn: async () => {
      if (!sports?.length) throw new Error("No sports available");
      const { data, error } = await supabase.from("programs").insert({
        coach_id: user!.id,
        sport_id: sports[0].id,
        name: name.trim(),
        description: description.trim() || null,
        skill_level: difficultyLevel,
        duration_weeks: durationWeeks ? parseInt(durationWeeks) : null,
        position_type: positionType.trim() || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["coach-programs"] });
      setShowCreate(false);
      setName(""); setDescription(""); setDifficultyLevel("1"); setDurationWeeks(""); setPositionType("");
      toast.success("Program created");
      navigate(`/coach/programs/${data.id}`);
    },
    onError: (e) => toast.error(e.message),
  });

  return (
    <DashboardLayout role="coach">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Programs</h1>
          <p className="text-muted-foreground mt-1">Build and manage training programs</p>
        </div>
        <Button onClick={() => {
          if ((programs?.length ?? 0) >= programLimit) {
            toast.error(`Your ${tier} plan allows ${programLimit} program${programLimit === 1 ? "" : "s"}. Upgrade your plan to create more.`);
            return;
          }
          setShowCreate(true);
        }}>
          <Plus className="h-4 w-4 mr-1" /> New Program
        </Button>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-center py-12">Loading...</p>
      ) : !programs?.length ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Dumbbell className="h-12 w-12 mx-auto text-muted-foreground/40 mb-4" />
            <p className="text-lg font-medium">No programs yet</p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">Create your first training program to get started</p>
            <Button onClick={() => setShowCreate(true)}><Plus className="h-4 w-4 mr-1" /> Create Program</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {programs.map((program: any) => (
            <Card
              key={program.id}
              className="cursor-pointer transition-colors hover:border-primary/40"
              onClick={() => navigate(`/coach/programs/${program.id}`)}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg font-['Space_Grotesk']">{program.name}</CardTitle>
                  <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-1" />
                </div>
                {program.description && (
                  <CardDescription className="line-clamp-2">{program.description}</CardDescription>
                )}
              </CardHeader>
              <CardContent className="pt-0">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="secondary">Level {program.skill_level}</Badge>
                  {program.duration_weeks && (
                    <Badge variant="outline"><Clock className="h-3 w-3 mr-1" />{program.duration_weeks}w</Badge>
                  )}
                  {program.position_type && <Badge variant="outline">{program.position_type}</Badge>}
                  <Badge variant={program.is_published ? "default" : "outline"}>
                    {program.is_published ? "Published" : "Draft"}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-3">
                  {program.workouts?.[0]?.count ?? 0} workouts
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Create Program</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1">
              <Label>Program Name</Label>
              <Input placeholder="e.g. Pitcher Development 8-Week" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Description</Label>
              <Textarea placeholder="What this program covers..." value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>Difficulty Level</Label>
                <Select value={difficultyLevel} onValueChange={setDifficultyLevel}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {DIFFICULTY_LEVELS.map((l) => (
                      <SelectItem key={l} value={String(l)}>Level {l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Duration (weeks)</Label>
                <Select value={durationWeeks || "na"} onValueChange={(v) => setDurationWeeks(v === "na" ? "" : v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="na">N/A</SelectItem>
                    {[1,2,3,4,5,6,8,10,12,16,20,24].map((w) => (
                      <SelectItem key={w} value={String(w)}>{w} weeks</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>Position Type (optional)</Label>
              <Input placeholder="e.g. Pitcher, Infielder" value={positionType} onChange={(e) => setPositionType(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={() => createProgram.mutate()} disabled={!name.trim() || createProgram.isPending}>
              {createProgram.isPending ? "Creating..." : "Create Program"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachPrograms;
