import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Clock, X, AlertTriangle } from "lucide-react";
import { useTrialStatus } from "@/hooks/useTrialStatus";
import UpgradeModal from "./UpgradeModal";

/**
 * Shown at the top of the coach dashboard during the 7-day preview.
 * Displays a countdown and an upgrade CTA.
 * Locks the UI (non-dismissable) once the trial has expired.
 */
const TrialBanner = () => {
  const { isOnTrial, isExpired, daysRemaining, isPaid } = useTrialStatus();
  const [dismissed, setDismissed] = useState(false);
  const [showUpgrade, setShowUpgrade] = useState(false);

  // Nothing to show for paid coaches or coaches not yet in a trial state
  if (isPaid) return null;
  // Hide if dismissed (only allowed while still active)
  if (dismissed && !isExpired) return null;

  const isUrgent = daysRemaining <= 2;

  return (
    <>
      <div className={`w-full px-4 py-2.5 flex items-center justify-between gap-3 text-sm ${
        isExpired
          ? "bg-red-500/10 border-b border-red-500/30 text-red-400"
          : isUrgent
          ? "bg-amber-500/10 border-b border-amber-500/30 text-amber-400"
          : "bg-primary/5 border-b border-primary/20 text-muted-foreground"
      }`}>
        <div className="flex items-center gap-2 min-w-0">
          {isExpired
            ? <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
            : <Clock className="h-4 w-4 shrink-0" />}
          <span className="truncate">
            {isExpired
              ? "Coach Preview ended. Upgrade to continue coaching your full roster."
              : `Coach Preview: ${daysRemaining} day${daysRemaining !== 1 ? "s" : ""} remaining · 1 athlete max during preview`}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Button
            size="sm"
            className="h-7 text-xs"
            variant={isExpired ? "destructive" : "default"}
            onClick={() => setShowUpgrade(true)}
          >
            {isExpired ? "Upgrade to Continue" : "Scale Your Team"}
          </Button>
          {!isExpired && (
            <button
              className="text-muted-foreground hover:text-foreground"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>
      <UpgradeModal
        open={showUpgrade}
        onClose={() => setShowUpgrade(false)}
        reason={isExpired ? "expired" : "athlete-cap"}
      />
    </>
  );
};

export default TrialBanner;
