import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Users, Layers, Trash2, UserPlus, UserMinus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

type Team = {
  id: string;
  name: string;
  sport: string | null;
  season: string | null;
  season_start: string | null;
  season_end: string | null;
  created_at: string;
  members: { id: string; team_id: string; athlete_user_id: string }[];
};

const isTeamInSeason = (team: Team): boolean => {
  if (!team.season_start || !team.season_end) return false;
  const today = new Date().toISOString().split("T")[0];
  return today >= team.season_start && today <= team.season_end;
};

type RosterAthlete = {
  athlete_user_id: string;
  first_name: string;
  last_name: string;
};

const CoachTeams = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Create team form
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamSport, setNewTeamSport] = useState("");
  const [newTeamSeason, setNewTeamSeason] = useState("");
  const [newTeamSeasonStart, setNewTeamSeasonStart] = useState("");
  const [newTeamSeasonEnd, setNewTeamSeasonEnd] = useState("");

  // Selected team for detail dialog
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // ── Fetch teams ──────────────────────────────────────────────────────────────
  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ["coach-teams", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: teamsData, error } = await (supabase as any)
        .from("teams")
        .select("id, name, sport, season, season_start, season_end, created_at")
        .eq("coach_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      if (!teamsData?.length) return [];

      const teamIds = teamsData.map((t: any) => t.id);
      const { data: members } = await (supabase as any)
        .from("team_members")
        .select("id, team_id, athlete_user_id")
        .in("team_id", teamIds);

      return teamsData.map((t: any) => ({
        ...t,
        members: (members || []).filter((m: any) => m.team_id === t.id),
      })) as Team[];
    },
    enabled: !!user,
  });

  // ── Fetch coach's full athlete roster ────────────────────────────────────────
  const { data: roster = [] } = useQuery({
    queryKey: ["coach-roster-simple", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await supabase
        .from("coach_athlete_links")
        .select("athlete_user_id")
        .eq("coach_user_id", user.id);
      if (!links?.length) return [];

      const athleteIds = links.map((l) => l.athlete_user_id);
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", athleteIds);

      return (profiles || []).map((p) => ({
        athlete_user_id: p.user_id,
        first_name: p.first_name,
        last_name: p.last_name,
      })) as RosterAthlete[];
    },
    enabled: !!user,
  });

  // ── Mutations ────────────────────────────────────────────────────────────────
  const createTeamMutation = useMutation({
    mutationFn: async () => {
      if (!newTeamName.trim()) throw new Error("Team name is required");
      const { error } = await (supabase as any).from("teams").insert({
        coach_id: user!.id,
        name: newTeamName.trim(),
        sport: newTeamSport.trim() || null,
        season: newTeamSeason.trim() || null,
        season_start: newTeamSeasonStart || null,
        season_end: newTeamSeasonEnd || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-teams"] });
      setNewTeamName(""); setNewTeamSport(""); setNewTeamSeason("");
      setNewTeamSeasonStart(""); setNewTeamSeasonEnd("");
      setShowCreateDialog(false);
      toast({ title: "Team created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const deleteTeamMutation = useMutation({
    mutationFn: async (teamId: string) => {
      const { error } = await (supabase as any).from("teams").delete().eq("id", teamId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["coach-teams"] });
      setSelectedTeamId(null);
      toast({ title: "Team deleted" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const addMemberMutation = useMutation({
    mutationFn: async ({ teamId, athleteUserId }: { teamId: string; athleteUserId: string }) => {
      const { error } = await (supabase as any).from("team_members").insert({
        team_id: teamId,
        athlete_user_id: athleteUserId,
      });
      if (error) {
        if (error.code === "23505") throw new Error("Athlete is already on this team");
        throw error;
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-teams"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const removeMemberMutation = useMutation({
    mutationFn: async (memberId: string) => {
      const { error } = await (supabase as any).from("team_members").delete().eq("id", memberId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["coach-teams"] }),
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // ── Helpers ──────────────────────────────────────────────────────────────────
  const selectedTeam = selectedTeamId ? teams.find((t) => t.id === selectedTeamId) ?? null : null;

  const getAthleteName = (userId: string) => {
    const a = roster.find((r) => r.athlete_user_id === userId);
    return a ? `${a.first_name} ${a.last_name}`.trim() : "Unknown Athlete";
  };

  // Athletes already assigned to any team — hide them in the "Add" tab to prevent double-booking
  const allTeamMemberIds = useMemo(() => {
    const ids = new Set<string>();
    for (const team of teams) {
      for (const m of team.members) ids.add(m.athlete_user_id);
    }
    return ids;
  }, [teams]);

  const athletesNotOnTeam = (_team: Team) =>
    roster.filter((a) => !allTeamMemberIds.has(a.athlete_user_id));

  // ── Render ───────────────────────────────────────────────────────────────────
  if (teamsLoading) {
    return (
      <DashboardLayout role="coach">
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="coach">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold font-['Space_Grotesk']">Teams</h1>
            <p className="text-muted-foreground mt-1">Organize your athletes into teams</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4 mr-2" /> Create Team
          </Button>
        </div>

        {/* Teams grid */}
        {teams.length === 0 ? (
          <Card>
            <CardContent className="py-16 text-center space-y-3">
              <Layers className="h-10 w-10 mx-auto text-muted-foreground/40" />
              <p className="text-muted-foreground">No teams yet. Create one to organize your athletes.</p>
              <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
                <Plus className="h-4 w-4 mr-2" /> Create Team
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {teams.map((team) => (
              <Card
                key={team.id}
                className="cursor-pointer hover:border-primary/50 transition-colors"
                onClick={() => setSelectedTeamId(team.id)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base font-['Space_Grotesk'] leading-tight">{team.name}</CardTitle>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTeamInSeason(team) && (
                        <Badge className="text-[10px] px-1.5 py-0 bg-emerald-500/20 text-emerald-400 border-emerald-500/40 border">In Season</Badge>
                      )}
                      <Users className="h-4 w-4 text-muted-foreground mt-0.5" />
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 mt-1">
                    {team.sport && <Badge variant="secondary" className="text-xs">{team.sport}</Badge>}
                    {team.season && <Badge variant="outline" className="text-xs">{team.season}</Badge>}
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">
                    {team.members.length} {team.members.length === 1 ? "athlete" : "athletes"}
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create Team Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Create Team</DialogTitle>
            <DialogDescription>Give your team a name, sport, and season.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label className="text-sm">Team Name <span className="text-destructive">*</span></Label>
              <Input
                placeholder="e.g. Varsity Baseball"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Sport</Label>
              <Input
                placeholder="e.g. Baseball, Soccer, Basketball"
                value={newTeamSport}
                onChange={(e) => setNewTeamSport(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-sm">Season</Label>
              <Input
                placeholder="e.g. Spring 2026"
                value={newTeamSeason}
                onChange={(e) => setNewTeamSeason(e.target.value)}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-sm">Season Start</Label>
                <Input
                  type="date"
                  value={newTeamSeasonStart}
                  onChange={(e) => setNewTeamSeasonStart(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-sm">Season End</Label>
                <Input
                  type="date"
                  value={newTeamSeasonEnd}
                  onChange={(e) => setNewTeamSeasonEnd(e.target.value)}
                />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                onClick={() => createTeamMutation.mutate()}
                disabled={!newTeamName.trim() || createTeamMutation.isPending}
              >
                {createTeamMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Create Team
              </Button>
              <Button variant="outline" onClick={() => setShowCreateDialog(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Team Detail Dialog */}
      <Dialog open={!!selectedTeam} onOpenChange={(open) => { if (!open) setSelectedTeamId(null); }}>
        <DialogContent className="max-w-md">
          {selectedTeam && (
            <>
              <DialogHeader>
                <DialogTitle className="font-['Space_Grotesk']">{selectedTeam.name}</DialogTitle>
                <DialogDescription>
                  {[selectedTeam.sport, selectedTeam.season].filter(Boolean).join(" · ") || "No sport or season set"}
                </DialogDescription>
              </DialogHeader>

              <Tabs defaultValue="members">
                <TabsList className="w-full">
                  <TabsTrigger value="members" className="flex-1">
                    <Users className="h-3.5 w-3.5 mr-1.5" /> Members ({selectedTeam.members.length})
                  </TabsTrigger>
                  <TabsTrigger value="add" className="flex-1">
                    <UserPlus className="h-3.5 w-3.5 mr-1.5" /> Add Athletes
                  </TabsTrigger>
                </TabsList>

                {/* Members tab */}
                <TabsContent value="members" className="mt-3 space-y-2">
                  {selectedTeam.members.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">No athletes on this team yet.</p>
                  ) : (
                    selectedTeam.members.map((member) => (
                      <div key={member.id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                        <span className="text-sm font-medium">{getAthleteName(member.athlete_user_id)}</span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive"
                          onClick={() => removeMemberMutation.mutate(member.id)}
                          disabled={removeMemberMutation.isPending}
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))
                  )}

                  {/* Delete team */}
                  <div className="pt-3 border-t mt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="w-full"
                      onClick={() => deleteTeamMutation.mutate(selectedTeam.id)}
                      disabled={deleteTeamMutation.isPending}
                    >
                      {deleteTeamMutation.isPending
                        ? <Loader2 className="h-4 w-4 animate-spin mr-2" />
                        : <Trash2 className="h-4 w-4 mr-2" />}
                      Delete Team
                    </Button>
                  </div>
                </TabsContent>

                {/* Add Athletes tab */}
                <TabsContent value="add" className="mt-3 space-y-2">
                  {athletesNotOnTeam(selectedTeam).length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {roster.length === 0
                        ? "You have no athletes on your roster yet."
                        : "All your athletes are already assigned to a team."}
                    </p>
                  ) : (
                    athletesNotOnTeam(selectedTeam).map((athlete) => (
                      <div key={athlete.athlete_user_id} className="flex items-center justify-between rounded-lg border px-3 py-2.5">
                        <span className="text-sm font-medium">{`${athlete.first_name} ${athlete.last_name}`.trim()}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          onClick={() => addMemberMutation.mutate({ teamId: selectedTeam.id, athleteUserId: athlete.athlete_user_id })}
                          disabled={addMemberMutation.isPending}
                        >
                          <UserPlus className="h-3 w-3" /> Add
                        </Button>
                      </div>
                    ))
                  )}
                </TabsContent>
              </Tabs>
            </>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default CoachTeams;
