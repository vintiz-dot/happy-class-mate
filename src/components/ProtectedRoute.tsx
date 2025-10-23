import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate, useLocation } from "react-router-dom";
import { toast } from "sonner";
import { AppLoader } from "./AppLoader";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: "admin" | "teacher" | "family" | "student";
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (loading) return;

    // No user session - redirect to auth with intent to return
    if (!user) {
      navigate("/auth", { 
        replace: true, 
        state: { redirectTo: location.pathname } 
      });
      return;
    }

    // User logged in but wrong role
    if (role && role !== allowedRole) {
      toast.error("Access denied. You don't have permission to view this page.");
      
      // Redirect to appropriate dashboard
      if (role === "teacher") {
        navigate("/teacher/dashboard", { replace: true });
      } else if (role === "student" || role === "family") {
        navigate("/dashboard", { replace: true });
      } else if (role === "admin") {
        navigate("/dashboard", { replace: true });
      } else {
        navigate("/", { replace: true });
      }
    }
  }, [user, role, loading, allowedRole, navigate, location]);

  if (loading) {
    return <AppLoader message="Verifying access..." />;
  }

  if (!user || role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
