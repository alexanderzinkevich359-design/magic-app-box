import { ReactNode, useState, useEffect } from "react";
import TrialBanner from "./TrialBanner";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import {
  Menu, LogOut, Home, Users, Calendar, CreditCard,
  BarChart2, Dumbbell, Target, Activity, ClipboardList, Settings, Layers, Sparkles, Bot
} from "lucide-react";

type NavItem = { label: string; path: string; icon: ReactNode };

const roleNavItems: Record<string, NavItem[]> = {
  coach: [
    { label: "Dashboard", path: "/coach", icon: <Home className="h-4 w-4" /> },
    { label: "Programs", path: "/coach/programs", icon: <Dumbbell className="h-4 w-4" /> },
    { label: "Athletes", path: "/coach/athletes", icon: <Users className="h-4 w-4" /> },
    { label: "Teams", path: "/coach/teams", icon: <Layers className="h-4 w-4" /> },
    { label: "Log Session", path: "/coach/log-session", icon: <ClipboardList className="h-4 w-4" /> },
    { label: "Schedule", path: "/coach/schedule", icon: <Calendar className="h-4 w-4" /> },
    { label: "Game Log", path: "/coach/game-log", icon: <BarChart2 className="h-4 w-4" /> },
    { label: "Spotlight", path: "/coach/spotlight", icon: <Sparkles className="h-4 w-4" /> },
    { label: "Assistant", path: "/coach/assistant", icon: <Bot className="h-4 w-4" /> },
    { label: "Billing", path: "/coach/billing", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Settings", path: "/settings", icon: <Settings className="h-4 w-4" /> },
  ],
  parent: [
    { label: "Dashboard", path: "/parent", icon: <Home className="h-4 w-4" /> },
    { label: "Billing", path: "/parent/billing", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Profile", path: "/settings", icon: <Settings className="h-4 w-4" /> },
  ],
  athlete: [
    { label: "Dashboard", path: "/athlete", icon: <Home className="h-4 w-4" /> },
    { label: "Programs", path: "/athlete/programs", icon: <Dumbbell className="h-4 w-4" /> },
    { label: "Schedule", path: "/athlete/schedule", icon: <Calendar className="h-4 w-4" /> },
    { label: "Metrics", path: "/athlete/metrics", icon: <Activity className="h-4 w-4" /> },
    { label: "Goals", path: "/athlete/goals", icon: <Target className="h-4 w-4" /> },
    { label: "Profile", path: "/athlete/profile", icon: <Users className="h-4 w-4" /> },
    { label: "Settings", path: "/settings", icon: <Settings className="h-4 w-4" /> },
  ],
};

interface DashboardLayoutProps {
  role: "coach" | "parent" | "athlete";
  children: ReactNode;
}

const DashboardLayout = ({ role, children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut, profile } = useAuth();
  const [open, setOpen] = useState(false);
  const [showBirthday, setShowBirthday] = useState(false);

  const { data: dob } = useQuery({
    queryKey: ["profile-dob", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("date_of_birth, first_name")
        .eq("user_id", user!.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (!dob?.date_of_birth || !user) return;
    const today = new Date();
    // Parse date_of_birth string directly to avoid UTC/local timezone mismatch
    const [, bdayMonth, bdayDay] = dob.date_of_birth.split("-").map(Number);
    const isBirthday =
      bdayMonth - 1 === today.getMonth() &&
      bdayDay === today.getDate();
    if (!isBirthday) return;
    const key = `bday_shown_${user.id}_${today.toDateString()}`;
    if (!sessionStorage.getItem(key)) {
      sessionStorage.setItem(key, "1");
      setShowBirthday(true);
    }
  }, [dob, user]);
  const navItems = role === "coach" && profile?.coach_type === "team"
    ? roleNavItems.coach.map((item) =>
        item.path === "/coach/programs"
          ? { label: "Drills", path: "/coach/drills", icon: <Dumbbell className="h-4 w-4" /> }
          : item
      )
    : roleNavItems[role];
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);
  const displayName = profile ? `${profile.first_name} ${profile.last_name}`.trim() : roleLabel;
  const tier = profile?.tier ?? "free";
  const tierLabel = tier.charAt(0).toUpperCase() + tier.slice(1);

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  const NavLinks = ({ onClick }: { onClick?: () => void }) => (
    <nav className="flex flex-col gap-1">
      {navItems.map((item) => (
        <Link
          key={item.path}
          to={item.path}
          onClick={onClick}
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
            location.pathname === item.path
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          {item.icon}
          {item.label}
        </Link>
      ))}
    </nav>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile header */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b bg-card px-4 py-3 lg:hidden">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <Target className="h-4 w-4 text-primary-foreground" />
          </div>
          <span className="font-semibold font-['Space_Grotesk']">ClipMVP</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-card">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="mb-2 mt-2">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{roleLabel}</p>
              {role === "coach" && (
                <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tier === "max" ? "bg-amber-500/20 text-amber-400" : tier === "basic" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {tierLabel} Plan
                </span>
              )}
            </div>
            <NavLinks onClick={() => setOpen(false)} />
            <div className="mt-auto pt-8">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
                <LogOut className="h-4 w-4" /> Sign Out
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r bg-card">
          <div className="flex items-center gap-2 px-6 py-5 border-b">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-lg font-semibold font-['Space_Grotesk']">ClipMVP</span>
          </div>
          <div className="px-4 py-4">
            <div className="mb-4 px-3">
              <p className="text-sm font-medium">{displayName}</p>
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{roleLabel}</p>
              {role === "coach" && (
                <span className={`inline-block mt-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${tier === "max" ? "bg-amber-500/20 text-amber-400" : tier === "basic" ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}>
                  {tierLabel} Plan
                </span>
              )}
            </div>
            <NavLinks />
          </div>
          <div className="mt-auto px-4 pb-4">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={handleSignOut}>
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          {role === "coach" && <TrialBanner />}
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>

      {/* Birthday popup */}
      <Dialog open={showBirthday} onOpenChange={setShowBirthday}>
        <DialogContent className="max-w-sm text-center">
          <div className="flex flex-col items-center gap-3 py-4">
            <div className="text-6xl leading-none select-none">🎂</div>
            <h2 className="text-2xl font-bold font-['Space_Grotesk']">
              Happy Birthday{dob?.first_name ? `, ${dob.first_name}` : ""}!
            </h2>
            <p className="text-sm text-muted-foreground">
              Wishing you a great day and an even better season ahead. Keep grinding. The best is yet to come. 🎉
            </p>
            <Button className="mt-2 w-full" onClick={() => setShowBirthday(false)}>
              Thanks! 🙌
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DashboardLayout;
