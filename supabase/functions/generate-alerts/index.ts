import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authErr } = await supabase.auth.getUser();
    if (authErr || !user) throw new Error("Unauthorized");

    // Get coach's athletes
    const { data: links } = await supabase
      .from("coach_athlete_links")
      .select("athlete_user_id, position, sport_id")
      .eq("coach_user_id", user.id);

    if (!links?.length) {
      return new Response(JSON.stringify({ alerts_created: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const athleteIds = links.map((l: any) => l.athlete_user_id);
    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);

    // Fetch data in parallel
    const [profilesRes, sessionsRes, metricsRes, existingAlertsRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name").in("user_id", athleteIds),
      supabase.from("training_sessions").select("*")
        .eq("coach_id", user.id)
        .in("athlete_id", athleteIds)
        .gte("session_date", fourWeeksAgo.toISOString().split("T")[0])
        .order("session_date", { ascending: false }),
      supabase.from("athlete_metrics").select("*")
        .in("athlete_id", athleteIds)
        .gte("recorded_at", fourWeeksAgo.toISOString())
        .order("recorded_at", { ascending: false }),
      // Get recent alerts to avoid duplicates (last 24h)
      supabase.from("coach_alerts").select("athlete_id, alert_type, created_at")
        .eq("coach_id", user.id)
        .gte("created_at", new Date(now.getTime() - 24 * 3600000).toISOString()),
    ]);

    const profiles = profilesRes.data || [];
    const sessions = sessionsRes.data || [];
    const metrics = metricsRes.data || [];
    const existingAlerts = existingAlertsRes.data || [];

    const getName = (id: string) => {
      const p = profiles.find((p: any) => p.user_id === id);
      return p ? `${p.first_name} ${p.last_name}`.trim() : "Athlete";
    };

    const hasDuplicate = (athleteId: string, alertType: string) =>
      existingAlerts.some((a: any) => a.athlete_id === athleteId && a.alert_type === alertType);

    const newAlerts: any[] = [];

    for (const athleteId of athleteIds) {
      const athleteSessions = sessions.filter((s: any) => s.athlete_id === athleteId);
      const name = getName(athleteId);

      // === 1. MISSED SESSIONS ===
      // No completed sessions in last 7 days despite having history
      const thisWeekCompleted = athleteSessions.filter(
        (s: any) => new Date(s.session_date) >= oneWeekAgo && s.status === "completed"
      ).length;
      const missedThisWeek = athleteSessions.filter(
        (s: any) => new Date(s.session_date) >= oneWeekAgo && s.status === "missed"
      ).length;
      const hasHistory = athleteSessions.length > 0;

      if (missedThisWeek >= 2 && !hasDuplicate(athleteId, "missed_sessions")) {
        newAlerts.push({
          coach_id: user.id,
          athlete_id: athleteId,
          alert_type: "missed_sessions",
          severity: "warning",
          title: `${name} missed ${missedThisWeek} sessions`,
          message: `${name} has missed ${missedThisWeek} session(s) this week. Consider reaching out to check in.`,
        });
      } else if (hasHistory && thisWeekCompleted === 0 && !hasDuplicate(athleteId, "no_activity")) {
        // Has sessions in the past but none completed this week
        const lastCompleted = athleteSessions.find((s: any) => s.status === "completed");
        if (lastCompleted) {
          const daysSince = Math.floor((now.getTime() - new Date(lastCompleted.session_date).getTime()) / 86400000);
          if (daysSince >= 7) {
            newAlerts.push({
              coach_id: user.id,
              athlete_id: athleteId,
              alert_type: "no_activity",
              severity: daysSince >= 14 ? "error" : "warning",
              title: `${name} inactive for ${daysSince} days`,
              message: `${name} hasn't completed a session in ${daysSince} days. Their last session was on ${lastCompleted.session_date}.`,
            });
          }
        }
      }

      // === 2. OVERTRAINING ===
      const thisWeekSessions = athleteSessions.filter(
        (s: any) => new Date(s.session_date) >= oneWeekAgo && s.status === "completed"
      );
      const prevWeekSessions = athleteSessions.filter(
        (s: any) => {
          const d = new Date(s.session_date);
          return d >= twoWeeksAgo && d < oneWeekAgo && s.status === "completed";
        }
      );

      // Pitch count spike (>30% increase week-over-week)
      const thisWeekPitches = thisWeekSessions.reduce((sum: number, s: any) => sum + (s.pitch_count || 0), 0);
      const prevWeekPitches = prevWeekSessions.reduce((sum: number, s: any) => sum + (s.pitch_count || 0), 0);

      if (prevWeekPitches > 0 && thisWeekPitches > prevWeekPitches * 1.3 && !hasDuplicate(athleteId, "pitch_spike")) {
        const pctIncrease = Math.round(((thisWeekPitches - prevWeekPitches) / prevWeekPitches) * 100);
        newAlerts.push({
          coach_id: user.id,
          athlete_id: athleteId,
          alert_type: "pitch_spike",
          severity: pctIncrease > 50 ? "error" : "warning",
          title: `${name}: pitch count up ${pctIncrease}%`,
          message: `${name}'s pitch count jumped from ${prevWeekPitches} to ${thisWeekPitches} this week (+${pctIncrease}%). Consider reducing workload to prevent injury.`,
        });
      }

      // Session frequency spike
      if (prevWeekSessions.length > 0 && thisWeekSessions.length > prevWeekSessions.length * 1.5 && thisWeekSessions.length >= 4 && !hasDuplicate(athleteId, "overtraining")) {
        newAlerts.push({
          coach_id: user.id,
          athlete_id: athleteId,
          alert_type: "overtraining",
          severity: "warning",
          title: `${name} may be overtraining`,
          message: `${name} logged ${thisWeekSessions.length} sessions this week vs ${prevWeekSessions.length} last week. Monitor for fatigue or soreness.`,
        });
      }

      // Soreness detected
      const recentSoreness = athleteSessions.find(
        (s: any) => s.soreness_flag && new Date(s.session_date) >= oneWeekAgo
      );
      if (recentSoreness && !hasDuplicate(athleteId, "soreness")) {
        newAlerts.push({
          coach_id: user.id,
          athlete_id: athleteId,
          alert_type: "soreness",
          severity: "error",
          title: `${name} reported soreness`,
          message: `${name} flagged soreness on ${recentSoreness.session_date}.${recentSoreness.injury_note ? ` Note: "${recentSoreness.injury_note}"` : ""} Consider adjusting their training plan.`,
        });
      }

      // === 3. PLATEAUS ===
      // Check metrics for stagnation (same metric type, no improvement over 3+ recordings)
      const athleteMetrics = metrics.filter((m: any) => m.athlete_id === athleteId);
      const metricTypes = [...new Set(athleteMetrics.map((m: any) => m.metric_type))];

      for (const metricType of metricTypes) {
        const typeMetrics = athleteMetrics
          .filter((m: any) => m.metric_type === metricType)
          .sort((a: any, b: any) => new Date(b.recorded_at).getTime() - new Date(a.recorded_at).getTime());

        if (typeMetrics.length >= 3) {
          const recent = typeMetrics.slice(0, 3).map((m: any) => Number(m.value));
          const range = Math.max(...recent) - Math.min(...recent);
          const avg = recent.reduce((a: number, b: number) => a + b, 0) / recent.length;
          // If variation is <2% of average, it's a plateau
          if (avg > 0 && (range / avg) < 0.02 && !hasDuplicate(athleteId, `plateau_${metricType}`)) {
            newAlerts.push({
              coach_id: user.id,
              athlete_id: athleteId,
              alert_type: `plateau_${metricType}`,
              severity: "info",
              title: `${name}: ${metricType} plateau`,
              message: `${name}'s ${metricType} has been flat at ~${recent[0]} across the last ${typeMetrics.length >= 4 ? "4+" : "3"} recordings. Consider adjusting their training focus.`,
            });
          }
        }
      }
    }

    // Insert all alerts
    if (newAlerts.length > 0) {
      const { error: insertErr } = await supabase.from("coach_alerts").insert(newAlerts);
      if (insertErr) throw insertErr;
    }

    return new Response(JSON.stringify({ alerts_created: newAlerts.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
