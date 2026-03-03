/**
 * publish-scheduled-posts
 * Called by pg_cron every 5 minutes. No JWT required (verify_jwt = false).
 * Queries all spotlight_posts with status='scheduled' and scheduled_at <= NOW(),
 * then publishes each one using the same logic as social-publish.
 */
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

/** Poll Instagram container until status is FINISHED (up to 60s) */
async function pollContainerStatus(containerId: string, pageToken: string): Promise<boolean> {
  for (let i = 0; i < 12; i++) {
    await new Promise((r) => setTimeout(r, 5000));
    const res = await fetch(
      `https://graph.facebook.com/v19.0/${containerId}?fields=status_code&access_token=${pageToken}`
    );
    const data = await res.json();
    if (data.status_code === "FINISHED") return true;
    if (data.status_code === "ERROR" || data.status_code === "EXPIRED") return false;
  }
  return false;
}

async function publishPost(
  post: Record<string, unknown>,
  conn: Record<string, unknown>
) {
  const platforms = (post.platforms as string[]) ?? [];
  const caption = (post.instagram_caption as string) ?? (post.facebook_caption as string) ?? "";
  const mediaUrl = post.media_url as string | null;
  const mediaType = post.media_type as string | null;

  const pageToken = conn.facebook_access_token as string;
  const pageId = conn.facebook_page_id as string;
  const igAccountId = conn.instagram_account_id as string | null;

  let instagramPostId: string | null = null;
  let facebookPostId: string | null = null;
  const errors: string[] = [];

  // ── Instagram ──────────────────────────────────────────────────────────────
  if (platforms.includes("instagram") && igAccountId && mediaUrl) {
    try {
      const igCaption = (post.instagram_caption as string) ?? caption;
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
        errors.push(`IG container failed: ${JSON.stringify(containerData)}`);
      } else {
        const finished = await pollContainerStatus(containerData.id, pageToken);
        if (!finished) {
          errors.push("IG container did not finish");
        } else {
          const publishRes = await fetch(
            `https://graph.facebook.com/v19.0/${igAccountId}/media_publish`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ creation_id: containerData.id, access_token: pageToken }),
            }
          );
          const publishData = await publishRes.json();
          if (publishRes.ok && publishData.id) {
            instagramPostId = publishData.id;
          } else {
            errors.push(`IG publish failed: ${JSON.stringify(publishData)}`);
          }
        }
      }
    } catch (e) {
      errors.push(`IG error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  // ── Facebook ───────────────────────────────────────────────────────────────
  if (platforms.includes("facebook") && mediaUrl) {
    try {
      const fbCaption = (post.facebook_caption as string) ?? caption;
      let fbEndpoint: string;
      let fbBody: Record<string, string>;

      if (mediaType === "video") {
        fbEndpoint = `https://graph-video.facebook.com/v19.0/${pageId}/videos`;
        fbBody = { file_url: mediaUrl, description: fbCaption, access_token: pageToken };
      } else {
        fbEndpoint = `https://graph.facebook.com/v19.0/${pageId}/photos`;
        fbBody = { url: mediaUrl, caption: fbCaption, access_token: pageToken };
      }

      const fbRes = await fetch(fbEndpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(fbBody),
      });
      const fbData = await fbRes.json();
      if (fbRes.ok && (fbData.id || fbData.post_id)) {
        facebookPostId = fbData.post_id ?? fbData.id;
      } else {
        errors.push(`FB failed: ${JSON.stringify(fbData)}`);
      }
    } catch (e) {
      errors.push(`FB error: ${e instanceof Error ? e.message : String(e)}`);
    }
  }

  const anySuccess = instagramPostId !== null || facebookPostId !== null;
  return {
    success: anySuccess,
    instagramPostId,
    facebookPostId,
    error: errors.length > 0 ? errors.join("; ") : undefined,
  };
}

serve(async (_req) => {
  try {
    const serviceClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Fetch all due scheduled posts
    const { data: posts, error: fetchErr } = await serviceClient
      .from("spotlight_posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", new Date().toISOString());

    if (fetchErr) {
      console.error("Failed to fetch scheduled posts:", fetchErr);
      return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
    }

    if (!posts || posts.length === 0) {
      return new Response(JSON.stringify({ processed: 0 }), { status: 200 });
    }

    let processed = 0;

    for (const post of posts) {
      try {
        // Fetch coach's social connection
        const { data: conn, error: connErr } = await serviceClient
          .from("social_connections")
          .select("*")
          .eq("coach_id", post.coach_id)
          .single();

        if (connErr || !conn) {
          await serviceClient
            .from("spotlight_posts")
            .update({
              status: "failed",
              publish_error: "No social connection found",
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
          continue;
        }

        if (!post.media_permission_confirmed) {
          await serviceClient
            .from("spotlight_posts")
            .update({
              status: "failed",
              publish_error: "Media permission not confirmed",
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
          continue;
        }

        const result = await publishPost(post, conn);

        if (result.success) {
          await serviceClient
            .from("spotlight_posts")
            .update({
              status: "published",
              published_at: new Date().toISOString(),
              instagram_post_id: result.instagramPostId,
              facebook_post_id: result.facebookPostId,
              publish_error: result.error ?? null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
        } else {
          await serviceClient
            .from("spotlight_posts")
            .update({
              status: "failed",
              publish_error: result.error ?? "Unknown publish error",
              updated_at: new Date().toISOString(),
            })
            .eq("id", post.id);
        }

        processed++;
      } catch (postErr) {
        console.error(`Error processing post ${post.id}:`, postErr);
        await serviceClient
          .from("spotlight_posts")
          .update({
            status: "failed",
            publish_error: postErr instanceof Error ? postErr.message : "Unexpected error",
            updated_at: new Date().toISOString(),
          })
          .eq("id", post.id);
      }
    }

    return new Response(JSON.stringify({ processed }), { status: 200 });
  } catch (error: unknown) {
    console.error("publish-scheduled-posts error:", error);
    const msg = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), { status: 500 });
  }
});
