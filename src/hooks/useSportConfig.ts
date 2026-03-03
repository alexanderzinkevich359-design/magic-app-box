import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { parseSportConfig } from "@/lib/sports/types";
import type { SportConfig } from "@/lib/sports/types";

const SPORT_SELECT =
  "id, name, slug, icon, is_active, positions, skills, metrics_by_position, goal_templates_by_position, schedule_presets, session_config";

/** Fetch all active sport configs. staleTime: Infinity — static data, never refetched at runtime. */
export function useAllSportConfigs() {
  return useQuery<SportConfig[]>({
    queryKey: ["sport-configs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sports")
        .select(SPORT_SELECT)
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return ((data ?? []) as any[]).map(parseSportConfig);
    },
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Fetch a single sport config by slug. */
export function useSportConfig(slug: string | null | undefined) {
  return useQuery<SportConfig | null>({
    queryKey: ["sport-config", slug],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sports")
        .select(SPORT_SELECT)
        .eq("slug", slug!)
        .single();
      if (error) throw error;
      return data ? parseSportConfig(data) : null;
    },
    enabled: !!slug,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Fetch a single sport config by UUID. */
export function useSportConfigById(sportId: string | null | undefined) {
  return useQuery<SportConfig | null>({
    queryKey: ["sport-config-by-id", sportId],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("sports")
        .select(SPORT_SELECT)
        .eq("id", sportId!)
        .single();
      if (error) throw error;
      return data ? parseSportConfig(data) : null;
    },
    enabled: !!sportId,
    staleTime: Infinity,
    gcTime: Infinity,
  });
}

/** Build a Map<sportId, SportConfig> from an array of configs. */
export function buildSportConfigMap(configs: SportConfig[]): Map<string, SportConfig> {
  return new Map(configs.map((c) => [c.id, c]));
}

/** Derive the most common sport_id from a list (plurality vote). */
export function usePrimarySportId(sportIds: (string | null | undefined)[]): string | null {
  return useMemo(() => {
    const ids = sportIds.filter((id): id is string => !!id);
    if (!ids.length) return null;
    const counts: Record<string, number> = {};
    ids.forEach((id) => { counts[id] = (counts[id] ?? 0) + 1; });
    return Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0];
  }, [sportIds]); // eslint-disable-line react-hooks/exhaustive-deps
}
