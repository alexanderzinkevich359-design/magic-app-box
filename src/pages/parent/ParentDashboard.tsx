import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Check, CreditCard, BarChart3, Target, Calendar, Crown, ArrowRight } from "lucide-react";

const subscriptionPlans = [
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    features: ["View athlete progress", "Session schedule", "Basic notifications", "1 athlete"],
    current: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    features: ["Detailed analytics", "Training plans", "Up to 3 athletes", "Priority support"],
    current: true,
  },
  {
    name: "Elite",
    price: "$39",
    period: "/month",
    features: ["Coach messaging", "Video analysis", "Unlimited athletes", "Early access"],
    current: false,
  },
];

const ParentDashboard = () => {
  const [currentPlan] = useState("Pro");

  return (
    <DashboardLayout role="parent">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Parent Dashboard</h1>
        <p className="text-muted-foreground mt-1">Monitor your athlete's progress and manage your subscription</p>
      </div>

      {/* Subscription banner */}
      <Card className="mb-8 border-primary/30 bg-primary/5">
        <CardContent className="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <Crown className="h-6 w-6 text-primary" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-semibold font-['Space_Grotesk']">Pro Plan</h3>
                <Badge variant="secondary" className="text-xs">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground">$19/month · Renews March 12, 2026</p>
            </div>
          </div>
          <Button variant="outline" size="sm">Manage Subscription</Button>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {[
          { label: "Athletes", value: "2", icon: Target },
          { label: "Upcoming Sessions", value: "3", icon: Calendar },
          { label: "Goals in Progress", value: "5", icon: BarChart3 },
          { label: "Plan", value: currentPlan, icon: CreditCard },
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

      {/* Athlete progress */}
      <div className="grid gap-6 lg:grid-cols-2 mb-8">
        {[
          { name: "Marcus Johnson", sport: "Basketball", goals: [
            { title: "Free throw accuracy", progress: 65 },
            { title: "Vertical jump", progress: 78 },
          ]},
          { name: "Emma Johnson", sport: "Tennis", goals: [
            { title: "First serve %", progress: 52 },
            { title: "Endurance", progress: 70 },
          ]},
        ].map((athlete) => (
          <Card key={athlete.name}>
            <CardHeader>
              <CardTitle className="text-lg font-['Space_Grotesk']">{athlete.name}</CardTitle>
              <CardDescription>{athlete.sport}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {athlete.goals.map((goal) => (
                <div key={goal.title} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{goal.title}</span>
                    <span className="font-medium text-primary">{goal.progress}%</span>
                  </div>
                  <Progress value={goal.progress} className="h-2" />
                </div>
              ))}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Subscription plans */}
      <Card>
        <CardHeader>
          <CardTitle className="font-['Space_Grotesk']">Subscription Plans</CardTitle>
          <CardDescription>Upgrade or change your plan anytime</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-3">
            {subscriptionPlans.map((plan) => (
              <div
                key={plan.name}
                className={`rounded-lg border p-5 ${plan.current ? "border-primary bg-primary/5" : "border-border"}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-semibold font-['Space_Grotesk']">{plan.name}</h4>
                  {plan.current && <Badge>Current</Badge>}
                </div>
                <p className="text-2xl font-bold font-['Space_Grotesk'] mb-4">
                  {plan.price}<span className="text-sm text-muted-foreground font-normal">{plan.period}</span>
                </p>
                <ul className="space-y-2 mb-4">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-primary shrink-0" /> {f}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={plan.current ? "secondary" : "outline"}
                  className="w-full"
                  disabled={plan.current}
                >
                  {plan.current ? "Current Plan" : "Switch Plan"}
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </DashboardLayout>
  );
};

export default ParentDashboard;
