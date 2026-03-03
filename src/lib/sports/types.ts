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
    },
  };
}
