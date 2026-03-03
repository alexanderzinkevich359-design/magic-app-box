import { useAuth } from "./useAuth";
import { TRIAL_DAYS, TRIAL_ATHLETE_LIMIT } from "@/lib/pricing";

export interface TrialStatus {
  /** True while the user is within the trial window (not yet paid). */
  isOnTrial: boolean;
  /** True once the 7-day window has passed and no paid plan is active. */
  isExpired: boolean;
  /** True if the coach has an active paid subscription. */
  isPaid: boolean;
  /** Days remaining in the trial (0 when expired). */
  daysRemaining: number;
  /** Max athletes allowed right now (1 on trial, 30 on paid). */
  athleteLimit: number;
}

/**
 * Derives trial status from the coach's account creation date.
 * A "paid" coach has tier !== "free" (set by the billing flow).
 * Until that is wired, every coach without a paid tier is treated as preview.
 */
export function useTrialStatus(): TrialStatus {
  const { user, profile } = useAuth();

  const isPaid = !!profile && profile.tier !== "free";

  if (isPaid) {
    return {
      isOnTrial: false,
      isExpired: false,
      isPaid: true,
      daysRemaining: 0,
      athleteLimit: 30,
    };
  }

  // Fall back to auth user created_at if no profile yet
  const createdAt = user?.created_at ? new Date(user.created_at) : new Date();
  const now = new Date();
  const msElapsed = now.getTime() - createdAt.getTime();
  const daysElapsed = msElapsed / (1000 * 60 * 60 * 24);
  const daysRemaining = Math.max(0, Math.ceil(TRIAL_DAYS - daysElapsed));
  const isExpired = daysRemaining === 0;

  return {
    isOnTrial: !isExpired,
    isExpired,
    isPaid: false,
    daysRemaining,
    athleteLimit: isExpired ? 0 : TRIAL_ATHLETE_LIMIT,
  };
}
