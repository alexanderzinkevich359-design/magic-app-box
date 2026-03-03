import { useState, useEffect } from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Button } from "@/components/ui/button";
import { Target, Users, BookOpen, Calendar, TrendingUp, ChevronRight, Check, Zap, UserCircle, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

interface CoachOnboardingProps {
  userId: string;
  firstName: string;
}

type CoachType = "private" | "team" | null;

const SPORTS = [
  { id: "baseball",   name: "Baseball",   icon: "⚾", available: true  },
  { id: "softball",   name: "Softball",   icon: "🥎", available: true  },
  { id: "tennis",     name: "Tennis",     icon: "🎾", available: true  },
  { id: "soccer",     name: "Soccer",     icon: "⚽", available: false },
  { id: "basketball", name: "Basketball", icon: "🏀", available: false },
  { id: "football",   name: "Football",   icon: "🏈", available: false },
  { id: "volleyball", name: "Volleyball", icon: "🏐", available: true  },
];

const TUTORIAL_STEPS = [
  {
    icon: Users,
    title: "Invite Your Athletes",
    description:
      "Go to the Athletes page and click 'Invite Athlete'. They'll get an email to join your roster.",
  },
  {
    icon: BookOpen,
    title: "Build Programs & Workouts",
    description:
      "Create practice rubrics, assign drills, and give athletes at-home workouts: your digital playbook.",
  },
  {
    icon: Calendar,
    title: "Schedule Practices",
    description:
      "Plan individual or group sessions with recurring options. Your whole week mapped out in seconds.",
  },
  {
    icon: TrendingUp,
    title: "Track Real Progress",
    description:
      "Log sessions, record metrics, and demonstrate measurable improvement to athletes and parents.",
  },
];

const CoachOnboarding = ({ userId, firstName }: CoachOnboardingProps) => {
  const [open, setOpen] = useState(false);
  // Steps: 0=coach type, 1=sport, 2=tutorial, 3=CTA
  const [step, setStep] = useState(0);
  const [coachType, setCoachType] = useState<CoachType>(null);
  const [selectedSport, setSelectedSport] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const key = `clip-onboarded-${userId}`;
    if (!localStorage.getItem(key)) {
      const t = setTimeout(() => setOpen(true), 600);
      return () => clearTimeout(t);
    }
  }, [userId]);

  const finish = async (destination?: string) => {
    localStorage.setItem(`clip-onboarded-${userId}`, "1");
    if (selectedSport) localStorage.setItem(`clip-sport-${userId}`, selectedSport);
    // Persist coach_type to profile
    if (coachType) {
      await (supabase as any)
        .from("profiles")
        .update({ coach_type: coachType })
        .eq("user_id", userId);
    }
    setOpen(false);
    if (destination) navigate(destination);
  };

  const next = () => {
    if (step === 0 && !coachType) return;
    if (step === 1 && !selectedSport) return;
    setStep((s) => s + 1);
  };

  const totalSteps = 4;

  return (
    <DialogPrimitive.Root open={open} onOpenChange={(o) => { if (!o) finish(); }}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-background shadow-2xl overflow-hidden data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95"
          onInteractOutside={(e) => e.preventDefault()}
          onEscapeKeyDown={(e) => e.preventDefault()}
        >
          <DialogPrimitive.Title className="sr-only">Welcome to ClipMVP</DialogPrimitive.Title>
          <DialogPrimitive.Description className="sr-only">Coach onboarding setup</DialogPrimitive.Description>

          {/* Header banner */}
          <div className="bg-gradient-to-br from-primary/25 via-primary/10 to-transparent border-b px-6 pt-6 pb-5 text-center">
            <div className="mx-auto mb-3 h-12 w-12 rounded-xl bg-primary flex items-center justify-center shadow-lg">
              <Target className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-xl font-bold font-['Space_Grotesk'] tracking-tight">
              {step === 0 && `Welcome, ${firstName || "Coach"}!`}
              {step === 1 && "What sport do you coach?"}
              {step === 2 && "Here's How It Works"}
              {step === 3 && "You're All Set!"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1">
              {step === 0 && "Let's personalize your experience. Takes 10 seconds."}
              {step === 1 && "We'll tailor your tools to your sport."}
              {step === 2 && "Start with athletes. Everything else follows."}
              {step === 3 && "ClipMVP is your edge over every other coach."}
            </p>
          </div>

          {/* Step 0: Coach type */}
          {step === 0 && (
            <div className="px-6 pt-5 pb-6 space-y-3">
              <p className="text-sm font-semibold text-center mb-4">What type of coach are you?</p>

              <button
                onClick={() => setCoachType("private")}
                className={[
                  "w-full rounded-xl border-2 p-4 text-left flex items-start gap-4 transition-all duration-150 focus:outline-none",
                  coachType === "private"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${coachType === "private" ? "bg-primary/20" : "bg-muted"}`}>
                  <UserCircle className={`h-5 w-5 ${coachType === "private" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Private Coach</p>
                    {coachType === "private" && (
                      <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    I train individual athletes or small groups privately.
                  </p>
                </div>
              </button>

              <button
                onClick={() => setCoachType("team")}
                className={[
                  "w-full rounded-xl border-2 p-4 text-left flex items-start gap-4 transition-all duration-150 focus:outline-none",
                  coachType === "team"
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/40",
                ].join(" ")}
              >
                <div className={`h-10 w-10 rounded-lg flex items-center justify-center shrink-0 transition-colors ${coachType === "team" ? "bg-primary/20" : "bg-muted"}`}>
                  <Building2 className={`h-5 w-5 ${coachType === "team" ? "text-primary" : "text-muted-foreground"}`} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold text-sm">Team Coach</p>
                    {coachType === "team" && (
                      <span className="h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                    I coach a school, club, or organized team.
                  </p>
                </div>
              </button>

              <Button className="w-full mt-2" disabled={!coachType} onClick={next}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <button
                onClick={() => finish()}
                className="w-full mt-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 1: Sport selection */}
          {step === 1 && (
            <div className="px-6 pt-5 pb-6">
              <div className="grid grid-cols-3 gap-2.5">
                {SPORTS.map((sport) => (
                  <button
                    key={sport.id}
                    disabled={!sport.available}
                    onClick={() => sport.available && setSelectedSport(sport.id)}
                    className={[
                      "relative rounded-xl border-2 p-3.5 flex flex-col items-center gap-1.5 text-sm font-medium transition-all duration-150 focus:outline-none",
                      !sport.available
                        ? "opacity-40 cursor-not-allowed border-border"
                        : selectedSport === sport.id
                        ? "border-primary bg-primary/10 cursor-pointer"
                        : "border-border hover:border-primary/40 cursor-pointer",
                    ].join(" ")}
                  >
                    <span className="text-2xl leading-none">{sport.icon}</span>
                    <span className="text-xs leading-tight">{sport.name}</span>
                    {!sport.available && (
                      <span className="absolute -top-2 left-1/2 -translate-x-1/2 text-[9px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap border">
                        Soon
                      </span>
                    )}
                    {selectedSport === sport.id && (
                      <span className="absolute top-1.5 right-1.5 h-4 w-4 rounded-full bg-primary flex items-center justify-center">
                        <Check className="h-2.5 w-2.5 text-primary-foreground" />
                      </span>
                    )}
                  </button>
                ))}
              </div>

              <Button className="w-full mt-5" disabled={!selectedSport} onClick={next}>
                Continue <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
              <button
                onClick={() => finish()}
                className="w-full mt-2 text-xs text-muted-foreground hover:text-foreground transition-colors py-1"
              >
                Skip for now
              </button>
            </div>
          )}

          {/* Step 2: Tutorial walkthrough */}
          {step === 2 && (
            <div className="px-6 pt-5 pb-6 space-y-3">
              {TUTORIAL_STEPS.map((s, i) => (
                <div key={i} className="flex items-start gap-3 rounded-xl border bg-card p-3.5">
                  <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                    <s.icon className="h-4 w-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold leading-snug">{s.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                      {s.description}
                    </p>
                  </div>
                </div>
              ))}
              <Button className="w-full mt-1" onClick={next}>
                Got It <ChevronRight className="h-4 w-4 ml-1" />
              </Button>
            </div>
          )}

          {/* Step 3: CTA */}
          {step === 3 && (
            <div className="px-6 pt-5 pb-6 space-y-4">
              <div className="rounded-xl border bg-gradient-to-br from-emerald-500/10 to-primary/5 p-5 text-center space-y-2">
                <div className="mx-auto h-10 w-10 rounded-full bg-emerald-500/15 flex items-center justify-center">
                  <Zap className="h-5 w-5 text-emerald-400" />
                </div>
                <p className="text-sm font-semibold">Build a Professional Program</p>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  ClipMVP helps you stay organized, track every athlete's real progress, and show
                  parents and players that you run a serious, data-driven program.
                </p>
              </div>

              <div className="space-y-2">
                {coachType === "team" ? (
                  <Button className="w-full" onClick={() => finish("/coach/teams")}>
                    <Building2 className="h-4 w-4 mr-2" />
                    Create Your First Team
                  </Button>
                ) : (
                  <Button className="w-full" onClick={() => finish("/coach/athletes")}>
                    <Users className="h-4 w-4 mr-2" />
                    Start by Inviting Athletes
                  </Button>
                )}
                <Button variant="outline" className="w-full" onClick={() => finish()}>
                  Go to Dashboard
                </Button>
              </div>
            </div>
          )}

          {/* Step dots */}
          <div className="flex justify-center gap-1.5 pb-4">
            {Array.from({ length: totalSteps }).map((_, i) => (
              <div
                key={i}
                className={`h-1.5 rounded-full transition-all duration-300 ${
                  i === step ? "w-6 bg-primary" : "w-1.5 bg-muted"
                }`}
              />
            ))}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export default CoachOnboarding;
