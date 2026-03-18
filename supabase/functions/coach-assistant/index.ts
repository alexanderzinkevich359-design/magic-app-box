import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ─── Tool definitions ─────────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "schedule_sessions",
    description:
      "Create sessions on the coach's schedule for one or more athletes (or a whole team). Always confirm all details with the coach before calling this tool.",
    input_schema: {
      type: "object",
      required: ["title", "dates"],
      properties: {
        athlete_ids: {
          type: "array",
          items: { type: "string" },
          description: "List of athlete user IDs to schedule for (ignored if team_id is set)",
        },
        team_id: {
          type: "string",
          description: "If set, schedule for all members of this team",
        },
        title: { type: "string" },
        dates: {
          type: "array",
          items: { type: "string" },
          description: "List of dates in YYYY-MM-DD format",
        },
        start_time: {
          type: "string",
          description: "HH:MM in 24-hour format (optional)",
        },
        color: {
          type: "string",
          enum: ["default", "blue", "green", "orange", "purple"],
        },
        session_type: {
          type: "string",
          enum: ["regular", "game"],
        },
        notes: { type: "string" },
      },
    },
  },
  {
    name: "create_goal",
    description:
      "Create a development goal for an athlete. Always confirm the title, category, and target with the coach before calling this tool.",
    input_schema: {
      type: "object",
      required: ["athlete_id", "title", "category"],
      properties: {
        athlete_id: { type: "string" },
        title: { type: "string" },
        category: {
          type: "string",
          enum: ["skill", "conditioning", "mindset", "coach_assigned"],
        },
        is_measurable: {
          type: "boolean",
          description: "Whether a numeric target is tracked (default: true)",
        },
        target: {
          type: "string",
          description: "Target value or description, e.g. '90 mph' or '3x/week'",
        },
      },
    },
  },
  {
    name: "delete_schedule_sessions",
    description:
      "Delete schedule sessions by their IDs. ONLY call this after the coach has explicitly confirmed the deletion. Always list what will be deleted (name and date) and ask for confirmation first.",
    input_schema: {
      type: "object",
      required: ["session_ids"],
      properties: {
        session_ids: {
          type: "array",
          items: { type: "string" },
          description: "IDs of sessions to delete",
        },
      },
    },
  },
  {
    name: "update_goal_progress",
    description: "Update the progress percentage (0–100) on an athlete's goal.",
    input_schema: {
      type: "object",
      required: ["goal_id", "progress"],
      properties: {
        goal_id: { type: "string" },
        progress: {
          type: "number",
          description: "New progress value 0–100",
        },
      },
    },
  },
];

// ─── Tool executor ────────────────────────────────────────────────────────────

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  db: ReturnType<typeof createClient>,
  coachId: string,
  teamMemberMap: Map<string, string[]>,
): Promise<{ message: string; invalidate: string[] }> {
  if (name === "schedule_sessions") {
    const {
      title,
      dates,
      start_time,
      color,
      session_type,
      notes,
      team_id,
      athlete_ids,
    } = input as {
      title: string;
      dates: string[];
      start_time?: string;
      color?: string;
      session_type?: string;
      notes?: string;
      team_id?: string;
      athlete_ids?: string[];
    };

    let targetAthleteIds: string[] = [];
    if (team_id) {
      targetAthleteIds = teamMemberMap.get(team_id) ?? [];
    } else if (athlete_ids?.length) {
      targetAthleteIds = athlete_ids;
    }

    if (!targetAthleteIds.length || !dates?.length) {
      return { message: "No athletes or dates provided — nothing scheduled.", invalidate: [] };
    }

    const rows = targetAthleteIds.flatMap((aid) =>
      dates.map((d) => ({
        coach_id: coachId,
        athlete_id: aid,
        title,
        scheduled_date: d,
        start_time: start_time ?? null,
        color: color ?? "default",
        session_type: session_type ?? "regular",
        notes: notes ?? null,
        team_id: team_id ?? null,
        status: "active",
      }))
    );

    await db.from("coach_schedule").insert(rows);
    const count = rows.length;
    return {
      message: `Scheduled ${count} session${count !== 1 ? "s" : ""}: "${title}" on ${dates.join(", ")}.`,
      invalidate: ["coach-schedule"],
    };
  }

  if (name === "create_goal") {
    const { athlete_id, title, category, is_measurable, target } = input as {
      athlete_id: string;
      title: string;
      category: string;
      is_measurable?: boolean;
      target?: string;
    };

    await db.from("athlete_goals").insert({
      athlete_id,
      coach_id: coachId,
      title,
      category: category ?? "coach_assigned",
      is_measurable: is_measurable ?? true,
      target: target ?? "",
      progress: 0,
    });

    return {
      message: `Goal created: "${title}" (${category})${target ? `, target: ${target}` : ""}.`,
      invalidate: ["coach-athletes"],
    };
  }

  if (name === "delete_schedule_sessions") {
    const { session_ids } = input as { session_ids: string[] };

    if (!session_ids?.length) {
      return { message: "No session IDs provided.", invalidate: [] };
    }

    const { count } = await db
      .from("coach_schedule")
      .delete({ count: "exact" })
      .in("id", session_ids)
      .eq("coach_id", coachId);

    const deleted = count ?? session_ids.length;
    return {
      message: `Deleted ${deleted} session${deleted !== 1 ? "s" : ""}.`,
      invalidate: ["coach-schedule"],
    };
  }

  if (name === "update_goal_progress") {
    const { goal_id, progress } = input as { goal_id: string; progress: number };
    const safeProgress = Math.max(0, Math.min(100, Math.round(progress)));

    await db
      .from("athlete_goals")
      .update({
        progress: safeProgress,
        ...(safeProgress === 100 ? { completed_at: new Date().toISOString() } : {}),
      })
      .eq("id", goal_id)
      .eq("coach_id", coachId);

    await db
      .from("goal_progress_entries")
      .insert({ goal_id, value: safeProgress });

    return {
      message: `Goal progress updated to ${safeProgress}%.`,
      invalidate: ["coach-athletes"],
    };
  }

  return { message: `Unknown tool: ${name}`, invalidate: [] };
}

