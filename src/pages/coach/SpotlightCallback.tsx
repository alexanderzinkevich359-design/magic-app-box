import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

const SpotlightCallback = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      const code = searchParams.get("code");
      const state = searchParams.get("state");
      const fbError = searchParams.get("error");
      const fbErrorDesc = searchParams.get("error_description");

      // Facebook denied or cancelled
      if (fbError) {
        setError(fbErrorDesc ?? "Facebook authorization was denied or cancelled.");
        return;
      }

      if (!code) {
        setError("No authorization code received from Facebook.");
        return;
      }

      // CSRF check
      const savedState = sessionStorage.getItem("spotlight_oauth_state");
      if (!savedState || savedState !== state) {
        setError("Security check failed. Please try connecting again.");
        return;
      }
      sessionStorage.removeItem("spotlight_oauth_state");

      // Build redirect URI (must exactly match what was used to initiate the flow)
      const redirectUri = `${window.location.origin}/coach/spotlight/callback`;

      try {
        const { data, error: fnError } = await supabase.functions.invoke("meta-oauth", {
          body: { code, redirectUri },
        });

        if (fnError || !data?.success) {
          const msg = data?.error ?? fnError?.message ?? "Failed to connect your Facebook account.";
          setError(msg);
          return;
        }

        navigate("/coach/spotlight?connected=true", { replace: true });
      } catch (e) {
        setError(e instanceof Error ? e.message : "An unexpected error occurred.");
      }
    };

    run();
    // Only run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-5">
          <div className="h-14 w-14 mx-auto rounded-full bg-red-500/10 flex items-center justify-center">
            <AlertCircle className="h-7 w-7 text-red-400" />
          </div>
          <h2 className="text-xl font-bold font-['Space_Grotesk']">Connection failed</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button onClick={() => navigate("/coach/spotlight")}>Back to Spotlight Studio</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Connecting your Facebook account…</p>
      </div>
    </div>
  );
};

export default SpotlightCallback;
