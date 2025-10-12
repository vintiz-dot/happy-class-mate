import Layout from "@/components/Layout";
import ProfilePicker from "@/components/ProfilePicker";
import { useAuth } from "@/hooks/useAuth";
import { ClassForm } from "@/components/admin/ClassForm";
import { ClassesList } from "@/components/admin/ClassesList";
import { SessionGenerator } from "@/components/admin/SessionGenerator";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { PaymentManager } from "@/components/admin/PaymentManager";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { DataImportExport } from "@/components/admin/DataImportExport";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { TuitionCard } from "@/components/student/TuitionCard";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";
import { AttendanceMarking } from "@/components/teacher/AttendanceMarking";
import { AssignmentUpload } from "@/components/teacher/AssignmentUpload";
import { AssignmentsList } from "@/components/student/AssignmentsList";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const { user, role, loading } = useAuth();
  const queryClient = useQueryClient();
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
              <h2 className="text-2xl font-bold mb-2">Admin Management</h2>
              <p className="text-muted-foreground">Manage classes and schedules</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ClassForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["classes"] })} />
              <SessionGenerator onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sessions"] })} />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Class List</h3>
              <ClassesList />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Enrollment Management</h3>
              <EnrollmentManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Discount Management</h3>
              <DiscountManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Payment Management</h3>
              <PaymentManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Teacher Payroll</h3>
              <PayrollManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Import / Export Data</h3>
              <DataImportExport />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Admin Users</h3>
              <AdminUsersManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Schedule</h3>
              <ScheduleCalendar role={role} />
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
