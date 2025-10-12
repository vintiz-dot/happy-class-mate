import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useNavigate } from "react-router-dom";

type UserRole = "admin" | "teacher" | "family" | "student";

interface AuthState {
  user: User | null;
  session: Session | null;
  role: UserRole | null;
  loading: boolean;
}

export function useAuth() {
  const [authState, setAuthState] = useState<AuthState>({
    user: null,
    session: null,
    role: null,
    loading: true,
  });
  const navigate = useNavigate();

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setAuthState(prev => ({
          ...prev,
          session,
          user: session?.user ?? null,
        }));

        // Fetch role after state update
        if (session?.user) {
          setTimeout(async () => {
            const { data: roleData } = await supabase
              .from("user_roles")
              .select("role")
              .eq("user_id", session.user.id)
              .order("role", { ascending: true }); // admin < student < teacher alphabetically

            // Prioritize admin role if present
            const userRole = roleData?.find(r => r.role === "admin")?.role || 
                           roleData?.find(r => r.role === "teacher")?.role ||
                           roleData?.[0]?.role;

            setAuthState(prev => ({
              ...prev,
              role: userRole as UserRole || null,
              loading: false,
            }));
          }, 0);
        } else {
          setAuthState(prev => ({ ...prev, role: null, loading: false }));
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthState(prev => ({
        ...prev,
        session,
        user: session?.user ?? null,
      }));

      if (session?.user) {
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .order("role", { ascending: true })
          .then(({ data: roleData }) => {
            // Prioritize admin role if present
            const userRole = roleData?.find(r => r.role === "admin")?.role || 
                           roleData?.find(r => r.role === "teacher")?.role ||
                           roleData?.[0]?.role;

            setAuthState(prev => ({
              ...prev,
              role: userRole as UserRole || null,
              loading: false,
            }));
          });
      } else {
        setAuthState(prev => ({ ...prev, loading: false }));
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  return {
    ...authState,
    signOut,
  };
}
