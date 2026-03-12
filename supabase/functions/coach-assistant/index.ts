import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) {
      return new Response(JSON.stringify({ error: "ANTHROPIC_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Verify JWT and extract user
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY")!);
    const { data: { user }, error: authError } = await anonClient.auth.getUser(
      authHeader.replace("Bearer ", "")
    );
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = await req.json() as {
      messages: { role: "user" | "assistant"; content: string }[];
    };

    if (!messages?.length) {
      return new Response(JSON.stringify({ error: "messages required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Use service role to load coach context
    const db = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
    const coachId = user.id;

    const today = new Date().toISOString().split("T")[0];
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];
    const twoWeeksAhead = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().split("T")[0];

    // Load all context in parallel
    const [linksRes, goalsRes, sessionsRes, scheduleRes, teamsRes] = await Promise.all([
      db.from("coach_athlete_links")
        .select("athlete_user_id, sport_id")
        .eq("coach_user_id", coachId),
      db.from("athlete_goals")
        .select("athlete_id, title, category, progress, completed_at, target")
        .eq("coach_id", coachId)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
      db.from("training_sessions")
        .select("athlete_user_id, session_date, session_type, rpe, notes")
        .eq("coach_user_id", coachId)
        .gte("session_date", twoWeeksAgo)
        .order("session_date", { ascending: false })
        .limit(20),
      db.from("coach_schedule")
        .select("title, scheduled_date, start_time, session_type, team_id")
        .eq("coach_id", coachId)
        .eq("status", "active")
        .gte("scheduled_date", today)
        .lte("scheduled_date", twoWeeksAhead)
        .order("scheduled_date", { ascending: true })
        .limit(20),
      db.from("teams")
        .select("id, name, season_start, season_end")
        .eq("coach_id", coachId),
    ]);

    const links = linksRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const sessions = sessionsRes.data ?? [];
    const schedule = scheduleRes.data ?? [];
    const teams = teamsRes.data ?? [];

    // Fetch athlete profiles
    let athleteProfiles: { user_id: string; first_name: string; last_name: string; sport_position: string | null }[] = [];
    if (links.length > 0) {
      const { data } = await db.from("profiles")
        .select("user_id, first_name, last_name, sport_position")
        .in("user_id", links.map((l) => l.athlete_user_id));
      athleteProfiles = data ?? [];
    }

    const athleteMap = new Map(athleteProfiles.map((p) => [p.user_id, p]));
    const athletes = links.map((l) => {
      const p = athleteMap.get(l.athlete_user_id);
      return {
        id: l.athlete_user_id,
        name: p ? `${p.first_name} ${p.last_name}`.trim() : "Unknown",
        position: p?.sport_position ?? "Unknown",
      };
    });

    // Build context block
    const athleteLines = athletes.length
      ? athletes.map((a) => `• ${a.name} — Position: ${a.position}`).join("\n")
      : "No athletes linked yet.";

    const goalLines = athletes.map((a) => {
      const ag = goals.filter((g) => g.athlete_id === a.id);
      if (!ag.length) return null;
      const lines = ag.slice(0, 3).map((g) =>
        `  - ${g.title} [${g.category}] — ${g.progress ?? 0}% progress${g.target ? `, target: ${g.target}` : ""}`
      );
      return `${a.name}:\n${lines.join("\n")}`;
    }).filter(Boolean).join("\n") || "No active goals.";

    const sessionLines = sessions.slice(0, 10).map((s) => {
      const name = athleteMap.get(s.athlete_user_id);
      const athleteName = name ? `${name.first_name} ${name.last_name}`.trim() : "Unknown";
      return `• ${s.session_date} — ${athleteName} — ${s.session_type ?? "session"}${s.rpe ? `, RPE ${s.rpe}` : ""}${s.notes ? `, notes: ${s.notes.slice(0, 60)}` : ""}`;
    }).join("\n") || "No recent sessions.";

    const scheduleLines = (() => {
      const seen = new Set<string>();
      return schedule.filter((e) => {
        const key = `${e.scheduled_date}|${e.title}|${e.team_id}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 10).map((e) => {
        const teamName = teams.find((t) => t.id === e.team_id)?.name;
        return `• ${e.scheduled_date}${e.start_time ? ` at ${e.start_time.slice(0, 5)}` : ""} — ${e.title}${teamName ? ` (${teamName})` : ""}`;
      }).join("\n");
    })() || "No upcoming sessions.";

    const teamLines = teams.length
      ? teams.map((t) => `• ${t.name}${t.season_start ? ` (Season: ${t.season_start} → ${t.season_end})` : ""}`).join("\n")
      : "No teams.";

    const systemPrompt = `You are an expert sports development coach assistant for ClipMVP, a coaching platform. You help coaches with:
- Understanding and using ClipMVP features (scheduling, session logging, athlete goals, game log, practice plans, spotlight studio, etc.)
- Athlete development insights based on their real data shown below
- Sports coaching strategy, periodization, and goal-setting
- Progress tracking and parent communication

Today's date: ${today}

--- COACH'S ATHLETES ---
${athleteLines}

--- ACTIVE GOALS (per athlete) ---
${goalLines}

--- RECENT TRAINING SESSIONS (last 14 days) ---
${sessionLines}

--- UPCOMING SCHEDULE (next 14 days) ---
${scheduleLines}

--- TEAMS ---
${teamLines}

Guidelines:
- Be concise and practical. Use bullet points or numbered lists when helpful.
- Focus on athlete development — effort, growth, consistency, process.
- Never rank athletes against each other or make predictions.
- When asked about ClipMVP features, give clear step-by-step guidance.
- If you don't have enough context to answer, ask a clarifying question.`;

    // Call Anthropic Claude
    const aiResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Anthropic error:", aiResponse.status, errText);
      return new Response(
        JSON.stringify({ error: `AI error: ${aiResponse.status}` }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aiData = await aiResponse.json();
    const content = aiData.content?.[0]?.text ?? "Sorry, I couldn't generate a response.";

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("coach-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
