import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Target, Users, BarChart3, Calendar, Dumbbell, CreditCard, Check, ArrowRight } from "lucide-react";

const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({ opacity: 1, y: 0, transition: { delay: i * 0.1, duration: 0.5 } }),
};

const features = [
  { icon: Users, title: "Athlete Management", desc: "Track rosters, profiles, and development milestones." },
  { icon: BarChart3, title: "Performance Analytics", desc: "Data-driven insights into skill progression." },
  { icon: Calendar, title: "Smart Scheduling", desc: "Calendar-based booking with automated reminders." },
  { icon: Dumbbell, title: "Training Programs", desc: "Custom workouts, conditioning, and nutrition plans." },
  { icon: Target, title: "Goal Setting", desc: "Set, track, and achieve measurable athlete goals." },
  { icon: CreditCard, title: "Subscription Billing", desc: "Simple monthly plans for parent access." },
];

const plans = [
  {
    name: "Starter",
    price: "$9",
    period: "/month",
    desc: "Perfect for getting started",
    features: ["View athlete progress", "Session schedule access", "Basic notifications", "1 athlete profile"],
    popular: false,
  },
  {
    name: "Pro",
    price: "$19",
    period: "/month",
    desc: "Best value for active families",
    features: ["Everything in Starter", "Detailed performance analytics", "Training & nutrition plans", "Up to 3 athlete profiles", "Priority support"],
    popular: true,
  },
  {
    name: "Elite",
    price: "$39",
    period: "/month",
    desc: "For serious athlete development",
    features: ["Everything in Pro", "1-on-1 coach messaging", "Video analysis access", "Unlimited athlete profiles", "Custom goal tracking", "Early feature access"],
    popular: false,
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-['Space_Grotesk']">AthletePro</span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" asChild><Link to="/login">Sign In</Link></Button>
            <Button asChild><Link to="/signup">Get Started</Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,hsl(0_100%_45%/0.15),transparent_60%)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="text-5xl font-bold leading-tight tracking-tight lg:text-7xl font-['Space_Grotesk']"
          >
            Elevate Every{" "}
            <span className="text-primary">Athlete</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto"
          >
            The performance tracking platform that connects coaches, athletes, and parents.
            Track progress, set goals, and unlock potential.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mt-10 flex flex-col sm:flex-row gap-4 justify-center"
          >
            <Button size="lg" className="text-base px-8" asChild>
              <Link to="/signup">Start Free Trial <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="text-base px-8" asChild>
              <Link to="/login">Sign In</Link>
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Features */}
      <section className="py-24 border-t">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-['Space_Grotesk']">Everything You Need</h2>
            <p className="mt-3 text-muted-foreground">Tools built for modern athletic development</p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div key={f.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="h-full bg-card border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-lg mb-2 font-['Space_Grotesk']">{f.title}</h3>
                    <p className="text-sm text-muted-foreground">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing — Subscription model for parents */}
      <section className="py-24 border-t" id="pricing">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-['Space_Grotesk']">Parent Subscription Plans</h2>
            <p className="mt-3 text-muted-foreground">Subscribe to unlock powerful features and track your athlete's growth</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3 max-w-5xl mx-auto">
            {plans.map((plan, i) => (
              <motion.div key={plan.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className={`h-full relative ${plan.popular ? "border-primary ring-1 ring-primary" : "border-border"}`}>
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-4 py-1 rounded-full">
                      Most Popular
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <CardTitle className="font-['Space_Grotesk']">{plan.name}</CardTitle>
                    <CardDescription>{plan.desc}</CardDescription>
                    <div className="mt-4">
                      <span className="text-4xl font-bold font-['Space_Grotesk']">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <ul className="space-y-3 mb-6">
                      {plan.features.map((f) => (
                        <li key={f} className="flex items-start gap-2 text-sm">
                          <Check className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                          <span>{f}</span>
                        </li>
                      ))}
                    </ul>
                    <Button className="w-full" variant={plan.popular ? "default" : "outline"} asChild>
                      <Link to="/signup">Get Started</Link>
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold font-['Space_Grotesk']">AthletePro</span>
          </div>
          <p className="text-sm text-muted-foreground">&copy; 2026 AthletePro. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
