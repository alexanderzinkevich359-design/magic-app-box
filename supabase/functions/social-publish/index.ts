import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Poll Instagram container until status is FINISHED (up to 60s) */
async function pollContainerStatus(containerId: string, pageToken: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000)); // wait 5s between polls
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${pageToken}`
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return true;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") return false;
    // IN_PROGRESS or PUBLISHED — keep polling
  }
  return false; // timeout
}

/** Publish a single post row. Returns { success, instagramPostId?, facebookPostId?, error? } */
async function publishPost(post: Record<string, unknown>, serviceClient: ReturnType<typeof createClient>) {
  const platforms = (post.platforms as string[]) ?? [];
  const caption = (post.instagram_caption as string) ?? (post.facebook_caption as string) ?? "";
  const mediaUrl = post.media_url as string | null;
  const mediaType = post.media_type as string | null; // 'photo' | 'video'

  // Fetch coach's social connection
  const { data: conn, error: connErr } = await serviceClient
    .from("social_connections")
    .select("*")
    .eq("coach_id", post.coach_id)
    .single();

  if (connErr || !conn) {
    return { success: false, error: "No social connection found for coach" };
  }

  const pageToken = conn.facebook_access_token as string;
  const pageId = conn.facebook_page_id as string;
  const igAccountId = conn.instagram_account_id as string | null;

  let instagramPostId: string | null = null;
  let facebookPostId: string | null = null;
  const errors: string[] = [];

  // ── Instagram publish ──────────────────────────────────────────────────────
  if (platforms.includes("instagram") && igAccountId && mediaUrl) {
    try {
      const igCaption = (post.instagram_caption as string) ?? caption;

      // Step 1: Create media container
      const containerParams: Record<string, string> = {
        access_token: pageToken,
        caption: igCaption,
      };

      if (mediaType === "video") {
        containerParams.media_type = "REELS";
        containerParams.video_url = mediaUrl;
      } else {
        containerParams.image_url = mediaUrl;
      }

      const containerRes = await fetch(
        `https://graph.facebook.com/v19.0/${igAccountId}/media`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(containerParams),
        }
      );
      const containerData = await containerRes.json();

      if (!containerRes.ok || !containerData.id) {
        errors.push(`Instagram container creation failed: ${JSON.stringify(containerData)}`);
      } else {
        const containerId = containerData.id as string;

        // Step 2: Poll until FINISHED
        const finished = await pollContainerStatus(containerId, pageToken);
        if (!finished) {
          errors.push("Instagram media container did not finish processing in time");
        } else {
          // Step 3: Publish
          const publishRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: containerId, access_token: pageToken }),
            }
          );
          const publishData = await publishRes.json();
          if (!publishRes.ok || !publishData.id) {
            errors.push(`Instagram publish failed: ${JSON.stringify(publishData)}`);
          } else {
            instagramPostId = publishData.id as string;
          }
        }
      }
    } catch (e) {
      errors.push(`Instagram error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Facebook publish ───────────────────────────────────────────────────────
  if (platforms.includes("facebook") && mediaUrl) {
    try {
      const fbCaption = (post.facebook_caption as string) ?? caption;

      let fbEndpoint: string;
      let fbBody: Record<string, string>;

      if (mediaType === "video") {
        fbEndpoint = `https://graph-video.facebook.com/v19.0/${pageId}/videos`;
        fbBody = {
          file_url: mediaUrl,
          description: fbCaption,
          access_token: pageToken,
        };
      } else {
        fbEndpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        fbBody = {
          url: mediaUrl,
          caption: fbCaption,
          access_token: pageToken,
        };
      }

      const fbRes = await fetch(fbEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbBody),
      });
      const fbData = await fbRes.json();
      if (!fbRes.ok || (!fbData.id && !fbData.post_id)) {
        errors.push(`Facebook publish failed: ${JSON.stringify(fbData)}`);
      } else {
        facebookPostId = (fbData.post_id ?? fbData.id) as string;
      }
    } catch (e) {
      errors.push(`Facebook error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // At least one platform must succeed for overall success
  const anySuccess = instagramPostId !== null || facebookPostId !== null;

  return {
    success: anySuccess,
    instagramPostId,
    facebookPostId,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Verify JWT
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization header" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const { postId } = await req.json();
    if (!postId) {
      return new Response(JSON.stringify({ error: "Missing postId" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch the post
    const { data: post, error: postErr } = await serviceClient
      .from("spotlight_posts")
      .select("*")
      .eq("id", postId)
      .single();

    if (postErr || !post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate ownership
    if (post.coach_id !== user.id) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate media permission
    if (!post.media_permission_confirmed) {
      return new Response(JSON.stringify({ error: "Media permission not confirmed" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const result = await publishPost(post, serviceClient);

    if (result.success) {
      await serviceClient
        .from("spotlight_posts")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          instagram_post_id: result.instagramPostId,
          facebook_post_id: result.facebookPostId,
          publish_error: result.error ?? null, // partial failure message if any
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
    } else {
      await serviceClient
        .from("spotlight_posts")
        .update({
          status: "failed",
          publish_error: result.error ?? "Unknown publish error",
          updated_at: new Date().toISOString(),
        })
        .eq("id", postId);
    }

    return new Response(JSON.stringify({ success: result.success, error: result.error }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("social-publish error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
