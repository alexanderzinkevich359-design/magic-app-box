import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target, Loader2, ArrowLeft, ArrowRight, Check, Phone } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";

const roles = [
  { value: "coach" as const, label: "Coach", desc: "Create programs & manage athletes", icon: "🏋️" },
  { value: "parent" as const, label: "Parent", desc: "Monitor progress & subscribe", icon: "👨‍👩‍👧" },
  { value: "athlete" as const, label: "Athlete", desc: "Train & track development", icon: "⚾" },
];

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? 300 : -300,
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction > 0 ? -300 : 300,
    opacity: 0,
  }),
};

const Signup = () => {
  const navigate = useNavigate();
  const { signUp } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState(1);
  const [direction, setDirection] = useState(1);

  // Step 1
  const [selectedRole, setSelectedRole] = useState<"coach" | "athlete" | "parent" | "">("");

  // Step 2
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const goNext = () => {
    setDirection(1);
    setStep(2);
  };

  const goBack = () => {
    setDirection(-1);
    setStep(1);
  };

  const passwordsMatch = password === confirmPassword;
  const passwordLongEnough = password.length >= 6;

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRole) return;
    if (!passwordsMatch) {
      toast({ title: "Passwords don't match", variant: "destructive" });
      return;
    }
    if (!passwordLongEnough) {
      toast({ title: "Password too short", description: "Must be at least 6 characters", variant: "destructive" });
      return;
    }

    setLoading(true);
    const formattedPhone = phone.startsWith("+") ? phone : `+1${phone.replace(/\D/g, "")}`;
    const { error } = await signUp(email, password, firstName, lastName, selectedRole, formattedPhone);
    setLoading(false);

    if (error) {
      toast({ title: "Signup failed", description: error.message, variant: "destructive" });
      return;
    }

    toast({
      title: "Account created!",
      description: "Check your email to verify your account, then sign in.",
    });
    navigate("/login");
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md overflow-hidden">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Target className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-['Space_Grotesk']">Join ClipMVP</CardTitle>
          <CardDescription>
            {step === 1 ? "First, tell us who you are" : "Create your account"}
          </CardDescription>

          {/* Step indicator */}
          <div className="flex items-center justify-center gap-2 mt-4">
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 1 ? "w-8 bg-primary" : "w-2 bg-primary/40"}`} />
            <div className={`h-2 rounded-full transition-all duration-300 ${step === 2 ? "w-8 bg-primary" : "w-2 bg-primary/40"}`} />
          </div>
        </CardHeader>

        <CardContent className="relative min-h-[380px]">
          <AnimatePresence mode="wait" custom={direction}>
            {step === 1 && (
              <motion.div
                key="step1"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label className="text-base font-medium">I am a...</Label>
                  <div className="space-y-3 mt-3">
                    {roles.map((r) => (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => setSelectedRole(r.value)}
                        className={`w-full flex items-center gap-4 rounded-xl border p-4 text-left transition-all ${
                          selectedRole === r.value
                            ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                            : "border-border hover:border-primary/40"
                        }`}
                      >
                        <span className="text-2xl">{r.icon}</span>
                        <div className="flex-1">
                          <span className={`font-semibold ${selectedRole === r.value ? "text-primary" : "text-foreground"}`}>
                            {r.label}
                          </span>
                          <p className="text-xs text-muted-foreground mt-0.5">{r.desc}</p>
                        </div>
                        {selectedRole === r.value && (
                          <Check className="h-5 w-5 text-primary" />
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={goNext}
                  className="w-full mt-6"
                  disabled={!selectedRole}
                >
                  Continue
                  <ArrowRight className="h-4 w-4 ml-2" />
                </Button>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div
                key="step2"
                custom={direction}
                variants={slideVariants}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.3, ease: "easeInOut" }}
              >
                <form onSubmit={handleSignup} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="firstName">First Name</Label>
                      <Input
                        id="firstName"
                        placeholder="John"
                        value={firstName}
                        onChange={(e) => setFirstName(e.target.value)}
                        required
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="lastName">Last Name</Label>
                      <Input
                        id="lastName"
                        placeholder="Doe"
                        value={lastName}
                        onChange={(e) => setLastName(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="email">Email (Username)</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="you@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="phone" className="flex items-center gap-1.5">
                      <Phone className="h-3.5 w-3.5" />
                      Phone Number
                    </Label>
                    <Input
                      id="phone"
                      type="tel"
                      placeholder="+1 (555) 123-4567"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      required
                    />
                    <p className="text-[11px] text-muted-foreground">Used for two-factor authentication</p>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label htmlFor="password">Password</Label>
                      <Input
                        id="password"
                        type="password"
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="confirmPassword">Confirm</Label>
                      <Input
                        id="confirmPassword"
                        type="password"
                        placeholder="••••••••"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        required
                        minLength={6}
                        className={confirmPassword && !passwordsMatch ? "border-destructive" : ""}
                      />
                    </div>
                  </div>
                  {confirmPassword && !passwordsMatch && (
                    <p className="text-xs text-destructive">Passwords don't match</p>
                  )}

                  <div className="flex gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={goBack} className="flex-shrink-0">
                      <ArrowLeft className="h-4 w-4 mr-1" />
                      Back
                    </Button>
                    <Button
                      type="submit"
                      className="flex-1"
                      disabled={!firstName || !lastName || !email || !phone || !passwordsMatch || !passwordLongEnough || loading}
                    >
                      {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                      Create Account
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}
          </AnimatePresence>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

export default Signup;
