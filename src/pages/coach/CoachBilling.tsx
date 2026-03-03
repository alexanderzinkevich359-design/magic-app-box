import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import DashboardLayout from "@/components/DashboardLayout";
import AIPremiumModal from "@/components/AIPremiumModal";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check, Zap, Users, UserCircle, Building2, TrendingDown,
  Sparkles, Lock, Loader2, Clock,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useAIPremium } from "@/hooks/useAIPremium";
import { supabase } from "@/integrations/supabase/client";
import {
  pricePerAthlete, monthlyTotal, hasVolumeDiscount, tierLabel, PRICING_TIERS,
  aiPricePerAthlete, aiMonthlyTotal, combinedMonthlyTotal, AI_PRICING_TIERS,
  AI_HOURS_SAVED_PER_WEEK,
} from "@/lib/pricing";

// ── Component ──────────────────────────────────────────────────────────────────

const CoachBilling = () => {
  const { user, profile } = useAuth();
  const { isEnabled: aiEnabled, disable, isDisabling } = useAIPremium();
  const coachType = profile?.coach_type ?? null;

  const [showAIModal, setShowAIModal] = useState(false);

  const { data: athleteCount = 0 } = useQuery({
    queryKey: ["coach-athlete-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { count } = await supabase
        .from("coach_athlete_links")
        .select("*", { count: "exact", head: true })
        .eq("coach_user_id", user.id);
      return count ?? 0;
    },
    enabled: !!user,
  });

  const [calcCount, setCalcCount] = useState<number | "">(1);
  useEffect(() => {
    if (athleteCount > 0) setCalcCount(athleteCount);
  }, [athleteCount]);

  const displayCount  = typeof calcCount === "number" ? Math.max(1, calcCount) : 1;
  const basePPA       = pricePerAthlete(displayCount);
  const baseTotal     = monthlyTotal(displayCount);
  const aiPPA         = aiPricePerAthlete(displayCount);
  const aiTotal       = aiMonthlyTotal(displayCount);
  const combinedTotal = combinedMonthlyTotal(displayCount, aiEnabled);
  const discount      = hasVolumeDiscount(displayCount);
  const label         = tierLabel(displayCount);
  const hoursSavedMo  = AI_HOURS_SAVED_PER_WEEK * 4;

  return (
    <DashboardLayout role="coach">
      {/* Page header */}
      <div className="mb-8 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold font-['Space_Grotesk']">Billing & Plans</h1>
          <p className="text-muted-foreground mt-1">
            Pay only for the athletes you coach. Volume discounts apply automatically.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {aiEnabled && (
            <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/40 border gap-1.5 px-2.5 py-1">
              <Sparkles className="h-3 w-3" /> AI Premium Coach
            </Badge>
          )}
          {coachType && (
            <Badge variant="outline" className="flex items-center gap-1.5 px-2.5 py-1">
              {coachType === "private"
                ? <><UserCircle className="h-3.5 w-3.5" /> Private Coach</>
                : <><Building2 className="h-3.5 w-3.5" /> Team Coach</>}
            </Badge>
          )}
        </div>
      </div>

      {/* Current usage banner */}
      <div className="mb-6 rounded-xl border bg-primary/5 p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Zap className="h-5 w-5 text-primary shrink-0" />
          <div>
            <p className="text-sm font-semibold">
              You have{" "}
              <span className="text-primary">{athleteCount} {athleteCount === 1 ? "athlete" : "athletes"}</span>{" "}
              on your roster
            </p>
            <p className="text-xs text-muted-foreground">
              {athleteCount === 0
                ? "Add athletes to see your pricing"
                : `$${pricePerAthlete(athleteCount)}/athlete base · $${combinedMonthlyTotal(athleteCount, aiEnabled).toFixed(2)}/month total`}
            </p>
          </div>
        </div>
        {athleteCount > 0 && (
          <div className="text-right shrink-0">
            <p className="text-2xl font-bold font-['Space_Grotesk']">
              ${combinedMonthlyTotal(athleteCount, aiEnabled).toFixed(2)}
            </p>
            <p className="text-xs text-muted-foreground">per month</p>
          </div>
        )}
      </div>

      {/* AI Premium add-on card */}
      <div className={`mb-8 rounded-xl border-2 p-5 transition-all ${aiEnabled ? "border-violet-500/40 bg-violet-500/5" : "border-border"}`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className={`h-11 w-11 rounded-xl flex items-center justify-center shrink-0 ${aiEnabled ? "bg-violet-500/20" : "bg-muted"}`}>
              {aiEnabled
                ? <Sparkles className="h-5 w-5 text-violet-400" />
                : <Lock className="h-5 w-5 text-muted-foreground" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="font-semibold">AI Premium Add-On</p>
                {aiEnabled && (
                  <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 border text-[10px] px-1.5 py-0">Active</Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {aiEnabled
                  ? `Saving you ~${hoursSavedMo} hours/month · $${aiPricePerAthlete(athleteCount)}/athlete`
                  : "An assistant coach that never misses a pattern."}
              </p>
              {aiEnabled && (
                <div className="flex items-center gap-1.5 text-xs text-emerald-400 mt-1.5">
                  <Clock className="h-3 w-3" /> Estimated {hoursSavedMo} hours saved this month
                </div>
              )}
            </div>
          </div>
          {aiEnabled ? (
            <Button variant="outline" size="sm" className="shrink-0 text-muted-foreground" onClick={() => disable()} disabled={isDisabling}>
              {isDisabling && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
              Disable
            </Button>
          ) : (
            <Button size="sm" className="shrink-0 bg-violet-600 hover:bg-violet-700 text-white gap-1.5" onClick={() => setShowAIModal(true)}>
              <Sparkles className="h-3.5 w-3.5" /> Enable AI
            </Button>
          )}
        </div>

        <div className="mt-4 grid sm:grid-cols-2 gap-y-1.5 gap-x-4 pl-[60px]">
          {["Weekly performance summaries", "Goal recommendations", "Engagement & risk alerts", "Reflection synthesis", "Parent-ready reports", "Trend detection across weeks"].map((f) => (
            <div key={f} className={`flex items-center gap-2 text-xs ${aiEnabled ? "text-emerald-400" : "text-muted-foreground"}`}>
              {aiEnabled ? <Check className="h-3 w-3 shrink-0" /> : <Lock className="h-3 w-3 shrink-0" />} {f}
            </div>
          ))}
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
        {/* Pricing tables */}
        <div className="space-y-6">
          <div className="space-y-3">
            <h2 className="text-base font-semibold font-['Space_Grotesk']">Base Platform Pricing</h2>
            <Card>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Athletes</th>
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Tier</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Per Athlete</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Savings</th>
                    </tr>
                  </thead>
                  <tbody>
                    {PRICING_TIERS.map((tier, i) => {
                      const isActive = athleteCount >= tier.min && athleteCount <= tier.max;
                      const tierNames = ["Starter", "Growth", "Club", "Program", "Elite"];
                      const rangeLabel = tier.max === Infinity ? `${tier.min}+` : `${tier.min}–${tier.max}`;
                      return (
                        <tr key={i} className={`border-b last:border-b-0 ${isActive ? "bg-primary/5" : "hover:bg-secondary/30"}`}>
                          <td className="px-4 py-3 font-medium">
                            {rangeLabel}
                            {isActive && <Badge className="ml-2 text-[10px] px-1.5 py-0">Current</Badge>}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{tierNames[i]}</td>
                          <td className="px-4 py-3 text-right font-semibold">${tier.pricePerAthlete}/mo</td>
                          <td className="px-4 py-3 text-right text-xs font-medium">
                            {i === 0
                              ? <span className="text-muted-foreground">Base rate</span>
                              : <span className="text-emerald-400">-${15 - tier.pricePerAthlete}/athlete</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold font-['Space_Grotesk']">AI Premium Add-On Pricing</h2>
              {aiEnabled
                ? <Badge className="bg-violet-500/20 text-violet-400 border-violet-500/30 border text-[10px] gap-1"><Sparkles className="h-2.5 w-2.5" /> Active</Badge>
                : <Badge variant="outline" className="text-[10px] gap-1"><Lock className="h-2.5 w-2.5" /> Add-on</Badge>}
            </div>
            <Card className={aiEnabled ? "border-violet-500/30" : ""}>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left px-4 py-3 font-medium text-muted-foreground">Athletes</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">AI Add-On</th>
                      <th className="text-right px-4 py-3 font-medium text-muted-foreground">Combined</th>
                    </tr>
                  </thead>
                  <tbody>
                    {AI_PRICING_TIERS.map((tier, i) => {
                      const isActive = athleteCount >= tier.min && athleteCount <= tier.max;
                      const rangeLabel = tier.max === Infinity ? `${tier.min}+` : `${tier.min}–${tier.max}`;
                      const basePriceForRange = pricePerAthlete(tier.min);
                      return (
                        <tr key={i} className={`border-b last:border-b-0 ${isActive ? "bg-violet-500/5" : "hover:bg-secondary/30"}`}>
                          <td className="px-4 py-3 font-medium">
                            {rangeLabel}
                            {isActive && <Badge className="ml-2 text-[10px] px-1.5 py-0 bg-violet-500/20 text-violet-400 border-violet-500/30 border">Current</Badge>}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-violet-400">+${tier.pricePerAthlete}/mo</td>
                          <td className="px-4 py-3 text-right text-muted-foreground text-xs">${basePriceForRange + tier.pricePerAthlete}/athlete</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-['Space_Grotesk']">All plans include</CardTitle>
              <CardDescription>Every feature, every tier.</CardDescription>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-y-2 gap-x-6">
              {["Session scheduling", "Athlete metrics tracking", "Weekly goals & reflections", "Coach notes & feedback", "Program & drill library", "Team management", "Video submissions", "Progress analytics"].map((f) => (
                <div key={f} className="flex items-center gap-2 text-sm">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0" /> {f}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Live calculator */}
        <div className="space-y-4">
          <h2 className="text-base font-semibold font-['Space_Grotesk']">Pricing Calculator</h2>
          <Card className="sticky top-6">
            <CardHeader className="pb-4">
              <CardTitle className="text-base font-['Space_Grotesk'] flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" /> Estimate Your Cost
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium">Athletes</label>
                  <input
                    type="number" min={1} max={200} value={calcCount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") { setCalcCount(""); return; }
                      const n = parseInt(v, 10);
                      if (!isNaN(n) && n >= 1) setCalcCount(Math.min(200, n));
                    }}
                    className="w-20 text-right rounded-md border bg-background px-2 py-1 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
                <input type="range" min={1} max={100} value={displayCount} onChange={(e) => setCalcCount(Number(e.target.value))} className="w-full accent-primary" />
                <div className="flex justify-between text-[10px] text-muted-foreground">
                  <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
                </div>
              </div>

              <div className="rounded-xl border bg-card p-4 space-y-2.5">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Tier</span>
                  <span className="font-semibold">{label}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Base per athlete</span>
                  <span className="font-semibold">${basePPA}/mo</span>
                </div>
                {aiEnabled && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-violet-400 flex items-center gap-1"><Sparkles className="h-3 w-3" /> AI per athlete</span>
                    <span className="font-semibold text-violet-400">+${aiPPA}/mo</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Athletes</span>
                  <span className="font-semibold">{displayCount}</span>
                </div>
                <div className="border-t pt-2.5 space-y-1.5">
                  {aiEnabled && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span>Base subtotal</span><span>${baseTotal.toFixed(2)}/mo</span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-violet-400">
                        <span>AI add-on</span><span>+${aiTotal.toFixed(2)}/mo</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">Monthly Total</span>
                    <span className="text-2xl font-bold font-['Space_Grotesk'] text-primary">${combinedTotal.toFixed(2)}</span>
                  </div>
                </div>
              </div>

              {discount && (
                <div className="flex items-center gap-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-3 py-2.5">
                  <TrendingDown className="h-4 w-4 text-emerald-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-emerald-400">Volume Discount Applied</p>
                    <p className="text-[11px] text-muted-foreground">Saving ${(15 - basePPA) * displayCount}/mo vs base rate</p>
                  </div>
                </div>
              )}

              {aiEnabled && (
                <div className="flex items-center gap-2 rounded-lg bg-violet-500/10 border border-violet-500/20 px-3 py-2.5">
                  <Clock className="h-4 w-4 text-violet-400 shrink-0" />
                  <div>
                    <p className="text-xs font-semibold text-violet-400">AI Saves ~{hoursSavedMo} hrs/month</p>
                    <p className="text-[11px] text-muted-foreground">${(combinedTotal / hoursSavedMo).toFixed(2)} per hour saved</p>
                  </div>
                </div>
              )}

              {!aiEnabled ? (
                <Button className="w-full gap-1.5 bg-violet-600 hover:bg-violet-700 text-white" onClick={() => setShowAIModal(true)}>
                  <Sparkles className="h-4 w-4" /> Add AI Premium
                </Button>
              ) : (
                <Button className="w-full" onClick={() => alert("Upgrade flow coming soon.")}>
                  Manage Subscription
                </Button>
              )}
              <p className="text-center text-[11px] text-muted-foreground">No contracts. Cancel anytime.</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <AIPremiumModal open={showAIModal} onClose={() => setShowAIModal(false)} athleteCount={athleteCount || displayCount} />
    </DashboardLayout>
  );
};

export default CoachBilling;
