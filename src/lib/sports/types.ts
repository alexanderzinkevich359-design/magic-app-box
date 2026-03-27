// ─── Game stat types ─────────────────────────────────────────────────────────

export interface GameStatDef {
  key: string;
  label: string;
  full: string;
  sortOrder: number;
  /** If set, only show this column when athlete position is in this list */
  positions?: string[];
}

export interface DerivedStatDef {
  key: string;
  label: string;
  formula: string;
  precision: number;
}

/** `derived` key holds derived stat definitions; all other keys hold GameStatDef[] */
export type GameStatGroups = { derived?: DerivedStatDef[] } & Record<string, GameStatDef[] | DerivedStatDef[]>;

/** Returns stat group entries excluding the `derived` key */
export function getStatGroupEntries(gsg: GameStatGroups): [string, GameStatDef[]][] {
  return (Object.entries(gsg).filter(([k]) => k !== "derived") as [string, GameStatDef[]][]);
}

/**
 * Safely evaluate a derived stat formula (e.g. "h/ab") given a stats map.
 * Returns null when any operand is missing or result is non-finite.
 */
export function evalDerivedStat(formula: string, stats: Record<string, number>): number | null {
  let expr = formula;
  for (const [k, v] of Object.entries(stats)) {
    expr = expr.replace(new RegExp(`\\b${k}\\b`, "g"), String(v));
  }
  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`return (${expr})`)() as number;
    return isFinite(result) ? result : null;
  } catch {
    return null;
  }
}

/** Formats a batting average as ".333" instead of "0.333". Returns "---" for null. */
export function formatBattingAvg(v: number | null): string {
  if (v === null) return "---";
  return v.toFixed(3).replace(/^0/, "");
}

// ─── Session / sport config types ────────────────────────────────────────────

export interface SportMetric {
  type: string;
  label: string;
  unit: string;
  category: string;
}

export interface SportGoalTemplate {
  category: "skill" | "conditioning" | "mindset";
  title: string;
  target: string;
  rationale: string;
}

export interface SportSessionConfig {
  /** Positions for which pitch/serve counting UI is shown */
  pitchCountPositions: string[];
  /** Available pitch/serve types for the breakdown grid (empty = no type UI) */
  pitchTypes: string[];
  /** Whether to show throw_hand / bat_hand selection fields */
  hasHandTracking: boolean;
  /** Default throw count label, or null to hide the throw field entirely */
  throwLabel: string | null;
  /** Per-position override for throw label */
  throwLabelByPosition?: Record<string, string>;
  /** Per-position override for reps label */
  repsLabelByPosition?: Record<string, string>;
  /** Whether this sport uses sets (e.g. volleyball, tennis) */
  hasSets?: boolean;
  /** Maximum number of sets that can be entered */
  maxSets?: number;
}

export interface SportConfig {
  id: string;
  name: string;
  slug: string;
  icon: string | null;
  is_active: boolean;
  positions: string[];
  skills: string[];
  metrics_by_position: Record<string, SportMetric[]>;
  goal_templates_by_position: Record<string, SportGoalTemplate>;
  schedule_presets: {
    inSeason: { label: string; color: string }[];
    offSeason: { label: string; color: string }[];
  };
  session_config: SportSessionConfig;
  game_stat_groups: GameStatGroups;
}

/** Type-safe cast from raw Supabase row (JSONB cols come back as `unknown`) */
export function parseSportConfig(row: any): SportConfig {
  const sc = (row.session_config ?? {}) as any;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    icon: row.icon ?? null,
    is_active: row.is_active ?? true,
    positions: Array.isArray(row.positions) ? (row.positions as string[]) : [],
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    metrics_by_position: (row.metrics_by_position as Record<string, SportMetric[]>) ?? {},
    goal_templates_by_position:
      (row.goal_templates_by_position as Record<string, SportGoalTemplate>) ?? {},
    schedule_presets: (row.schedule_presets as SportConfig["schedule_presets"]) ?? {
      inSeason: [],
      offSeason: [],
    },
    session_config: {
      pitchCountPositions: sc.pitchCountPositions ?? [],
      pitchTypes: sc.pitchTypes ?? [],
      hasHandTracking: sc.hasHandTracking ?? false,
      throwLabel: sc.throwLabel ?? null,
      throwLabelByPosition: sc.throwLabelByPosition ?? {},
      repsLabelByPosition: sc.repsLabelByPosition ?? {},
      hasSets: sc.hasSets ?? false,
      maxSets: sc.maxSets ?? 5,
    },
    game_stat_groups: (row.game_stat_groups as GameStatGroups) ?? {},
  };
}
