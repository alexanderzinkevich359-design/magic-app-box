import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Target } from "lucide-react";

const roles = [
  { value: "coach", label: "Coach", desc: "Manage athletes and training" },
  { value: "parent", label: "Parent", desc: "Monitor progress and subscribe" },
  { value: "athlete", label: "Athlete", desc: "Track your development" },
] as const;

const Signup = () => {
  const navigate = useNavigate();
  const [selectedRole, setSelectedRole] = useState<string>("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(`/${selectedRole || "athlete"}`);
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 rounded-xl bg-primary flex items-center justify-center">
            <Target className="h-6 w-6 text-primary-foreground" />
          </div>
          <CardTitle className="text-2xl font-['Space_Grotesk']">Create Account</CardTitle>
          <CardDescription>Join AthletePro today</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSignup} className="space-y-4">
            <div className="space-y-2">
              <Label>I am a...</Label>
              <div className="grid grid-cols-3 gap-2">
                {roles.map((r) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => setSelectedRole(r.value)}
                    className={`rounded-lg border p-3 text-center text-sm font-medium transition-all ${
                      selectedRole === r.value
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border hover:border-primary/40 text-muted-foreground"
                    }`}
                  >
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Full Name</Label>
              <Input id="name" placeholder="John Doe" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" placeholder="you@example.com" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" type="password" placeholder="••••••••" required />
            </div>
            <Button type="submit" className="w-full" disabled={!selectedRole}>
              Create Account
            </Button>
          </form>
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
