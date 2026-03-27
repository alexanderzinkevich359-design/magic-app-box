import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Mail, UserPlus, Users } from "lucide-react";
import AvatarUpload from "@/components/AvatarUpload";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const AthleteProfile = () => {
  const { user, profile } = useAuth();
  const queryClient = useQueryClient();

  const [showInviteDialog, setShowInviteDialog] = useState(false);
  const [inviteName, setInviteName] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");

  // Linked parents
  const { data: linkedParents = [] } = useQuery({
    queryKey: ["athlete-linked-parents", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: links } = await (supabase as any)
        .from("parent_athlete_links")
        .select("parent_user_id")
        .eq("athlete_user_id", user.id);
      if (!links?.length) return [];
      const parentIds = links.map((r: any) => r.parent_user_id);
      const { data: parentProfiles } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name")
        .in("user_id", parentIds);
      return (parentProfiles || []).map((p: any) => ({
        user_id: p.user_id,
        name: `${p.first_name} ${p.last_name}`.trim(),
      }));
    },
    enabled: !!user,
  });

  // Pending invites sent by this athlete
  const { data: pendingInvites = [] } = useQuery({
    queryKey: ["athlete-pending-parent-invites", user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data } = await (supabase as any)
        .from("parent_invites")
        .select("id, parent_name, parent_email")
        .eq("athlete_user_id", user.id)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!user,
  });

  const inviteMutation = useMutation({
    mutationFn: async () => {
      if (!inviteName.trim() || !inviteEmail.trim()) throw new Error("Name and email are required");

      const { data: coachLink } = await supabase
        .from("coach_athlete_links")
        .select("coach_user_id")
        .eq("athlete_user_id", user!.id)
        .limit(1)
        .maybeSingle();
      if (!coachLink) throw new Error("No coach is linked to your account yet. Ask your coach to add you first.");

      const coachId = coachLink.coach_user_id;

      const { data: coachProfile } = await supabase
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", coachId)
        .maybeSingle();
      const coachName = coachProfile ? `${coachProfile.first_name} ${coachProfile.last_name}`.trim() : "Your coach";
      const athleteName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Your athlete";

      const { data: invite, error } = await (supabase as any)
        .from("parent_invites")
        .insert({
          coach_id: coachId,
          athlete_user_id: user!.id,
          parent_name: inviteName.trim(),
          parent_email: inviteEmail.trim().toLowerCase(),
        })
        .select("token")
        .single();
      if (error) throw error;

      const signupUrl = `${window.location.origin}/signup?parent_token=${invite.token}`;
      await supabase.functions.invoke("send-parent-invite-email", {
        body: { parentEmail: inviteEmail.trim().toLowerCase(), parentName: inviteName.trim(), coachName, athleteName, signupUrl },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["athlete-pending-parent-invites", user?.id] });
      setShowInviteDialog(false);
      setInviteName("");
      setInviteEmail("");
      toast.success("Invite sent! Your parent will receive an email shortly.");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <DashboardLayout role="athlete">
      <div className="max-w-lg space-y-6">
        {/* Profile header */}
        <div className="flex items-center gap-4">
          <AvatarUpload
            userId={user?.id || ""}
            currentUrl={profile?.avatar_url || null}
            initials={profile ? `${profile.first_name[0] || ""}${profile.last_name[0] || ""}` : "?"}
            onUploaded={() => window.location.reload()}
            size="lg"
          />
          <div>
            <h1 className="text-2xl font-bold font-['Space_Grotesk']">
              {profile ? `${profile.first_name} ${profile.last_name}` : "My Profile"}
            </h1>
            <p className="text-sm text-muted-foreground">Athlete</p>
          </div>
        </div>

        {/* My Parents */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base font-['Space_Grotesk'] flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" /> My Parents
                </CardTitle>
                <CardDescription>Invite a parent to follow your development</CardDescription>
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowInviteDialog(true)}>
                <UserPlus className="h-3.5 w-3.5 mr-1" /> Invite
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {linkedParents.length === 0 && pendingInvites.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">
                No parents linked yet. Send an invite above.
              </p>
            ) : (
              <>
                {linkedParents.map((p: any) => (
                  <div key={p.user_id} className="flex items-center gap-2 rounded-lg border px-3 py-2">
                    <div className="h-7 w-7 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                      <Users className="h-3.5 w-3.5 text-emerald-400" />
                    </div>
                    <p className="text-sm font-medium">{p.name}</p>
                    <span className="ml-auto text-[10px] font-semibold text-emerald-400 bg-emerald-400/10 border border-emerald-400/20 rounded px-1.5 py-0.5">
                      Linked
                    </span>
                  </div>
                ))}
                {pendingInvites.map((inv: any) => (
                  <div key={inv.id} className="flex items-center gap-2 rounded-lg border px-3 py-2 opacity-70">
                    <div className="h-7 w-7 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Mail className="h-3.5 w-3.5 text-amber-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{inv.parent_name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{inv.parent_email}</p>
                    </div>
                    <span className="ml-auto text-[10px] font-semibold text-amber-400 bg-amber-400/10 border border-amber-400/20 rounded px-1.5 py-0.5 shrink-0">
                      Pending
                    </span>
                  </div>
                ))}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Invite dialog */}
      <Dialog open={showInviteDialog} onOpenChange={(o) => !o && setShowInviteDialog(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-['Space_Grotesk']">Invite a Parent</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-1">
            <div className="space-y-1">
              <Label className="text-xs">Parent's Name</Label>
              <Input
                placeholder="e.g. Jane Smith"
                value={inviteName}
                onChange={(e) => setInviteName(e.target.value)}
                className="h-9"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Parent's Email</Label>
              <Input
                type="email"
                placeholder="parent@email.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="h-9"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              They'll receive an email with a link to create a parent account and follow your development.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowInviteDialog(false)}>Cancel</Button>
            <Button
              onClick={() => inviteMutation.mutate()}
              disabled={!inviteName.trim() || !inviteEmail.trim() || inviteMutation.isPending}
            >
              {inviteMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Send Invite
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default AthleteProfile;
