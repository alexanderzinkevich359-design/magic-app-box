import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Target, Dumbbell, TrendingUp, CheckCircle2, Clock, Loader2, Video, Mail, UserPlus, XCircle } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";
import ImprovementVideos from "@/components/ImprovementVideos";
import AthleteVideoSubmissions from "@/components/AthleteVideoSubmissions";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AthleteDashboard = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  // Goals from coach
  const { data: goals = [], isLoading: goalsLoading } = useQuery({
    queryKey: ["athlete-goals", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("athlete_goals")
        .select("id, title, target, progress, deadline, completed_at")
        .eq("athlete_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Coach notes (shared only)
  const { data: coachNotes = [] } = useQuery({
    queryKey: ["athlete-coach-notes", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from("coach_notes")
        .select("id, note, created_at, is_private")
        .eq("athlete_id", user.id)
        .eq("is_private", false)
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
  });

  // Assigned programs (at-home workouts) with their workouts and drills
  const { data: assignedPrograms = [], isLoading: programsLoading } = useQuery({
    queryKey: ["athlete-programs", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: assignments, error: aErr } = await supabase
        .from("athlete_programs")
        .select("id, program_id, status, program:programs(id, name, description)")
        .eq("athlete_id", user.id)
        .eq("status", "active");
      if (aErr) throw aErr;
      if (!assignments?.length) return [];

      // Fetch workouts + drills for all assigned programs
      const programIds = assignments.map((a: any) => a.program_id);
      const { data: workouts, error: wErr } = await supabase
        .from("workouts")
        .select("id, title, description, program_id, order_index, drills(id, name, instructions, rep_scheme, video_url, order_index, coaching_cues)")
        .in("program_id", programIds)
        .order("order_index")
        .order("order_index", { referencedTable: "drills" });
      if (wErr) throw wErr;

      // Fetch completions
      const { data: completions } = await supabase
        .from("athlete_drill_completions")
        .select("id, drill_id")
        .eq("athlete_id", user.id);

      const completedDrillIds = new Set((completions || []).map((c: any) => c.drill_id));

      return assignments.map((a: any) => ({
        ...a,
        workouts: (workouts || [])
          .filter((w: any) => w.program_id === a.program_id)
          .map((w: any) => ({
            ...w,
            drills: (w.drills || []).map((d: any) => ({
              ...d,
              completed: completedDrillIds.has(d.id),
            })),
          })),
      }));
    },
    enabled: !!user,
  });

  // Toggle drill completion
  const toggleDrill = useMutation({
    mutationFn: async ({ drillId, programId, completed }: { drillId: string; programId: string; completed: boolean }) => {
      if (completed) {
        // Uncheck — delete completion
        const { error } = await supabase
          .from("athlete_drill_completions")
          .delete()
          .eq("athlete_id", user!.id)
          .eq("drill_id", drillId);
        if (error) throw error;
      } else {
        // Check — insert completion
        const { error } = await supabase
          .from("athlete_drill_completions")
          .insert({ athlete_id: user!.id, drill_id: drillId, program_id: programId });
        if (error) throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["athlete-programs"] }),
    onError: (e: any) => toast.error(e.message),
  });

  // Fetch pending team invites for this athlete
  const { data: teamInvites = [] } = useQuery({
    queryKey: ["athlete-team-invites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      // Get user email from session (avoids querying auth.users)
      const { data: { session } } = await supabase.auth.getSession();
      const email = session?.user?.email;
      if (!email) return [];
      
      const { data, error } = await supabase
        .from("team_invites")
        .select("*")
        .eq("athlete_email", email.toLowerCase())
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch coach names for display
      if (!data?.length) return [];
      const coachIds = [...new Set(data.map((i: any) => i.coach_id))];
      const { data: coachProfiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", coachIds);

      return data.map((invite: any) => {
        const coach = coachProfiles?.find((p: any) => p.user_id === invite.coach_id);
        return { ...invite, coach_name: coach ? `${coach.first_name} ${coach.last_name}`.trim() : "A coach" };
      });
    },
    enabled: !!user,
  });

  const respondToInvite = useMutation({
    mutationFn: async ({ inviteId, accept }: { inviteId: string; accept: boolean }) => {
      // Get the invite details first
      const invite = teamInvites.find((i: any) => i.id === inviteId);
      if (!invite) throw new Error("Invite not found");

      // Update invite status
      const { error: updateErr } = await supabase
        .from("team_invites")
        .update({ status: accept ? "accepted" : "declined", responded_at: new Date().toISOString() })
        .eq("id", inviteId);
      if (updateErr) throw updateErr;

      // If accepted, create the coach-athlete link
      if (accept) {
        const { error: linkErr } = await supabase
          .from("coach_athlete_links")
          .insert({
            coach_user_id: invite.coach_id,
            athlete_user_id: user!.id,
            sport_id: invite.sport_id,
            position: invite.position,
            throw_hand: invite.throw_hand,
            bat_hand: invite.bat_hand,
          });
        if (linkErr) throw linkErr;
      }
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["athlete-team-invites"] });
      queryClient.invalidateQueries({ queryKey: ["athlete-programs"] });
      toast.success(vars.accept ? "You've joined the team!" : "Invite declined");
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Compute stats
  const activeGoals = goals.filter((g) => !g.completed_at).length;
  const totalDrills = assignedPrograms.reduce(
    (sum: number, p: any) => sum + p.workouts.reduce((ws: number, w: any) => ws + w.drills.length, 0), 0
  );
  const completedDrills = assignedPrograms.reduce(
    (sum: number, p: any) => sum + p.workouts.reduce((ws: number, w: any) => ws + w.drills.filter((d: any) => d.completed).length, 0), 0
  );

  const isLoading = goalsLoading || programsLoading;

  if (isLoading) {
    return (
      <DashboardLayout role="athlete">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="athlete">
      <div className="mb-8 flex items-center gap-4">
        <AvatarUpload
          userId={user?.id || ""}
          currentUrl={profile?.avatar_url || null}
          initials={profile ? `${profile.first_name[0] || ""}${profile.last_name[0] || ""}` : "?"}
          onUploaded={() => window.location.reload()}
          size="lg"
        />
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">My Dashboard 👋</h1>
          <p className="text-muted-foreground mt-1">Your performance overview and at-home workouts</p>
        </div>
      </div>

      {/* Team Invites */}
      {teamInvites.length > 0 && (
        <div className="space-y-3 mb-8">
          {teamInvites.map((invite: any) => (
            <Card key={invite.id} className="border-primary/30 bg-primary/5">
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                    <Mail className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-semibold text-sm">
                      {invite.coach_name} invited you to join their team
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Position: {invite.position || "Not specified"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    onClick={() => respondToInvite.mutate({ inviteId: invite.id, accept: true })}
                    disabled={respondToInvite.isPending}
                  >
                    <UserPlus className="h-4 w-4 mr-1" /> Accept
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {[
          { label: "Active Goals", value: activeGoals, icon: Target },
          { label: "Drills Completed", value: `${completedDrills}/${totalDrills}`, icon: CheckCircle2 },
          { label: "Assigned Programs", value: assignedPrograms.length, icon: Dumbbell },
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

      {/* Two-column layout: Performance Overview + At-Home Workouts */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Performance Overview — Goals */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold font-['Space_Grotesk']">Performance Overview</h2>

          <Card>
            <CardHeader>
              <CardTitle className="text-base font-['Space_Grotesk']">My Goals</CardTitle>
              <CardDescription>Goals set by your coach</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {goals.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No goals set yet. Your coach will add them.</p>
              ) : (
                goals.map((goal) => (
                  <div key={goal.id} className="space-y-2">
                    <div className="flex justify-between">
                      <div>
                        <p className="text-sm font-medium">{goal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          Target: {goal.target}
                          {goal.deadline && ` · Due: ${new Date(goal.deadline).toLocaleDateString()}`}
                        </p>
                      </div>
                      <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                    </div>
                    <Progress value={goal.progress} className="h-2" />
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Coach Feedback */}
          {coachNotes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base font-['Space_Grotesk']">Coach Feedback</CardTitle>
                <CardDescription>Recent notes from your coach</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {coachNotes.map((note: any) => (
                  <div key={note.id} className="rounded-lg border bg-secondary/30 p-4">
                    <p className="text-sm">{note.note}</p>
                    <p className="text-xs text-muted-foreground mt-2">{new Date(note.created_at).toLocaleDateString()}</p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* At-Home Workouts */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold font-['Space_Grotesk']">At-Home Workouts</h2>

          {assignedPrograms.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Dumbbell className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
                <p className="text-sm text-muted-foreground">No workouts assigned yet. Your coach will add them.</p>
              </CardContent>
            </Card>
          ) : (
            assignedPrograms.map((program: any) => (
              <Card key={program.id}>
                <CardHeader>
                  <CardTitle className="text-base font-['Space_Grotesk']">{program.program?.name}</CardTitle>
                  {program.program?.description && (
                    <CardDescription>{program.program.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-2">
                    {program.workouts.map((workout: any, wIdx: number) => {
                      const done = workout.drills.filter((d: any) => d.completed).length;
                      const total = workout.drills.length;
                      return (
                        <AccordionItem key={workout.id} value={workout.id} className="border rounded-lg px-3">
                          <AccordionTrigger className="hover:no-underline py-3">
                            <div className="flex items-center gap-3 text-left">
                              <span className="text-xs text-muted-foreground font-mono w-5">{wIdx + 1}</span>
                              <div>
                                <p className="text-sm font-medium">{workout.title}</p>
                                <p className="text-xs text-muted-foreground">
                                  {done}/{total} completed
                                </p>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="pb-3">
                            {workout.description && (
                              <p className="text-xs text-muted-foreground mb-3">{workout.description}</p>
                            )}
                            <div className="space-y-2">
                              {workout.drills.map((drill: any) => (
                                <div
                                  key={drill.id}
                                  className={`flex items-start gap-3 rounded-md border p-3 transition-colors ${drill.completed ? "bg-primary/5 border-primary/20" : "bg-secondary/30"}`}
                                >
                                  <Checkbox
                                    checked={drill.completed}
                                    onCheckedChange={() => toggleDrill.mutate({
                                      drillId: drill.id,
                                      programId: program.program_id,
                                      completed: drill.completed,
                                    })}
                                    className="mt-0.5"
                                  />
                                  <div className="flex-1 min-w-0">
                                    <p className={`text-sm font-medium ${drill.completed ? "line-through text-muted-foreground" : ""}`}>
                                      {drill.name}
                                    </p>
                                    {drill.rep_scheme && (
                                      <Badge variant="outline" className="text-[10px] mt-1">{drill.rep_scheme}</Badge>
                                    )}
                                    {drill.instructions && (
                                      <p className="text-xs text-muted-foreground mt-1">{drill.instructions}</p>
                                    )}
                                    {drill.coaching_cues && (
                                      <p className="text-xs text-muted-foreground mt-1 italic">💡 {drill.coaching_cues}</p>
                                    )}
                                    {drill.video_url && (
                                      <a
                                        href={drill.video_url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1"
                                      >
                                        <Video className="h-3 w-3" /> Watch Demo
                                      </a>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      );
                    })}
                  </Accordion>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* Improvement Videos from Coach */}
      {user && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <AthleteVideoSubmissions athleteId={user.id} canUpload />
          <ImprovementVideos athleteId={user.id} readOnly />
        </div>
      )}
    </DashboardLayout>
  );
};

export default AthleteDashboard;
