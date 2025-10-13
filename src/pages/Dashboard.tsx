import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import StudentDashboard from "./StudentDashboard";
import TeacherDashboard from "./TeacherDashboard";
import Schedule from "./Schedule";

export default function Dashboard() {
  const { role } = useAuth();

  if (role === "student" || role === "family") {
    return <StudentDashboard />;
  }

  if (role === "teacher") {
    return <TeacherDashboard />;
  }

  if (role === "admin") {
    return <Schedule />;
  }

  return <Navigate to="/auth" />;
}
