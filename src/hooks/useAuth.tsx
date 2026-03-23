import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

type AppRole = "coach" | "athlete" | "parent";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  role: AppRole | null;
  profile: { first_name: string; last_name: string; avatar_url: string | null; phone: string | null; tier: string; coach_type: string | null } | null;
  loading: boolean;
  signUp: (email: string, password: string, firstName: string, lastName: string, role: AppRole, phone: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<AuthContextType["profile"]>(null);
  const [loading, setLoading] = useState(true);

  const fetchRoleAndProfile = async (userId: string) => {
    const [roleRes, profileRes] = await Promise.all([
      supabase.from("user_roles").select("role").eq("user_id", userId).single(),
      (supabase as any).from("profiles").select("first_name, last_name, avatar_url, phone, tier, coach_type").eq("user_id", userId).single(),
    ]);
    if (roleRes.data) setRole(roleRes.data.role as AppRole);
    if (profileRes.data) setProfile(profileRes.data);
  };

  useEffect(() => {
    // getSession() reads from storage and is the authoritative initial check.
    // Only clear loading once we have a definitive answer from storage.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchRoleAndProfile(session.user.id);
      }
      setLoading(false);
    });

    // onAuthStateChange handles sign-in/sign-out events after initial load.
    // It does NOT control the loading flag to avoid the race condition where
    // it fires with null before localStorage has been read.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        setTimeout(() => fetchRoleAndProfile(session.user.id), 0);
        // Auto-link any pending parent invites whenever a session is established.
        // This covers: email-confirmed signups, direct logins, and token-based signups.
        if (event === "SIGNED_IN") {
          const uid = session.user.id;
          const email = session.user.email;
          if (email) {
            (supabase as any)
              .from("parent_invites")
              .select("id, athlete_user_id")
              .eq("parent_email", email)
              .eq("status", "pending")
              .gt("expires_at", new Date().toISOString())
              .then(async ({ data: pending }: { data: Array<{ id: string; athlete_user_id: string }> | null }) => {
                for (const inv of pending ?? []) {
                  await (supabase as any)
                    .from("parent_athlete_links")
                    .insert({ parent_user_id: uid, athlete_user_id: inv.athlete_user_id })
                    .select();
                  await (supabase as any)
                    .from("parent_invites")
                    .update({ status: "accepted" })
                    .eq("id", inv.id);
                }
              });
          }
        }
      } else {
        setRole(null);
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, firstName: string, lastName: string, role: AppRole, phone: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: window.location.origin,
        data: { first_name: firstName, last_name: lastName, role, phone },
      },
    });
    return { error: error as Error | null };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setRole(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, role, profile, loading, signUp, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
