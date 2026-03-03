import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Verify JWT — extract user from authorization header
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const FACEBOOK_APP_ID = Deno.env.get("FACEBOOK_APP_ID");
    const FACEBOOK_APP_SECRET = Deno.env.get("FACEBOOK_APP_SECRET");

    if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
      return new Response(JSON.stringify({ error: "Facebook app credentials not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get the authenticated user via anon client
    const anonClient = createClient(SUPABASE_URL, Deno.env.get("SUPABASE_ANON_KEY") ?? "", {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userError } = await anonClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, redirectUri } = await req.json();
    if (!code) {
      return new Response(JSON.stringify({ error: "Missing code" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ── Step 1: Exchange code for short-lived user token ────────────────────────
    const tokenUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    tokenUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    tokenUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    tokenUrl.searchParams.set("redirect_uri", redirectUri);
    tokenUrl.searchParams.set("code", code);

    const tokenRes = await fetch(tokenUrl.toString());
    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token exchange failed:", tokenData);
      return new Response(JSON.stringify({ error: "Failed to exchange authorization code", detail: tokenData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const shortLivedToken: string = tokenData.access_token;

    // ── Step 2: Extend to long-lived user token ──────────────────────────────────
    const extendUrl = new URL("https://graph.facebook.com/v19.0/oauth/access_token");
    extendUrl.searchParams.set("grant_type", "fb_exchange_token");
    extendUrl.searchParams.set("client_id", FACEBOOK_APP_ID);
    extendUrl.searchParams.set("client_secret", FACEBOOK_APP_SECRET);
    extendUrl.searchParams.set("fb_exchange_token", shortLivedToken);

    const extendRes = await fetch(extendUrl.toString());
    const extendData = await extendRes.json();
    if (!extendRes.ok || !extendData.access_token) {
      console.error("Token extension failed:", extendData);
      return new Response(JSON.stringify({ error: "Failed to extend user token", detail: extendData }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const longLivedUserToken: string = extendData.access_token;

    // ── Step 3: Fetch Facebook Pages ─────────────────────────────────────────────
    const pagesRes = await fetch(
      `https://graph.facebook.com/v19.0/me/accounts?fields=id,name,access_token&access_token=${longLivedUserToken}`
    );
    const pagesData = await pagesRes.json();
    if (!pagesRes.ok || !pagesData.data || pagesData.data.length === 0) {
      console.error("Pages fetch failed or no pages:", pagesData);
      return new Response(
        JSON.stringify({ error: "No Facebook Pages found. Make sure you have a Facebook Page and selected it during authorization.", detail: pagesData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use the first page
    const page = pagesData.data[0];
    const pageId: string = page.id;
    const pageName: string = page.name;
    const pageToken: string = page.access_token; // Page-level token — never expires

    // ── Step 4: Fetch linked Instagram Business account ──────────────────────────
    let instagramAccountId: string | null = null;
    let instagramUsername: string | null = null;

    const igRes = await fetch(
      `https://graph.facebook.com/v19.0/${pageId}?fields=instagram_business_account&access_token=${pageToken}`
    );
    const igData = await igRes.json();
    if (igRes.ok && igData.instagram_business_account?.id) {
      instagramAccountId = igData.instagram_business_account.id;

      // Fetch Instagram username
      const igProfileRes = await fetch(
        `https://graph.facebook.com/v19.0/${instagramAccountId}?fields=username&access_token=${pageToken}`
      );
      const igProfileData = await igProfileRes.json();
      if (igProfileRes.ok && igProfileData.username) {
        instagramUsername = igProfileData.username;
      }
    }
    // Instagram not found is non-fatal — coach may not have a linked IG Business account yet

    // ── Step 5: Upsert into social_connections via service role ─────────────────
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    const { error: upsertError } = await serviceClient
      .from("social_connections")
      .upsert(
        {
          coach_id: user.id,
          facebook_page_id: pageId,
          facebook_page_name: pageName,
          facebook_access_token: pageToken,
          instagram_account_id: instagramAccountId,
          instagram_username: instagramUsername,
          connected_at: new Date().toISOString(),
        },
        { onConflict: "coach_id" }
      );

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(JSON.stringify({ error: "Failed to save connection", detail: upsertError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        success: true,
        pageName,
        instagramUsername,
        instagramConnected: !!instagramAccountId,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("meta-oauth error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
