import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Check, Sparkles, Clock, ShieldAlert, FileText, Target, TrendingUp, Loader2 } from "lucide-react";
import { useAIPremium } from "@/hooks/useAIPremium";
import { aiPricePerAthlete, aiMonthlyTotal } from "@/lib/pricing";

interface AIPremiumModalProps {
  open: boolean;
  onClose: () => void;
  athleteCount?: number;
}

const FEATURE_BULLETS = [
  { icon: Clock,        text: "Save 4–6 hours every week on summaries and reports" },
  { icon: ShieldAlert,  text: "Spot disengagement before it becomes a problem" },
  { icon: FileText,     text: "Auto-generate weekly athlete summaries" },
  { icon: Target,       text: "Smarter goal suggestions based on trends" },
  { icon: TrendingUp,   text: "Trend detection across weeks and athletes" },
];

const AIPremiumModal = ({ open, onClose, athleteCount = 1 }: AIPremiumModalProps) => {
  const { enable, isEnabling } = useAIPremium();

  const ppa   = aiPricePerAthlete(athleteCount);
  const total = aiMonthlyTotal(athleteCount);

  const handleEnable = () => {
    enable(undefined, {
      onSuccess: () => {
        onClose();
      },
    });
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          {/* AI Premium badge */}
          <div className="flex justify-center mb-4">
            <div className="h-14 w-14 rounded-2xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
              <Sparkles className="h-7 w-7 text-violet-400" />
            </div>
          </div>

          <DialogTitle className="font-['Space_Grotesk'] text-center text-xl">
            Coach Smarter. Not Harder.
          </DialogTitle>
          <DialogDescription className="text-center">
            An assistant coach that never misses a pattern.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* Feature bullets */}
          <div className="space-y-3">
            {FEATURE_BULLETS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-start gap-3">
                <div className="h-7 w-7 rounded-lg bg-violet-500/10 flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="h-3.5 w-3.5 text-violet-400" />
                </div>
                <div className="flex items-start gap-2 flex-1">
                  <Check className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                  <p className="text-sm">{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing summary */}
          <div className="rounded-xl border bg-card p-4 space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">AI Premium per athlete</span>
              <span className="font-semibold">${ppa}/mo</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Athletes</span>
              <span className="font-semibold">{athleteCount}</span>
            </div>
            {athleteCount > 15 && (
              <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                <Check className="h-3 w-3" /> Volume discount applied
              </div>
            )}
            <div className="border-t pt-2 flex items-center justify-between">
              <span className="font-semibold">Monthly Add-On</span>
              <span className="text-xl font-bold font-['Space_Grotesk'] text-violet-400">
                +${total.toFixed(2)}/mo
              </span>
            </div>
          </div>

          {/* CTA */}
          <div className="space-y-2">
            <Button
              className="w-full bg-violet-600 hover:bg-violet-700 text-white gap-2"
              onClick={handleEnable}
              disabled={isEnabling}
            >
              {isEnabling
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : <Sparkles className="h-4 w-4" />}
              Enable AI Premium for ${total.toFixed(2)}/mo
            </Button>
            <p className="text-center text-xs text-muted-foreground">
              Cancel anytime. AI never replaces your judgment.
            </p>
          </div>

          {/* Disclaimer */}
          <p className="text-center text-[10px] text-muted-foreground border-t pt-3">
            Payment processing powered by Stripe. Coming soon.
            <br />Contact support@clipmvp.com to activate early access.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AIPremiumModal;
