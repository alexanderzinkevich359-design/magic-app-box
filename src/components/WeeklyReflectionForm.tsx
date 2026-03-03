import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

interface WeeklyReflectionFormProps {
  open: boolean;
  onClose: () => void;
  athleteId: string;
}

/** Returns ISO date string for Monday of the current week */
function getWeekStart(): string {
  const d = new Date();
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.toISOString().split("T")[0];
}

const WeeklyReflectionForm = ({ open, onClose, athleteId }: WeeklyReflectionFormProps) => {
  const queryClient = useQueryClient();
  const weekStart = getWeekStart();

  const [whatWentWell, setWhatWentWell] = useState("");
  const [needsImprovement, setNeedsImprovement] = useState("");
  const [selfRating, setSelfRating] = useState<number | null>(null);

  const { data: existing, isLoading } = useQuery({
    queryKey: ["weekly-reflection", athleteId, weekStart],
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from("weekly_reflections")
        .select("*")
        .eq("athlete_id", athleteId)
        .eq("week_start", weekStart)
        .maybeSingle();
      return data ?? null;
    },
    enabled: open && !!athleteId,
  });

  // Sync form when existing reflection loads (TanStack v5 pattern)
  useEffect(() => {
    if (!existing) return;
    setWhatWentWell(existing.what_went_well ?? "");
    setNeedsImprovement(existing.needs_improvement ?? "");
    setSelfRating(existing.self_rating ?? null);
  }, [existing]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setWhatWentWell("");
      setNeedsImprovement("");
      setSelfRating(null);
    }
  }, [open]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await (supabase as any)
        .from("weekly_reflections")
        .upsert(
          {
            athlete_id: athleteId,
            week_start: weekStart,
            what_went_well: whatWentWell.trim() || null,
            needs_improvement: needsImprovement.trim() || null,
            self_rating: selfRating,
          },
          { onConflict: "athlete_id,week_start" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["weekly-reflection", athleteId] });
      toast.success("Reflection saved");
      onClose();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const weekLabel = new Date(weekStart + "T12:00:00").toLocaleDateString(undefined, {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="font-['Space_Grotesk']">Weekly Reflection</DialogTitle>
          <DialogDescription>Week of {weekLabel}</DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-sm">What went well this week?</Label>
              <Textarea
                placeholder="Describe your wins, progress, or moments you're proud of..."
                value={whatWentWell}
                onChange={(e) => setWhatWentWell(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-sm">What needs improvement?</Label>
              <Textarea
                placeholder="Be honest about what you want to work on next week..."
                value={needsImprovement}
                onChange={(e) => setNeedsImprovement(e.target.value)}
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label className="text-sm">Self-rating this week</Label>
              <div className="flex gap-1.5 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((rating) => (
                  <button
                    key={rating}
                    type="button"
                    onClick={() => setSelfRating(rating === selfRating ? null : rating)}
                    className={`h-8 w-8 rounded-full text-xs font-semibold transition-colors ${
                      selfRating === rating
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted hover:bg-primary/20 text-muted-foreground"
                    }`}
                  >
                    {rating}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-1">
              <Button
                className="flex-1"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Save Reflection
              </Button>
              <Button variant="outline" onClick={onClose}>Cancel</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default WeeklyReflectionForm;
