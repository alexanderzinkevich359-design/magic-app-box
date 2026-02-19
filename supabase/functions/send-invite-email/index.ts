import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY is not configured");
    }

    const { athleteEmail, athleteName, coachName, signupUrl } = await req.json();

    if (!athleteEmail || !athleteName || !coachName) {
      return new Response(
        JSON.stringify({ error: "Missing required fields" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 20px;">
        <div style="text-align: center; margin-bottom: 32px;">
          <div style="display: inline-block; background: #e11d48; color: white; font-size: 24px; font-weight: bold; width: 48px; height: 48px; line-height: 48px; border-radius: 12px;">⊕</div>
        </div>
        <h1 style="font-size: 22px; font-weight: 700; color: #111; margin-bottom: 8px; text-align: center;">
          You've been invited to join a team!
        </h1>
        <p style="font-size: 15px; color: #555; text-align: center; margin-bottom: 24px;">
          <strong>${coachName}</strong> has invited you to join their team on ClipMVP.
        </p>
        <div style="background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 12px; padding: 20px; margin-bottom: 24px;">
          <p style="margin: 0 0 4px; font-size: 13px; color: #888;">Invited as</p>
          <p style="margin: 0; font-size: 16px; font-weight: 600; color: #111;">${athleteName}</p>
        </div>
        <div style="text-align: center; margin-bottom: 24px;">
          <a href="${signupUrl}" style="display: inline-block; background: #e11d48; color: white; text-decoration: none; padding: 12px 32px; border-radius: 8px; font-weight: 600; font-size: 15px;">
            Accept Invite & Sign Up
          </a>
        </div>
        <p style="font-size: 13px; color: #999; text-align: center;">
          Already have an account? Just log in — you'll see the invite on your dashboard.
        </p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0 16px;" />
        <p style="font-size: 11px; color: #bbb; text-align: center;">
          ClipMVP · Athlete Performance Platform
        </p>
      </div>
    `;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "ClipMVP <onboarding@resend.dev>",
        to: [athleteEmail],
        subject: `${coachName} invited you to join their team on ClipMVP`,
        html: emailHtml,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Resend API error:", data);
      throw new Error(`Resend API failed [${res.status}]: ${JSON.stringify(data)}`);
    }

    return new Response(JSON.stringify({ success: true, id: data.id }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Error sending invite email:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
