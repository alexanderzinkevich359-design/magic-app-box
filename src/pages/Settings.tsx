import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DashboardLayout from "@/components/DashboardLayout";
import AvatarUpload from "@/components/AvatarUpload";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Loader2, Pencil, Check, X, ShieldCheck, User, Info, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const { user, profile, role } = useAuth();
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Profile edit state
  const [editing, setEditing] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  // Preferences
  const [timeFormat, setTimeFormat] = useState<"12h" | "24h">("12h");

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Fetch full profile (includes date_of_birth)
  const { data: fullProfile, isLoading } = useQuery({
    queryKey: ["settings-profile", user?.id],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("profiles")
        .select("first_name, last_name, phone, date_of_birth, avatar_url, tier, created_at, time_format")
        .eq("user_id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Populate form when data loads (onSuccess removed in TanStack Query v5)
  useEffect(() => {
    if (!fullProfile) return;
    setFirstName(fullProfile.first_name ?? "");
    setLastName(fullProfile.last_name ?? "");
    setPhone(fullProfile.phone ?? "");
    setDob(fullProfile.date_of_birth ?? "");
    setAvatarUrl(fullProfile.avatar_url ?? null);
    setTimeFormat((fullProfile as any).time_format ?? "12h");
  }, [fullProfile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          date_of_birth: dob || null,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] });
      setEditing(false);
      toast({ title: "Profile updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveTimeFormat = useMutation({
    mutationFn: async (fmt: "12h" | "24h") => {
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ time_format: fmt })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: (_, fmt) => {
      queryClient.invalidateQueries({ queryKey: ["time-format"] });
      queryClient.invalidateQueries({ queryKey: ["settings-profile"] });
      toast({ title: `Time format set to ${fmt === "12h" ? "12-hour" : "24-hour"}` });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const handleTimeFormatChange = (fmt: "12h" | "24h") => {
    setTimeFormat(fmt);
    saveTimeFormat.mutate(fmt);
  };

  const changePassword = useMutation({
    mutationFn: async () => {
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match");
      if (newPassword.length < 6) throw new Error("Password must be at least 6 characters");
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
    },
    onSuccess: () => {
      setNewPassword("");
      setConfirmPassword("");
      toast({ title: "Password changed successfully" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const cancelEdit = () => {
    setFirstName(fullProfile?.first_name ?? "");
    setLastName(fullProfile?.last_name ?? "");
    setPhone(fullProfile?.phone ?? "");
    setDob(fullProfile?.date_of_birth ?? "");
    setEditing(false);
  };

  const tier = fullProfile?.tier ?? "free";
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);
  const roleLabel = role ? role.charAt(0).toUpperCase() + role.slice(1) : "Not set";
  const initials = `${firstName?.[0] ?? ""}${lastName?.[0] ?? ""}`.toUpperCase() || "?";

  const memberSince = fullProfile?.created_at
    ? new Date(fullProfile.created_at).toLocaleDateString(undefined, { year: "numeric", month: "long" })
    : "Not set";

  if (isLoading) {
    return (
      <DashboardLayout role={role ?? "athlete"}>
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role={role ?? "athlete"}>
      <div className="max-w-2xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Settings</h1>
          <p className="text-muted-foreground mt-1">Manage your account and profile</p>
        </div>

        {/* Profile Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <CardTitle className="text-base font-['Space_Grotesk']">Profile</CardTitle>
              </div>
              {!editing ? (
                <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
                  <Pencil className="h-3.5 w-3.5 mr-1.5" /> Edit
                </Button>
              ) : (
                <div className="flex gap-2">
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    <X className="h-3.5 w-3.5 mr-1" /> Cancel
                  </Button>
                  <Button size="sm" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                    {saveProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Check className="h-3.5 w-3.5 mr-1" />}
                    Save
                  </Button>
                </div>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Avatar */}
            <div className="flex items-center gap-4">
              <AvatarUpload
                userId={user!.id}
                currentUrl={avatarUrl}
                initials={initials}
                onUploaded={(url) => setAvatarUrl(url)}
                size="lg"
              />
              <div>
                <p className="font-medium">{firstName} {lastName}</p>
                <p className="text-sm text-muted-foreground">{user?.email}</p>
              </div>
            </div>

            <Separator />

            {/* Info table */}
            <div className="space-y-0 divide-y divide-border rounded-md border overflow-hidden">
              <SettingsRow
                label="First Name"
                value={firstName}
                editing={editing}
                input={<Input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="h-8 text-sm" />}
              />
              <SettingsRow
                label="Last Name"
                value={lastName}
                editing={editing}
                input={<Input value={lastName} onChange={(e) => setLastName(e.target.value)} className="h-8 text-sm" />}
              />
              <SettingsRow
                label="Email"
                value={user?.email ?? "Not set"}
                editing={false}
              />
              <SettingsRow
                label="Phone"
                value={phone || "Not set"}
                editing={editing}
                input={<Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1 555 000 0000" className="h-8 text-sm" />}
              />
              <SettingsRow
                label="Date of Birth"
                value={dob ? new Date(dob).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" }) : "Not set"}
                editing={editing}
                input={<Input type="date" value={dob} onChange={(e) => setDob(e.target.value)} className="h-8 text-sm" />}
              />
            </div>
          </CardContent>
        </Card>

        {/* Preferences Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-['Space_Grotesk']">Preferences</CardTitle>
            </div>
            <CardDescription>Customize how information is displayed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium">Time Format</p>
                <p className="text-xs text-muted-foreground mt-0.5">How times appear on schedules and sessions</p>
              </div>
              <div className="flex gap-1 rounded-md border p-0.5 bg-muted">
                <button
                  onClick={() => handleTimeFormatChange("12h")}
                  disabled={saveTimeFormat.isPending}
                  className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                    timeFormat === "12h"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  12h
                </button>
                <button
                  onClick={() => handleTimeFormatChange("24h")}
                  disabled={saveTimeFormat.isPending}
                  className={`px-3 py-1.5 text-sm rounded font-medium transition-colors ${
                    timeFormat === "24h"
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  24h
                </button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Account Info Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <Info className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-['Space_Grotesk']">Account</CardTitle>
            </div>
            <CardDescription>Read-only account details</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-0 divide-y divide-border rounded-md border overflow-hidden">
              <SettingsRow
                label="Role"
                value=""
                editing={false}
                valueNode={<Badge variant="secondary">{roleLabel}</Badge>}
              />
              {role === "coach" && (
                <SettingsRow
                  label="Plan"
                  value=""
                  editing={false}
                  valueNode={
                    <Badge className={tier === "max" ? "bg-amber-500/20 text-amber-600 hover:bg-amber-500/20" : tier === "basic" ? "" : ""} variant={tier === "max" || tier === "basic" ? "secondary" : "outline"}>
                      {tierLabel}
                    </Badge>
                  }
                />
              )}
              <SettingsRow label="Member Since" value={memberSince} editing={false} />
              <SettingsRow label="User ID" value={user?.id ? user.id.slice(0, 8) + "..." : "Not set"} editing={false} />
            </div>
          </CardContent>
        </Card>

        {/* Security Card */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-muted-foreground" />
              <CardTitle className="text-base font-['Space_Grotesk']">Security</CardTitle>
            </div>
            <CardDescription>Change your password</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">New Password</Label>
              <Input
                type="password"
                placeholder="At least 6 characters"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Confirm New Password</Label>
              <Input
                type="password"
                placeholder="Repeat new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
              />
            </div>
            <Button
              onClick={() => changePassword.mutate()}
              disabled={!newPassword || !confirmPassword || changePassword.isPending}
            >
              {changePassword.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Update Password
            </Button>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

interface SettingsRowProps {
  label: string;
  value: string;
  editing: boolean;
  input?: React.ReactNode;
  valueNode?: React.ReactNode;
}

const SettingsRow = ({ label, value, editing, input, valueNode }: SettingsRowProps) => (
  <div className="flex items-center justify-between px-4 py-3 bg-card">
    <span className="text-sm text-muted-foreground w-32 shrink-0">{label}</span>
    <div className="flex-1 flex justify-end">
      {editing && input ? (
        <div className="w-full max-w-xs">{input}</div>
      ) : valueNode ? (
        valueNode
      ) : (
        <span className="text-sm text-right">{value}</span>
      )}
    </div>
  </div>
);

export default Settings;
