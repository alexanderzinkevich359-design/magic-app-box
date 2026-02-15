import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { position, goals, metrics } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `You are a professional baseball training coach AI. Given an athlete's position, goals, and current metrics, recommend a structured workout plan.

Return a JSON object using tool calling with this structure:
- plan_name: string (catchy name for the plan)
- description: string (1-2 sentence overview)
- duration_weeks: number
- workouts: array of objects with:
  - title: string (workout day title)
  - description: string (focus of this workout)
  - drills: array of objects with:
    - name: string
    - rep_scheme: string (e.g. "3x10")
    - skill_category: string
    - equipment: string
    - coaching_cues: string
    - difficulty: "beginner" | "intermediate" | "advanced"

Tailor drills specifically to the baseball position:
- Pitcher: arm care, mechanics, velocity training, pitch count management
- Catcher: blocking, framing, pop time, arm strength
- Infielder: footwork, double plays, range, quick release
- Outfielder: routes, tracking, arm accuracy, speed
- Hitter: swing mechanics, exit velocity, plate discipline, bat speed

Include 2-3 workouts with 2-4 drills each. Be specific and actionable.`;

    const userPrompt = `Position: ${position}
Goals: ${JSON.stringify(goals)}
Current Metrics: ${JSON.stringify(metrics)}

Recommend a personalized workout plan for this athlete.`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "recommend_workout_plan",
              description: "Return a structured workout plan recommendation",
              parameters: {
                type: "object",
                properties: {
                  plan_name: { type: "string" },
                  description: { type: "string" },
                  duration_weeks: { type: "number" },
                  workouts: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        title: { type: "string" },
                        description: { type: "string" },
                        drills: {
                          type: "array",
                          items: {
                            type: "object",
                            properties: {
                              name: { type: "string" },
                              rep_scheme: { type: "string" },
                              skill_category: { type: "string" },
                              equipment: { type: "string" },
                              coaching_cues: { type: "string" },
                              difficulty: { type: "string", enum: ["beginner", "intermediate", "advanced"] },
                            },
                            required: ["name", "rep_scheme", "skill_category", "equipment", "coaching_cues", "difficulty"],
                            additionalProperties: false,
                          },
                        },
                      },
                      required: ["title", "description", "drills"],
                      additionalProperties: false,
                    },
                  },
                },
                required: ["plan_name", "description", "duration_weeks", "workouts"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "recommend_workout_plan" } },
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add funds." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const toolCall = data.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      const plan = JSON.parse(toolCall.function.arguments);
      return new Response(JSON.stringify({ plan }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Failed to generate plan" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("recommend-workout error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
