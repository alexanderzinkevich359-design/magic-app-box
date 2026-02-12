import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Target, Dumbbell, TrendingUp, CheckCircle2, Clock } from "lucide-react";

const AthleteDashboard = () => {
  const goals = [
    { title: "Free throw accuracy", target: "80%", progress: 65, deadline: "Apr 1, 2026" },
    { title: "Vertical jump", target: "28 inches", progress: 78, deadline: "May 15, 2026" },
  ];

  const todayTraining = [
    { task: "Dynamic warm-up", duration: "10 min", done: true },
    { task: "Ball handling drills", duration: "20 min", done: true },
    { task: "Free throw practice (50 shots)", duration: "25 min", done: false },
    { task: "Conditioning sprints", duration: "15 min", done: false },
    { task: "Cool down & stretch", duration: "10 min", done: false },
  ];

  const coachFeedback = [
    { date: "Feb 10, 2026", text: "Great improvement on footwork this week. Keep up the consistency." },
    { date: "Feb 5, 2026", text: "Focus on left-hand dribbling during off-days." },
  ];

  return (
    <DashboardLayout role="athlete">
      <div className="mb-8">
        <h1 className="text-3xl font-bold font-['Space_Grotesk']">Hey, Marcus 👋</h1>
        <p className="text-muted-foreground mt-1">Here's your training overview for today</p>
      </div>

      {/* Stats */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {[
          { label: "Active Goals", value: goals.length, icon: Target },
          { label: "Training Streak", value: "12 days", icon: TrendingUp },
          { label: "Sessions This Week", value: "4/5", icon: Dumbbell },
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Today's training */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Space_Grotesk']">Today's Training</CardTitle>
            <CardDescription>Complete all tasks for the day</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {todayTraining.map((item) => (
              <div key={item.task} className="flex items-center gap-3 rounded-lg border p-3">
                {item.done ? (
                  <CheckCircle2 className="h-5 w-5 text-primary shrink-0" />
                ) : (
                  <Clock className="h-5 w-5 text-muted-foreground shrink-0" />
                )}
                <div className="flex-1">
                  <p className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : ""}`}>{item.task}</p>
                </div>
                <Badge variant={item.done ? "secondary" : "outline"} className="text-xs">{item.duration}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Goals */}
        <Card>
          <CardHeader>
            <CardTitle className="font-['Space_Grotesk']">My Goals</CardTitle>
            <CardDescription>Track your progress toward each goal</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {goals.map((goal) => (
              <div key={goal.title} className="space-y-2">
                <div className="flex justify-between">
                  <div>
                    <p className="text-sm font-medium">{goal.title}</p>
                    <p className="text-xs text-muted-foreground">Target: {goal.target} · Due: {goal.deadline}</p>
                  </div>
                  <span className="text-sm font-semibold text-primary">{goal.progress}%</span>
                </div>
                <Progress value={goal.progress} className="h-2" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Coach feedback */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-['Space_Grotesk']">Coach Feedback</CardTitle>
            <CardDescription>Recent notes from your coach</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {coachFeedback.map((fb) => (
              <div key={fb.date} className="rounded-lg border bg-secondary/30 p-4">
                <p className="text-sm">{fb.text}</p>
                <p className="text-xs text-muted-foreground mt-2">{fb.date}</p>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default AthleteDashboard;
