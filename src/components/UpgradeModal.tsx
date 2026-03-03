import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, ArrowRight, Users } from "lucide-react";
import { PRICING_TIERS } from "@/lib/pricing";

interface UpgradeModalProps {
  open: boolean;
  onClose: () => void;
  /** "athlete-cap" = tried to add 2nd athlete during trial
   *  "expired"     = trial window has passed */
  reason?: "athlete-cap" | "expired";
}

const TIER_LABELS = ["Starter", "Growth", "Club"] as const;

const UpgradeModal = ({ open, onClose, reason = "athlete-cap" }: UpgradeModalProps) => {
  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
              <Users className="h-7 w-7 text-primary" />
            </div>
          </div>
          <DialogTitle className="font-['Space_Grotesk'] text-center text-xl">
            Scale Beyond 1 Athlete
          </DialogTitle>
          <DialogDescription className="text-center">
            {reason === "expired"
              ? "Your 7-day Coach Preview has ended. Upgrade to keep your data and manage your full roster."
              : "Upgrade to manage your full roster and unlock AI insights."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Pricing tiers */}
          <div className="grid gap-2">
            {PRICING_TIERS.map((tier, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg border px-4 py-3">
                <div>
                  <p className="text-sm font-semibold">{TIER_LABELS[i]}</p>
                  <p className="text-xs text-muted-foreground">
                    {tier.min === tier.max ? `${tier.min} athlete` : `${tier.min}–${tier.max} athletes`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold">${tier.pricePerAthlete}<span className="text-xs text-muted-foreground font-normal">/athlete/mo</span></p>
                </div>
              </div>
            ))}
          </div>

          {/* What you keep */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Included in every plan</p>
            {["Full roster management (up to 30)", "Goals, reflections, and dashboard", "Session scheduling", "Metrics & baselines", "Parent visibility"].map((f) => (
              <div key={f} className="flex items-center gap-2 text-sm">
                <Check className="h-3.5 w-3.5 text-emerald-400 shrink-0" />
                <span>{f}</span>
              </div>
            ))}
          </div>

          {/* CTAs */}
          <div className="space-y-2">
            <Button className="w-full gap-2" onClick={onClose}>
              Scale Your Team <ArrowRight className="h-4 w-4" />
            </Button>
            <Button variant="outline" className="w-full text-sm" asChild>
              <a href="mailto:support@clipmvp.com">
                Contact Sales (30+ Athletes)
              </a>
            </Button>
          </div>

          <p className="text-center text-[10px] text-muted-foreground">
            Payment processing powered by Stripe. Coming soon.
            <br />Contact support@clipmvp.com to activate early access.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default UpgradeModal;
