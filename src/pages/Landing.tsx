import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { motion } from "framer-motion";
import {
  Target, Users, BarChart3, Calendar, Dumbbell, Check, ArrowRight,
  TrendingUp, ClipboardList, Star, Zap, Shield, Sparkles,
} from "lucide-react";

const DAILY_QUOTES = [
  "Small improvements every day.",
  "Progress is built, not discovered.",
  "Consistency creates confidence.",
  "Train with purpose.",
  "Work quietly. Let results speak.",
  "Earn today's improvement.",
  "Discipline outlasts motivation.",
];

const getDailyQuote = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / 86400000);
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
};

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.08, duration: 0.5 },
  }),
};

const features = [
  {
    icon: Users,
    title: "Roster Management",
    desc: "Invite athletes directly to your program. Manage positions, profiles, and development in one place.",
  },
  {
    icon: Dumbbell,
    title: "Programs & Workouts",
    desc: "Build practice rubrics, assign drills, and give athletes at-home workout checklists they can track.",
  },
  {
    icon: Calendar,
    title: "Smart Scheduling",
    desc: "Plan individual or group sessions with recurring options. Your full week mapped out in seconds.",
  },
  {
    icon: BarChart3,
    title: "Metrics & Baselines",
    desc: "Record position-specific metrics from day one. Track real improvement against each athlete's starting baseline.",
  },
  {
    icon: ClipboardList,
    title: "Goal Tracking",
    desc: "Set measurable goals with your athletes and monitor progress over time, visible to coaches and parents.",
  },
  {
    icon: TrendingUp,
    title: "Session Logging",
    desc: "Log every practice, track attendance, RPE, and workload. Build a data-driven coaching history.",
  },
];

const steps = [
  {
    step: "01",
    title: "Invite Your Athletes",
    desc: "Send a link. Your athletes join, fill in their info, and they're on your roster instantly.",
  },
  {
    step: "02",
    title: "Build Your Programs",
    desc: "Create practice plans, assign workouts, and set goals, all organized by athlete and position.",
  },
  {
    step: "03",
    title: "Track Real Progress",
    desc: "Log sessions, record metrics, and show athletes and parents measurable improvement over time.",
  },
];

const pricingTiers = [
  { name: "Starter", range: "1–5 athletes",   ppa: 15, highlight: false },
  { name: "Growth",  range: "6–15 athletes",  ppa: 13, highlight: true  },
  { name: "Club",    range: "16–30 athletes", ppa: 11, highlight: false },
];

const aiPricingTiers = [
  { range: "1–15 athletes",  ppa: 5 },
  { range: "16–30 athletes", ppa: 3 },
];

const comparisonRows = [
  { feature: "Athletes",         preview: "1",  paid: "Up to 30" },
  { feature: "Weekly Goals",     preview: "✓",  paid: "✓" },
  { feature: "Reflections",      preview: "✓",  paid: "✓" },
  { feature: "Progress Dashboard", preview: "✓", paid: "✓" },
  { feature: "AI Insights",      preview: "✗",  paid: "✓ (add-on)" },
  { feature: "Assistant Coaches", preview: "✗", paid: "✓" },
];

const platformFeatures = [
  "Full roster management",
  "Session scheduling",
  "Metrics & baselines",
  "Goals & progress tracking",
  "Coach notes",
  "Program checklists",
  "Video submissions",
  "Parent visibility",
];

const testimonials = [
  {
    quote: "ClipMVP changed how I run my program. Everything is organized, and parents actually see the work we're putting in.",
    name: "Coach Rivera",
    role: "Travel Baseball Coach",
  },
  {
    quote: "I used to keep notes in a notebook. Now I have metrics, goals, and programs for every athlete. It's a game changer.",
    name: "Coach Thompson",
    role: "Private Pitching Instructor",
  },
  {
    quote: "My athletes love getting their workout checklists. They stay engaged even on off days.",
    name: "Coach Williams",
    role: "Youth Hitting Coach",
  },
];

