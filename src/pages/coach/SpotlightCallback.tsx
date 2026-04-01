import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

const SpotlightCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const closeOrRedirect = (type: "spotlight_connected" | "spotlight_error", message?: string) => {
    if (window.opener) {
      window.opener.postMessage(
        type === "spotlight_connected" ? { type } : { type, message },
        window.location.origin
      );
      // Brief delay so user sees the result before the tab closes
      setTimeout(() => window.close(), 1200);
    } else {
      // Fallback: same-tab redirect
      if (type === "spotlight_connected") {
        navigate("/coach/spotlight?connected=true", { replace: true });
      }
    }
  };

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const fbError = searchParams.get("error");
      const fbErrorDesc = searchParams.get("error_description");

      if (fbError) {
        const msg = fbErrorDesc ?? "Facebook authorization was denied or cancelled.";
        setError(msg);
        closeOrRedirect("spotlight_error", msg);
        return;
      }

      if (!code) {
        const msg = "No authorization code received from Facebook.";
        setError(msg);
        closeOrRedirect("spotlight_error", msg);
        return;
      }

      // CSRF check — uses localStorage so it works when opened in a new tab
      const savedState = localStorage.getItem("spotlight_oauth_state");
      if (!savedState || savedState !== state) {
        const msg = "Security check failed. Please try connecting again.";
        setError(msg);
        closeOrRedirect("spotlight_error", msg);
        return;
      }
      localStorage.removeItem("spotlight_oauth_state");

      const redirectUri = `${window.location.origin}/coach/spotlight/callback`;

      try {
        const { data, error: fnError } = await supabase.functions.invoke("meta-oauth", {
          body: { code, redirectUri },
        });

        if (fnError || !data?.success) {
          const msg = data?.error ?? fnError?.message ?? "Failed to connect your Facebook account.";
          setError(msg);
          closeOrRedirect("spotlight_error", msg);
          return;
        }

        setSuccess(true);
        closeOrRedirect("spotlight_connected");
      } catch (e) {
        const msg = e instanceof Error ? e.message : "An unexpected error occurred.";
        setError(msg);
        closeOrRedirect("spotlight_error", msg);
      }
    };

    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (success) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <div className="h-14 w-14 mx-auto rounded-full bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-7 w-7 text-emerald-400" />
          </div>
          <h2 className="text-xl font-bold font-['Space_Grotesk']">Connected!</h2>
          <p className="text-sm text-muted-foreground">Your account has been linked. This tab will close shortly.</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="h-14 w-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold font-['Space_Grotesk']">Connection failed</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => window.opener ? window.close() : navigate("/coach/spotlight")}>
            Close
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting your account…</p>
      </div>
    </div>
  );
};

export default SpotlightCallback;
