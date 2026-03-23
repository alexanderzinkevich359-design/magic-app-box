import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
    if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not configured");

    const { messages, athleteContext } = await req.json();

    const systemPrompt = `You are a supportive development assistant for parents of athletes on ClipMVP.

Your role is to help parents understand how to best support their child's athletic development at home.

${athleteContext ? `Athlete context:\n${athleteContext}` : ""}

Guidelines:
- Focus on development, encouragement, and home support strategies
- Keep responses concise and practical (2-4 sentences)
- Never compare athletes to others or give rankings
- Never make performance predictions
- If asked about specific stats, redirect to process and mindset
- Be warm, supportive, and parent-friendly
- Suggest concrete things parents can do at home to reinforce development`;

    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 400,
        system: systemPrompt,
        messages,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(`Anthropic API error: ${JSON.stringify(data)}`);
    }

    const content = data.content?.find((b: any) => b.type === "text")?.text ?? "I'm here to help — what would you like to know?";

    return new Response(JSON.stringify({ content }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
