import DashboardLayout from "@/components/DashboardLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock, Sparkles, CreditCard, Bot, TrendingUp, CalendarDays, MessageCircle } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const FREE_FEATURES = [
  { icon: <CalendarDays className="h-4 w-4 text-blue-400" />, label: "Next 5 upcoming sessions" },
  { icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, label: "Engagement indicator" },
  { icon: <MessageCircle className="h-4 w-4 text-violet-400" />, label: "1 message to coach per week" },
];

const PREMIUM_FEATURES = [
  { icon: <CalendarDays className="h-4 w-4 text-blue-400" />, label: "Full upcoming schedule" },
  { icon: <TrendingUp className="h-4 w-4 text-emerald-400" />, label: "All goals, progress bars & coach notes" },
  { icon: <MessageCircle className="h-4 w-4 text-violet-400" />, label: "Full communications history" },
  { icon: <Bot className="h-4 w-4 text-primary" />, label: "AI Assistant — unlimited chat" },
];

const ParentBilling = () => {
  const { user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["parent-billing-profile", user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from("profiles")
        .select("ai_premium")
        .eq("user_id", user.id)
        .single();
      return data as any || null;
    },
    enabled: !!user,
  });

  const isPremium = profile?.ai_premium === true;

  return (
    <DashboardLayout role="parent">
      <p className="text-lg font-bold font-['Space_Grotesk'] mb-1">Billing</p>
      <p className="text-sm text-muted-foreground mb-6">Manage your parent portal subscription.</p>

      {/* Current plan */}
      <Card className="mb-4">
        <CardContent className="p-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Current Plan</p>
            <p className="font-bold text-base font-['Space_Grotesk']">{isPremium ? "Premium" : "Free"}</p>
          </div>
          <Badge
            variant="outline"
            className={isPremium
              ? "bg-primary/10 text-primary border-primary/30 text-xs"
              : "bg-secondary text-muted-foreground text-xs"}
          >
            {isPremium ? "Active" : "Free tier"}
          </Badge>
        </CardContent>
      </Card>

      {/* Free plan */}
      <Card className="mb-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <p className="font-semibold text-sm">Free</p>
            <p className="font-bold text-sm">$0</p>
          </div>
          <div className="space-y-2">
            {FREE_FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-2.5 text-sm">
                {f.icon}
                <span className="text-muted-foreground">{f.label}</span>
              </div>
            ))}
          </div>
          {!isPremium && (
            <Badge variant="outline" className="bg-secondary text-muted-foreground text-xs border-border">
              Your current plan
            </Badge>
          )}
        </CardContent>
      </Card>

      {/* Premium plan */}
      <Card className={`mb-6 ${!isPremium ? "border-primary/40 bg-primary/5" : ""}`}>
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <p className="font-semibold text-sm">Premium</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-sm">$4.99<span className="text-xs font-normal text-muted-foreground"> / mo</span></p>
            </div>
          </div>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground font-medium">Everything in Free, plus:</p>
            {PREMIUM_FEATURES.map(f => (
              <div key={f.label} className="flex items-center gap-2.5 text-sm">
                <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                <span>{f.label}</span>
              </div>
            ))}
          </div>
          {isPremium ? (
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 text-xs">
              Your current plan
            </Badge>
          ) : (
            <Button className="w-full mt-1" disabled>
              <CreditCard className="h-4 w-4 mr-2" />
              Upgrade to Premium — Coming Soon
            </Button>
          )}
        </CardContent>
      </Card>

      {/* Manage / cancel */}
      {isPremium && (
        <Card>
          <CardContent className="p-4 space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Manage Subscription</p>
            <Button variant="outline" className="w-full" disabled>
              <Lock className="h-3.5 w-3.5 mr-2" /> Manage via Stripe — Coming Soon
            </Button>
            <p className="text-xs text-muted-foreground text-center">Cancel anytime. Contact support if you need help.</p>
          </CardContent>
        </Card>
      )}
    </DashboardLayout>
  );
};

export default ParentBilling;
