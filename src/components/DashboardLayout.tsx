import { ReactNode, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger, SheetTitle } from "@/components/ui/sheet";
import {
  Menu, LogOut, Home, Users, Calendar, CreditCard,
  BarChart3, Dumbbell, Target, Bell, User
} from "lucide-react";

type NavItem = { label: string; path: string; icon: ReactNode };

const roleNavItems: Record<string, NavItem[]> = {
  coach: [
    { label: "Dashboard", path: "/coach", icon: <Home className="h-4 w-4" /> },
    { label: "Athletes", path: "/coach/athletes", icon: <Users className="h-4 w-4" /> },
    { label: "Schedule", path: "/coach/schedule", icon: <Calendar className="h-4 w-4" /> },
    { label: "Analytics", path: "/coach/analytics", icon: <BarChart3 className="h-4 w-4" /> },
  ],
  parent: [
    { label: "Dashboard", path: "/parent", icon: <Home className="h-4 w-4" /> },
    { label: "Progress", path: "/parent/progress", icon: <BarChart3 className="h-4 w-4" /> },
    { label: "Subscription", path: "/parent/subscription", icon: <CreditCard className="h-4 w-4" /> },
    { label: "Schedule", path: "/parent/schedule", icon: <Calendar className="h-4 w-4" /> },
  ],
  athlete: [
    { label: "Dashboard", path: "/athlete", icon: <Home className="h-4 w-4" /> },
    { label: "Training", path: "/athlete/training", icon: <Dumbbell className="h-4 w-4" /> },
    { label: "Goals", path: "/athlete/goals", icon: <Target className="h-4 w-4" /> },
    { label: "Progress", path: "/athlete/progress", icon: <BarChart3 className="h-4 w-4" /> },
  ],
};

interface DashboardLayoutProps {
  role: "coach" | "parent" | "athlete";
  children: ReactNode;
}

const DashboardLayout = ({ role, children }: DashboardLayoutProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const navItems = roleNavItems[role];
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

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
          <span className="font-semibold font-['Space_Grotesk']">AthletePro</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu className="h-5 w-5" /></Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 bg-card">
            <SheetTitle className="sr-only">Navigation</SheetTitle>
            <div className="mb-6 mt-2">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">{roleLabel} Portal</p>
            </div>
            <NavLinks onClick={() => setOpen(false)} />
            <div className="mt-auto pt-8">
              <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => navigate("/")}>
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
            <span className="text-lg font-semibold font-['Space_Grotesk']">AthletePro</span>
          </div>
          <div className="px-4 py-4">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-4 px-3">{roleLabel} Portal</p>
            <NavLinks />
          </div>
          <div className="mt-auto px-4 pb-4">
            <Button variant="ghost" className="w-full justify-start gap-3 text-muted-foreground" onClick={() => navigate("/")}>
              <LogOut className="h-4 w-4" /> Sign Out
            </Button>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1 lg:pl-64">
          <div className="p-6 lg:p-8 max-w-7xl mx-auto">{children}</div>
        </main>
      </div>
    </div>
  );
};

export default DashboardLayout;