const Landing = () => {
  return (
    <div className="min-h-screen bg-background text-foreground">

      {/* Nav */}
      <nav className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-primary flex items-center justify-center shadow-sm">
              <Target className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="text-xl font-bold font-['Space_Grotesk']">ClipMVP</span>
          </div>
          <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-foreground transition-colors">How It Works</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </div>
          <div className="flex items-center gap-3">
            <Button size="sm" asChild><Link to="/signup">Get Started <ArrowRight className="ml-1.5 h-3.5 w-3.5" /></Link></Button>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative overflow-hidden py-24 lg:py-36">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-10%,hsl(0_100%_45%/0.12),transparent)]" />
        <div className="relative mx-auto max-w-4xl px-6 text-center">
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }}>
            <Badge variant="outline" className="mb-6 gap-1.5 px-3 py-1 text-xs font-medium">
              <Zap className="h-3 w-3 text-primary" /> Built for serious coaches
            </Badge>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.6 }}
            className="text-5xl font-bold leading-[1.1] tracking-tight lg:text-7xl font-['Space_Grotesk']"
          >
            Clarity for Coaches.{" "}
            <span className="text-primary">Accountability for Athletes.</span>
          </motion.h1>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.18, duration: 0.6 }}
            className="mt-4 text-base italic text-muted-foreground/70"
          >
            "{getDailyQuote()}"
          </motion.p>
          <motion.p
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.6 }}
            className="mt-6 text-lg text-muted-foreground max-w-2xl mx-auto leading-relaxed"
          >
            ClipMVP gives coaches the tools to manage athletes, track real progress, and build
            a program that athletes and parents take seriously.
          </motion.p>
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.6 }}
            className="mt-10 flex justify-center"
          >
            <Button size="lg" className="text-base px-8 h-12" asChild>
              <Link to="/signup">Start 7-Day Coach Preview <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
          </motion.div>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="mt-4 text-xs text-muted-foreground"
          >
            7-day preview. No credit card required. Pay per athlete when you scale.
          </motion.p>
        </div>
      </section>

      {/* Stats strip */}
      <section className="border-y bg-card/50">
        <div className="mx-auto max-w-6xl px-6 py-10 grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {[
            { value: "100%", label: "Data owned by you" },
            { value: "3 roles", label: "Coach, Athlete, Parent" },
            { value: "Real-time", label: "Progress tracking" },
            { value: "Free", label: "To get started" },
          ].map((s) => (
            <div key={s.label}>
              <p className="text-2xl font-bold font-['Space_Grotesk'] text-primary">{s.value}</p>
              <p className="text-sm text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="py-24" id="features">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-['Space_Grotesk']">Everything in One Place</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Stop juggling spreadsheets and group chats. ClipMVP brings your entire program under one roof.
            </p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {features.map((f, i) => (
              <motion.div key={f.title} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="h-full border-border hover:border-primary/30 transition-all duration-200 hover:shadow-sm">
                  <CardContent className="p-6">
                    <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                      <f.icon className="h-5 w-5 text-primary" />
                    </div>
                    <h3 className="font-semibold text-base mb-2 font-['Space_Grotesk']">{f.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-24 border-t bg-card/30" id="how-it-works">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-['Space_Grotesk']">Up and Running in Minutes</h2>
            <p className="mt-3 text-muted-foreground">No setup headaches. Just start coaching.</p>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {steps.map((s, i) => (
              <motion.div key={s.step} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} className="text-center">
                <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
                  <span className="text-lg font-bold font-['Space_Grotesk'] text-primary">{s.step}</span>
                </div>
                <h3 className="font-semibold text-lg font-['Space_Grotesk'] mb-2">{s.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{s.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="py-24 border-t">
        <div className="mx-auto max-w-6xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-['Space_Grotesk']">Coaches Love It</h2>
            <p className="mt-3 text-muted-foreground">Real results from real programs.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {testimonials.map((t, i) => (
              <motion.div key={t.name} custom={i} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
                <Card className="h-full border-border">
                  <CardContent className="p-6 flex flex-col gap-4">
                    <div className="flex gap-0.5">
                      {[...Array(5)].map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground leading-relaxed flex-1">"{t.quote}"</p>
                    <div>
                      <p className="text-sm font-semibold">{t.name}</p>
                      <p className="text-xs text-muted-foreground">{t.role}</p>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section className="py-24 border-t bg-card/30" id="pricing">
        <div className="mx-auto max-w-5xl px-6">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold font-['Space_Grotesk']">Pricing That Grows With Your Program</h2>
            <p className="mt-3 text-muted-foreground max-w-xl mx-auto">
              Start with a 7-day Coach Preview. Scale your team when you're ready.
              Volume discounts apply automatically.
            </p>
          </div>

          {/* Preview vs Paid comparison */}
          <motion.div custom={0} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Card className="mb-10 overflow-hidden">
              <div className="grid grid-cols-3 bg-secondary/50 px-5 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>Feature</span>
                <span className="text-center">Coach Preview</span>
                <span className="text-center text-primary">Paid Plan</span>
              </div>
              {comparisonRows.map((row, i) => (
                <div key={row.feature} className={`grid grid-cols-3 px-5 py-3 text-sm border-t ${i % 2 === 0 ? "" : "bg-secondary/20"}`}>
                  <span className="font-medium">{row.feature}</span>
                  <span className={`text-center ${row.preview === "✗" ? "text-muted-foreground" : "text-emerald-400"}`}>{row.preview}</span>
                  <span className={`text-center ${row.paid === "✗" ? "text-muted-foreground" : "text-emerald-400"}`}>{row.paid}</span>
                </div>
              ))}
            </Card>
          </motion.div>

          {/* Per-athlete tiers */}
          <motion.div custom={1} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <p className="text-sm font-semibold text-center mb-4">Paid Plan — Per Athlete Pricing</p>
            <div className="grid gap-3 sm:grid-cols-3 mb-2">
              {pricingTiers.map((tier) => (
                <Card
                  key={tier.name}
                  className={`text-center ${tier.highlight ? "border-primary ring-1 ring-primary shadow-lg shadow-primary/10" : "border-border"}`}
                >
                  <CardContent className="p-5">
                    {tier.highlight && (
                      <span className="inline-block mb-2 bg-primary text-primary-foreground text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        Most Common
                      </span>
                    )}
                    <p className="font-bold font-['Space_Grotesk'] text-base">{tier.name}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5 mb-3">{tier.range}</p>
                    <p className="text-3xl font-bold font-['Space_Grotesk'] text-primary">${tier.ppa}</p>
                    <p className="text-[11px] text-muted-foreground">per athlete / mo</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <p className="text-center text-xs text-muted-foreground mb-3">
              Discount applies to your entire roster once you hit the next tier.
            </p>
            <p className="text-center text-xs text-muted-foreground mb-10">
              Managing 30+ athletes?{" "}
              <a href="mailto:support@clipmvp.com" className="text-primary hover:underline font-medium">Contact us for custom pricing.</a>
            </p>
          </motion.div>

          {/* What's included */}
          <motion.div custom={2} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Card className="mb-8">
              <CardContent className="p-6">
                <p className="text-sm font-semibold mb-4">Everything included in every paid tier:</p>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {platformFeatures.map((f) => (
                    <div key={f} className="flex items-center gap-2 text-sm">
                      <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                      <span>{f}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* AI Premium add-on */}
          <motion.div custom={3} initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp}>
            <Card className="border-violet-500/30 bg-violet-500/5 mb-10">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-5">
                  <div>
                    <p className="font-bold font-['Space_Grotesk'] text-lg flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-violet-400" /> AI Premium Add-On
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      Reflection summaries, smart goal suggestions, team insights, and monthly athlete reports.
                      Not available during preview.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-violet-400 border-violet-500/40 shrink-0 self-start">Optional</Badge>
                </div>
                <div className="grid grid-cols-2 gap-3 mb-4">
                  {aiPricingTiers.map((t) => (
                    <div key={t.range} className="rounded-lg border border-violet-500/20 bg-violet-500/5 p-3 text-center">
                      <p className="text-xl font-bold font-['Space_Grotesk'] text-violet-400">+${t.ppa}</p>
                      <p className="text-[11px] text-muted-foreground mt-0.5">per athlete / mo</p>
                      <p className="text-[10px] text-muted-foreground mt-1">{t.range}</p>
                    </div>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  AI never replaces your coaching judgment. All outputs require coach review before sharing.
                </p>
              </CardContent>
            </Card>
          </motion.div>

          <div className="text-center flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button size="lg" className="px-10 h-12 text-base" asChild>
              <Link to="/signup">Start 7-Day Coach Preview <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <Button size="lg" variant="outline" className="h-12" asChild>
              <a href="mailto:support@clipmvp.com">Program-Wide Solutions (30+ Athletes)</a>
            </Button>
          </div>
          <p className="text-center mt-3 text-xs text-muted-foreground">No credit card required for preview. Cancel anytime.</p>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-24 border-t">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <motion.div initial="hidden" whileInView="visible" viewport={{ once: true }} variants={fadeUp} custom={0}>
            <div className="mx-auto mb-6 h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/30">
              <Shield className="h-7 w-7 text-primary-foreground" />
            </div>
            <h2 className="text-3xl font-bold font-['Space_Grotesk'] mb-4">
              Your Program Deserves a Professional Edge
            </h2>
            <p className="text-muted-foreground mb-8 leading-relaxed max-w-xl mx-auto">
              The coaches who win aren't just the ones with the best drills.
              They're the ones who show up organized, data-driven, and professional.
              ClipMVP makes that easy.
            </p>
            <Button size="lg" className="px-10 h-12 text-base" asChild>
              <Link to="/signup">Start 7-Day Coach Preview <ArrowRight className="ml-2 h-4 w-4" /></Link>
            </Button>
            <p className="mt-4 text-xs text-muted-foreground">No credit card required. Pay per athlete when you scale.</p>
            <p className="mt-3 text-sm text-muted-foreground">
              Already have an account?{" "}
              <Link to="/login" className="text-primary hover:underline font-medium">Sign in</Link>
            </p>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="mx-auto max-w-6xl px-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="h-7 w-7 rounded-lg bg-primary flex items-center justify-center">
              <Target className="h-3.5 w-3.5 text-primary-foreground" />
            </div>
            <span className="font-semibold font-['Space_Grotesk']">ClipMVP</span>
          </div>
          <div className="flex items-center gap-6 text-sm text-muted-foreground">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
            <Link to="/signup" className="hover:text-foreground transition-colors">Get Started</Link>
            <Link to="/login" className="hover:text-foreground transition-colors">Sign In</Link>
          </div>
          <p className="text-sm text-muted-foreground">&copy; 2026 ClipMVP. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
