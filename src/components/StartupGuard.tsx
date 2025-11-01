import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLoader } from "./AppLoader";

interface StartupGuardProps {
  children: ReactNode;
}

export function StartupGuard({ children }: StartupGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (!mounted) return;
        if (error) throw error;

        // Route based on session
        if (session) {
          const currentPath = window.location.pathname;
          if (currentPath === "/auth" || currentPath === "/") {
            navigate("/dashboard", { replace: true });
          }
        } else {
          const currentPath = window.location.pathname;
          if (currentPath !== "/auth" && currentPath !== "/") {
            navigate("/auth", { replace: true });
          }
        }

        setIsChecking(false);
      } catch (error) {
        if (!mounted) return;
        console.error("Startup guard error:", error);
        navigate("/auth", { replace: true });
        setIsChecking(false);
      }
    };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, [navigate]);

  if (isChecking) {
    return <AppLoader message="Initializing..." />;
  }

  return <>{children}</>;
}