// ─── Server ───────────────────────────────────────────────────────────────────

serve(async (req: Request) => {
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
    const {
      data: { user },
      error: authError,
    } = await anonClient.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { messages } = (await req.json()) as {
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
    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];
    const thirtyDaysAhead = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
      .toISOString()
      .split("T")[0];

    // Load all context in parallel
    const [linksRes, goalsRes, sessionsRes, scheduleRes, teamsRes] = await Promise.all([
      db.from("coach_athlete_links").select("athlete_user_id, sport_id").eq("coach_user_id", coachId),
      db
        .from("athlete_goals")
        .select("id, athlete_id, title, category, progress, completed_at, target")
        .eq("coach_id", coachId)
        .is("completed_at", null)
        .order("created_at", { ascending: false })
        .limit(30),
      db
        .from("training_sessions")
        .select("athlete_id, session_date, session_type, intensity, notes")
        .eq("coach_id", coachId)
        .gte("session_date", twoWeeksAgo)
        .order("session_date", { ascending: false })
        .limit(20),
      db
        .from("coach_schedule")
        .select("id, title, scheduled_date, start_time, session_type, team_id")
        .eq("coach_id", coachId)
        .eq("status", "active")
        .gte("scheduled_date", today)
        .lte("scheduled_date", thirtyDaysAhead)
        .order("scheduled_date", { ascending: true })
        .limit(30),
      db.from("teams").select("id, name, season_start, season_end").eq("coach_id", coachId),
    ]);

    const links = linksRes.data ?? [];
    const goals = goalsRes.data ?? [];
    const sessions = sessionsRes.data ?? [];
    const schedule = scheduleRes.data ?? [];
    const teams = teamsRes.data ?? [];

    // Load team members (needed for schedule_sessions tool)
    let teamMembers: { team_id: string; athlete_user_id: string }[] = [];
    if (teams.length > 0) {
      const { data } = await db
        .from("team_members")
        .select("team_id, athlete_user_id")
        .in(
          "team_id",
          teams.map((t: Record<string, unknown>) => t.id),
        );
      teamMembers = data ?? [];
    }

    const teamMemberMap = new Map<string, string[]>();
    for (const tm of teamMembers) {
      const arr = teamMemberMap.get(tm.team_id) ?? [];
      arr.push(tm.athlete_user_id);
      teamMemberMap.set(tm.team_id, arr);
    }

    // Fetch athlete profiles
    let athleteProfiles: {
      user_id: string;
      first_name: string;
      last_name: string;
      sport_position: string | null;
    }[] = [];
    if (links.length > 0) {
      const { data } = await db
        .from("profiles")
        .select("user_id, first_name, last_name, sport_position")
        .in(
          "user_id",
          links.map((l: Record<string, unknown>) => l.athlete_user_id),
        );
      athleteProfiles = data ?? [];
    }

    const athleteMap = new Map(athleteProfiles.map((p) => [p.user_id, p]));
    const athletes: Array<{ id: string; name: string; position: string }> = links.map((l: Record<string, unknown>) => {
      const p = athleteMap.get(l.athlete_user_id as string);
      return {
        id: l.athlete_user_id as string,
        name: p ? `${p.first_name} ${p.last_name}`.trim() : "Unknown",
        position: p?.sport_position ?? "Unknown",
      };
    });

    // Build context with IDs so Claude can reference them in tool calls
    const athleteLines = athletes.length
      ? athletes
          .map((a) => `• ${a.name} [id: ${a.id}] — Position: ${a.position}`)
          .join("\n")
      : "No athletes linked yet.";

    const goalLines =
      athletes
        .map((a) => {
          const ag = (goals as Record<string, unknown>[]).filter((g) => g.athlete_id === a.id);
          if (!ag.length) return null;
          const lines = ag.slice(0, 5).map(
            (g) =>
              `  - ${g.title} [id: ${g.id}] [${g.category}] — ${g.progress ?? 0}% progress${g.target ? `, target: ${g.target}` : ""}`,
          );
          return `${a.name}:\n${lines.join("\n")}`;
        })
        .filter(Boolean)
        .join("\n") || "No active goals.";

    const sessionLines =
      (sessions as Record<string, unknown>[])
        .slice(0, 10)
        .map((s) => {
          const profile = athleteMap.get(s.athlete_id as string);
          const athleteName = profile
            ? `${profile.first_name} ${profile.last_name}`.trim()
            : "Unknown";
          return `• ${s.session_date} — ${athleteName} — ${s.session_type ?? "session"}${s.intensity ? `, intensity: ${s.intensity}` : ""}${s.notes ? `, notes: ${String(s.notes).slice(0, 60)}` : ""}`;
        })
        .join("\n") || "No recent sessions.";

    const scheduleLines =
      (() => {
        const seen = new Set<string>();
        return (schedule as Record<string, unknown>[])
          .filter((e) => {
            const key = `${e.scheduled_date}|${e.title}|${e.team_id}`;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          })
          .slice(0, 20)
          .map((e) => {
            const teamName = (teams as Record<string, unknown>[]).find((t) => t.id === e.team_id)
              ?.name;
            return `• ${e.scheduled_date}${e.start_time ? ` at ${String(e.start_time).slice(0, 5)}` : ""} — ${e.title}${teamName ? ` (${teamName})` : ""} [id: ${e.id}]`;
          })
          .join("\n");
      })() || "No upcoming sessions.";

    const teamLines = teams.length
      ? (teams as Record<string, unknown>[])
          .map((t) => {
            const memberCount = teamMemberMap.get(t.id as string)?.length ?? 0;
            return `• ${t.name} [id: ${t.id}, members: ${memberCount}]${t.season_start ? ` (Season: ${t.season_start} → ${t.season_end})` : ""}`;
          })
          .join("\n")
      : "No teams.";

    const systemPrompt = `You are an expert sports development coach assistant for ClipMVP, a coaching platform. You help coaches with:
- Understanding and using ClipMVP features (scheduling, session logging, athlete goals, game log, practice plans, spotlight studio, etc.)
- Athlete development insights based on their real data shown below
- Sports coaching strategy, periodization, and goal-setting
- Progress tracking and parent communication
- Taking real actions in the app using tools

Today's date: ${today}

--- COACH'S ATHLETES ---
${athleteLines}

--- ACTIVE GOALS (per athlete) ---
${goalLines}

--- RECENT TRAINING SESSIONS (last 14 days) ---
${sessionLines}

--- UPCOMING SCHEDULE (next 30 days) ---
${scheduleLines}

--- TEAMS ---
${teamLines}

Guidelines:
- Be concise and practical. Use bullet points or numbered lists when helpful.
- Focus on athlete development — effort, growth, consistency, process.
- Never rank athletes against each other or make predictions.
- When asked about ClipMVP features, give clear step-by-step guidance.
- If you don't have enough context to answer, ask a clarifying question.

Tool use rules:
- Before calling ANY tool: summarize exactly what you will do and ask "Shall I go ahead?"
- For delete_schedule_sessions: list every session that will be deleted (title and date), then ask for confirmation before proceeding.
- After a tool action completes: confirm in plain language what was done.
- If the request is ambiguous (missing date, team, athlete), ask a clarifying question before acting.
- Use the IDs shown in brackets above when calling tools.`;

    // ─── Call Claude with tool-use loop ──────────────────────────────────────

    const callClaude = (msgs: unknown[]) =>
      fetch("https://api.anthropic.com/v1/messages", {
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
          tools: TOOLS,
          messages: msgs,
        }),
      });

    let currentMessages: unknown[] = messages;
    let aiResponse = await callClaude(currentMessages);

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("Anthropic error:", aiResponse.status, errText);
      return new Response(JSON.stringify({ error: `AI error: ${aiResponse.status}` }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    let aiData = await aiResponse.json();
    const allInvalidate: string[] = [];

    for (let round = 0; round < 5; round++) {
      if (aiData.stop_reason !== "tool_use") break;

      const toolUseBlocks = (aiData.content as { type: string; id: string; name: string; input: Record<string, unknown> }[]).filter(
        (b) => b.type === "tool_use",
      );

      const toolResults = [];
      for (const block of toolUseBlocks) {
        const result = await executeTool(block.name, block.input, db, coachId, teamMemberMap);
        if (result.invalidate.length) allInvalidate.push(...result.invalidate);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result.message,
        });
      }

      currentMessages = [
        ...currentMessages,
        { role: "assistant", content: aiData.content },
        { role: "user", content: toolResults },
      ];

      aiResponse = await callClaude(currentMessages);
      if (!aiResponse.ok) {
        const errText = await aiResponse.text();
        console.error("Anthropic error (round", round, "):", aiResponse.status, errText);
        break;
      }
      aiData = await aiResponse.json();
    }

    const content =
      (aiData.content as { type: string; text?: string }[])?.find((b) => b.type === "text")
        ?.text ?? "Done.";

    return new Response(
      JSON.stringify({ content, invalidate: [...new Set(allInvalidate)] }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("coach-assistant error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
