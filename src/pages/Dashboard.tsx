import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  // Wait for auth to load before making decisions
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }

    // Redirect based on user role
    if (role === "admin") {
      navigate("/schedule");
    } else if (role === "teacher") {
      navigate("/teacher/dashboard");
    } else if (role === "student") {
      navigate("/student/dashboard");
    }
  }, [user, role, navigate]);

  return null;
}
