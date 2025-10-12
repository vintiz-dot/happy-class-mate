import Layout from "@/components/Layout";
import ProfilePicker from "@/components/ProfilePicker";
import { useAuth } from "@/hooks/useAuth";
import { TuitionCard } from "@/components/student/TuitionCard";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { AttendanceMarking } from "@/components/teacher/AttendanceMarking";
import { AssignmentUpload } from "@/components/teacher/AssignmentUpload";
import { AssignmentsList } from "@/components/student/AssignmentsList";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, DollarSign, GraduationCap, UserCog, Home, UserCheck } from "lucide-react";
import { OverviewStats } from "@/components/admin/OverviewStats";
import { UsersManager } from "@/components/admin/UsersManager";

const Index = () => {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showProfilePicker, setShowProfilePicker] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    } else if (role === "family" && !selectedStudent) {
      setShowProfilePicker(true);
    }
  }, [user, role, loading, navigate, selectedStudent]);

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudent(studentId);
    setShowProfilePicker(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (showProfilePicker && role === "family") {
    return <ProfilePicker onSelect={handleStudentSelect} />;
  }

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Welcome to Tuition Manager</p>
        </div>

        {role === "admin" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Admin Dashboard</h2>
              <p className="text-muted-foreground">Quick access to all management sections</p>
            </div>

            <OverviewStats />

            <UsersManager />

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/students")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    Students
                  </CardTitle>
                  <CardDescription>
                    Manage student records and enrollments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    View, create, and manage student information
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/families")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Home className="h-5 w-5 text-primary" />
                    Families
                  </CardTitle>
                  <CardDescription>
                    Manage family accounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Create and manage family records
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/teachers")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <UserCog className="h-5 w-5 text-primary" />
                    Teachers
                  </CardTitle>
                  <CardDescription>
                    Manage teacher accounts and payroll
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Create teachers, manage admin users, and process payroll
                  </p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/classes")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Classes
                  </CardTitle>
                  <CardDescription>
                    Manage classes and enrollments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Create classes, manage enrollments, and assign students
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/schedule")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-primary" />
                    Schedule
                  </CardTitle>
                  <CardDescription>
                    Manage sessions and timetables
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Generate sessions and view the class schedule
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/finance")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5 text-primary" />
                    Finance
                  </CardTitle>
                  <CardDescription>
                    Manage payments and discounts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    Process payments, manage discounts, and handle tuition
                  </p>
                </CardContent>
              </Card>

              <Card 
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate("/tuition")}
              >
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <GraduationCap className="h-5 w-5 text-primary" />
                    Tuition
                  </CardTitle>
                  <CardDescription>
                    Manage student tuition
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    View tuition details, payments, and discounts
                  </p>
                </CardContent>
              </Card>

            </div>
          </div>
        )}

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

        {(role === "family" || role === "student") && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Student</h2>
              <p className="text-muted-foreground">Your schedule and assignments</p>
            </div>
            {selectedStudent && <TuitionCard studentId={selectedStudent} />}
            <ScheduleCalendar role={role} />
            <AssignmentsList />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
