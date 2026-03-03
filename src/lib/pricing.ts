// ── Roster cap ────────────────────────────────────────────────────────────────

/** Maximum athletes allowed on any paid plan. Programs above this contact sales. */
export const MAX_ATHLETES = 30;

// ── Base per-athlete pricing ───────────────────────────────────────────────────

export const PRICING_TIERS = [
  { min: 1,  max: 5,  pricePerAthlete: 15 },
  { min: 6,  max: 15, pricePerAthlete: 13 },
  { min: 16, max: 30, pricePerAthlete: 11 },
] as const;

/** Returns the base price per athlete per month for a given roster size. */
export function pricePerAthlete(athleteCount: number): number {
  const count = Math.max(0, athleteCount);
  const tier = PRICING_TIERS.find((t) => count >= t.min && count <= t.max);
  return tier?.pricePerAthlete ?? 15;
}

/** Returns the total monthly base cost for a given roster size. */
export function monthlyTotal(athleteCount: number): number {
  return pricePerAthlete(athleteCount) * Math.max(0, athleteCount);
}

/** Returns true when a base volume discount tier applies (roster > 5). */
export function hasVolumeDiscount(athleteCount: number): boolean {
  return athleteCount > 5;
}

/** Human-readable tier label for base plan. */
export function tierLabel(athleteCount: number): string {
  if (athleteCount <= 0)  return "No athletes yet";
  if (athleteCount <= 5)  return "Starter";
  if (athleteCount <= 15) return "Growth";
  return "Club";
}

// ── AI Premium add-on pricing ─────────────────────────────────────────────────

export const AI_PRICING_TIERS = [
  { min: 1,  max: 15, pricePerAthlete: 5 },
  { min: 16, max: 30, pricePerAthlete: 3 },
] as const;

/** Returns the AI Premium add-on price per athlete per month. */
export function aiPricePerAthlete(athleteCount: number): number {
  const count = Math.max(0, athleteCount);
  const tier = AI_PRICING_TIERS.find((t) => count >= t.min && count <= t.max);
  return tier?.pricePerAthlete ?? 5;
}

/** Returns the total monthly AI Premium add-on cost. */
export function aiMonthlyTotal(athleteCount: number): number {
  return aiPricePerAthlete(athleteCount) * Math.max(0, athleteCount);
}

/** Returns the combined monthly total (base + AI). */
export function combinedMonthlyTotal(athleteCount: number, aiEnabled: boolean): number {
  return monthlyTotal(athleteCount) + (aiEnabled ? aiMonthlyTotal(athleteCount) : 0);
}

/** Hours saved per week estimate shown in AI upsell copy. */
export const AI_HOURS_SAVED_PER_WEEK = 5;

// ── Trial ─────────────────────────────────────────────────────────────────────

/** Trial duration in days. */
export const TRIAL_DAYS = 7;

/** Max athletes allowed during trial. */
export const TRIAL_ATHLETE_LIMIT = 1;
