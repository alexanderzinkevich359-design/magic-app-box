import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

/** Compute training status from attendance + workload signals */
function deriveStatus(
  attendance: number,
  sessionsThisWeek: number,
  avgSessionsPerWeek: number,
  hasSoreness: boolean
): { status: string; color: string } {
  if (hasSoreness) return { status: "Injured / Sore", color: "red" };
  if (sessionsThisWeek > avgSessionsPerWeek * 1.5) return { status: "Overloaded", color: "orange" };
  if (attendance < 60) return { status: "Falling Behind", color: "yellow" };
  if (attendance >= 80) return { status: "On Track", color: "green" };
  return { status: "Needs Attention", color: "yellow" };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
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

    // 1. Get coach's athletes with positions
    const { data: links } = await supabase
      .from("coach_athlete_links")
      .select("athlete_user_id, position, sport_id")
      .eq("coach_user_id", user.id);

    if (!links?.length) {
      return new Response(JSON.stringify({ athletes: [] }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const athleteIds = links.map((l: any) => l.athlete_user_id);

    // 2. Fetch profiles, sessions, notes, goals in parallel
    const [profilesRes, sessionsRes, notesRes, goalsRes, scheduledRes] = await Promise.all([
      supabase.from("profiles").select("user_id, first_name, last_name, avatar_url, date_of_birth")
        .in("user_id", athleteIds),
      supabase.from("training_sessions").select("*")
        .eq("coach_id", user.id)
        .in("athlete_id", athleteIds)
        .order("session_date", { ascending: false }),
      supabase.from("coach_notes").select("id, athlete_id, note, tag, created_at")
        .eq("coach_id", user.id)
        .in("athlete_id", athleteIds)
        .order("created_at", { ascending: false }),
      supabase.from("athlete_goals").select("*")
        .eq("coach_id", user.id)
        .in("athlete_id", athleteIds),
      supabase.from("coach_schedule").select("athlete_id, scheduled_date, start_time, title")
        .eq("coach_id", user.id)
        .in("athlete_id", athleteIds)
        .gte("scheduled_date", new Date().toISOString().split("T")[0])
        .order("scheduled_date", { ascending: true }),
    ]);

    const profiles = profilesRes.data || [];
    const sessions = sessionsRes.data || [];
    const notes = notesRes.data || [];
    const goals = goalsRes.data || [];
    const upcoming = scheduledRes.data || [];

    const now = new Date();
    const oneWeekAgo = new Date(now.getTime() - 7 * 86400000);
    const fourWeeksAgo = new Date(now.getTime() - 28 * 86400000);

    // 3. Build snapshot per athlete
    const snapshots = athleteIds.map((athleteId: string) => {
      const link = links.find((l: any) => l.athlete_user_id === athleteId)!;
      const profile = profiles.find((p: any) => p.user_id === athleteId);
      const athleteSessions = sessions.filter((s: any) => s.athlete_id === athleteId);
      const athleteNotes = notes.filter((n: any) => n.athlete_id === athleteId);
      const athleteGoals = goals.filter((g: any) => g.athlete_id === athleteId);
      const nextSession = upcoming.find((u: any) => u.athlete_id === athleteId);

      // Attendance: completed / (completed + missed) in last 4 weeks
      const recentSessions = athleteSessions.filter(
        (s: any) => new Date(s.session_date) >= fourWeeksAgo
      );
      const completed = recentSessions.filter((s: any) => s.status === "completed").length;
      const missed = recentSessions.filter((s: any) => s.status === "missed").length;
      const total = completed + missed;
      const attendancePct = total > 0 ? Math.round((completed / total) * 100) : null;

      // Sessions this week
      const thisWeekSessions = athleteSessions.filter(
        (s: any) => new Date(s.session_date) >= oneWeekAgo && s.status === "completed"
      ).length;

      // Average sessions per week (over 4 weeks)
      const avgPerWeek = total > 0 ? total / 4 : 0;

      // Soreness / injury
      const hasSoreness = athleteSessions.some(
        (s: any) => s.soreness_flag && new Date(s.session_date) >= oneWeekAgo
      );
      const latestInjuryNote = athleteSessions.find((s: any) => s.injury_note)?.injury_note || null;

      // Last session
      const lastSession = athleteSessions.find((s: any) => s.status === "completed");

      // Latest note
      const latestNote = athleteNotes[0] || null;

      // Status
      const { status, color } = deriveStatus(
        attendancePct ?? 100,
        thisWeekSessions,
        avgPerWeek,
        hasSoreness
      );

      // Pitch count this week
      const weeklyPitchCount = athleteSessions
        .filter((s: any) => new Date(s.session_date) >= oneWeekAgo && s.status === "completed")
        .reduce((sum: number, s: any) => sum + (s.pitch_count || 0), 0);

      return {
        athlete_id: athleteId,
        name: profile ? `${profile.first_name} ${profile.last_name}`.trim() : "Unknown",
        avatar_url: profile?.avatar_url || null,
        date_of_birth: profile?.date_of_birth || null,
        position: link.position || null,
        sport_id: link.sport_id || null,
        training_status: status,
        status_color: color,
        attendance_pct: attendancePct,
        sessions_this_week: thisWeekSessions,
        weekly_pitch_count: weeklyPitchCount,
        last_session_date: lastSession?.session_date || null,
        next_session: nextSession ? {
          date: nextSession.scheduled_date,
          time: nextSession.start_time,
          title: nextSession.title,
        } : null,
        soreness_flag: hasSoreness,
        injury_note: latestInjuryNote,
        latest_note: latestNote ? {
          text: latestNote.note,
          tag: latestNote.tag,
          date: latestNote.created_at,
        } : null,
        active_goals: athleteGoals.filter((g: any) => !g.completed_at).length,
        total_sessions: recentSessions.length,
      };
    });

    return new Response(JSON.stringify({ athletes: snapshots }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
