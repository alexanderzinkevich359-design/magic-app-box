import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Returns the current user's time display preference ("12h" | "24h").
 * Defaults to "12h" if not yet set or while loading.
 */
export function useTimeFormat(): "12h" | "24h" {
  const { user } = useAuth();

  const { data } = useQuery({
    queryKey: ["time-format", user?.id],
    queryFn: async () => {
      if (!user) return "12h";
      const { data } = await (supabase as any)
        .from("profiles")
        .select("time_format")
        .eq("user_id", user.id)
        .single();
      return (data?.time_format as "12h" | "24h") ?? "12h";
    },
    enabled: !!user,
    staleTime: Infinity,
  });

  return data ?? "12h";
}
