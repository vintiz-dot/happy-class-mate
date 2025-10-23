import { useEffect, useState, ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { AppLoader } from "./AppLoader";

interface StartupGuardProps {
  children: ReactNode;
}

export function StartupGuard({ children }: StartupGuardProps) {
  const [isChecking, setIsChecking] = useState(true);
  const [timeoutReached, setTimeoutReached] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let mounted = true;

    const checkAuth = async () => {
      try {
        // Race between session check and timeout
        const timeoutPromise = new Promise((_, reject) => {
          timeoutId = setTimeout(() => reject(new Error("Timeout")), 3000);
        });

        const sessionPromise = supabase.auth.getSession();

        const result = await Promise.race([sessionPromise, timeoutPromise]) as any;
        
        if (!mounted) return;

        const { data: { session }, error } = result;

        if (error) throw error;

        clearTimeout(timeoutId);

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
        setTimeoutReached(true);

        // Fallback: check localStorage for last known session
        const lastSession = localStorage.getItem("supabase.auth.token");
        
        if (lastSession) {
          navigate("/dashboard", { replace: true });
        } else {
          navigate("/auth", { replace: true });
        }

        setIsChecking(false);
      }
    };

    checkAuth();

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
    };
  }, [navigate]);

  if (isChecking) {
    return <AppLoader message={timeoutReached ? "Connection slow, routing..." : "Initializing..."} />;
  }

  return <>{children}</>;
}
