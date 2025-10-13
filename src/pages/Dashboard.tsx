import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, role } = useAuth();

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
