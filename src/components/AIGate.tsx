import { type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Lock, Sparkles } from "lucide-react";
import { useAIPremium } from "@/hooks/useAIPremium";

interface AIGateProps {
  children: ReactNode;
  onUpgrade: () => void;
  /** Optional label shown on the lock overlay */
  featureLabel?: string;
}

/**
 * Wraps any AI-powered content. When AI Premium is disabled, blurs the
 * children and shows a lock overlay with an upgrade CTA. When enabled,
 * renders children normally.
 */
const AIGate = ({ children, onUpgrade, featureLabel = "AI Premium Feature" }: AIGateProps) => {
  const { isEnabled } = useAIPremium();

  if (isEnabled) return <>{children}</>;

  return (
    <div className="relative rounded-xl overflow-hidden">
      {/* Blurred preview */}
      <div className="blur-sm pointer-events-none select-none opacity-60" aria-hidden>
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-[2px] rounded-xl">
        <div className="text-center space-y-3 px-6 py-5">
          <div className="mx-auto h-10 w-10 rounded-xl bg-violet-500/15 border border-violet-500/30 flex items-center justify-center">
            <Lock className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <p className="text-sm font-semibold">{featureLabel}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Unlock Advanced Coaching Intelligence
            </p>
          </div>
          <Button
            size="sm"
            className="gap-1.5 bg-violet-600 hover:bg-violet-700 text-white"
            onClick={onUpgrade}
          >
            <Sparkles className="h-3.5 w-3.5" /> Unlock AI Premium
          </Button>
        </div>
      </div>
    </div>
  );
};

export default AIGate;
