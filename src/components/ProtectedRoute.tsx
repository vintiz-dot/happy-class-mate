import { ReactNode, useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRole: "admin" | "teacher" | "family" | "student";
}

export function ProtectedRoute({ children, allowedRole }: ProtectedRouteProps) {
  const { role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && role && role !== allowedRole) {
      toast.error("Access denied. You don't have permission to view this page.");
      // Redirect to appropriate dashboard
      if (role === "teacher") {
        navigate("/teacher/dashboard");
      } else if (role === "student" || role === "family") {
        navigate("/dashboard");
      } else {
        navigate("/");
      }
    }
  }, [role, loading, allowedRole, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (role !== allowedRole) {
    return null;
  }

  return <>{children}</>;
}
