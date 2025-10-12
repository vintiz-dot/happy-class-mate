import Layout from "@/components/Layout";
import ProfilePicker from "@/components/ProfilePicker";
import { useAuth } from "@/hooks/useAuth";
import { ClassForm } from "@/components/admin/ClassForm";
import { ClassesList } from "@/components/admin/ClassesList";
import { SessionGenerator } from "@/components/admin/SessionGenerator";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
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
          <p className="text-muted-foreground">Đang tải...</p>
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
          <p className="text-muted-foreground">Chào mừng đến với Tuition Manager</p>
        </div>

        {role === "admin" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Quản lý Admin</h2>
              <p className="text-muted-foreground">Quản lý lớp học và lịch học</p>
            </div>

            <div className="grid gap-6 lg:grid-cols-2">
              <ClassForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["classes"] })} />
              <SessionGenerator onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sessions"] })} />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Danh sách lớp học</h3>
              <ClassesList />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Quản lý đăng ký lớp học</h3>
              <EnrollmentManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Quản lý giảm giá</h3>
              <DiscountManager />
            </div>

            <div>
              <h3 className="text-xl font-semibold mb-4">Lịch học</h3>
              <ScheduleCalendar role={role} />
            </div>
          </div>
        )}

        {role === "teacher" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Giáo viên</h2>
              <p className="text-muted-foreground">Quản lý điểm danh và bài tập</p>
            </div>
            <div className="grid gap-6 lg:grid-cols-2">
              <AttendanceMarking />
              <AssignmentUpload />
            </div>
            <div>
              <h3 className="text-xl font-semibold mb-4">Lịch dạy</h3>
              <ScheduleCalendar role={role} />
            </div>
          </div>
        )}

        {(role === "family" || role === "student") && (
          <div className="space-y-6">
            <div>
              <h2 className="text-2xl font-bold mb-2">Học viên</h2>
              <p className="text-muted-foreground">Lịch học và bài tập của bạn</p>
            </div>
            <ScheduleCalendar role={role} />
            <AssignmentsList />
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Index;
