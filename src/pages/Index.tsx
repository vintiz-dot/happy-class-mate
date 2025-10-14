import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { TuitionCard } from "@/components/student/TuitionCard";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { AttendanceMarking } from "@/components/teacher/AttendanceMarking";
import { AssignmentUpload } from "@/components/teacher/AssignmentUpload";
import AssignmentsList from "@/components/student/AssignmentsList";
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Navigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, DollarSign, GraduationCap, UserCog, Home } from "lucide-react";
import { OverviewStats } from "@/components/admin/OverviewStats";
import { UsersManager } from "@/components/admin/UsersManager";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

const Index = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const { studentId } = useStudentProfile();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (role === "student") {
    return <Navigate to="/dashboard" replace />;
  }

  if (role === "admin") {
    return <Navigate to="/admin" replace />;
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Tuition Manager</p>
        </div>


        {role === "teacher" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Teacher</h2>
              <p className="text-muted-foreground">Manage attendance and assignments</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <AttendanceMarking />
              <AssignmentUpload />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Teaching Schedule</h3>
              <ScheduleCalendar role={role} />
            </div>
          </div>
        )}

        {role === "family" && studentId && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Student</h2>
              <p className="text-muted-foreground">Your schedule and assignments</p>
            </div>
            <TuitionCard studentId={studentId} />
            <ScheduleCalendar role={role} />
            <AssignmentsList studentId={studentId} />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
