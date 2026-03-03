import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

export const useAIPremium = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: isEnabled = false, isLoading } = useQuery({
    queryKey: ["ai-premium", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data } = await (supabase as any)
        .from("profiles")
        .select("ai_premium")
        .eq("user_id", user.id)
        .single();
      return data?.ai_premium ?? false;
    },
    enabled: !!user,
  });

  const enableMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ ai_premium: true })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-premium"] });
    },
  });

  const disableMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Not authenticated");
      const { error } = await (supabase as any)
        .from("profiles")
        .update({ ai_premium: false })
        .eq("user_id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["ai-premium"] });
    },
  });

  return {
    isEnabled,
    isLoading,
    enable: enableMutation.mutate,
    disable: disableMutation.mutate,
    isEnabling: enableMutation.isPending,
    isDisabling: disableMutation.isPending,
  };
};
