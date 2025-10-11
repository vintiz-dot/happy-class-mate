import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import Layout from "@/components/Layout";
import ProfilePicker from "@/components/ProfilePicker";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, BookOpen, Calendar, DollarSign } from "lucide-react";

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
          <p className="text-muted-foreground">Đang tải...</p>
        </div>
      </div>
    );
  }

  if (showProfilePicker && role === "family") {
    return <ProfilePicker onSelect={handleStudentSelect} />;
  }

  const getDashboardStats = () => {
    switch (role) {
      case "admin":
        return [
          { icon: Users, label: "Tổng học sinh", value: "0", color: "text-primary" },
          { icon: BookOpen, label: "Lớp học", value: "0", color: "text-accent" },
          { icon: Calendar, label: "Buổi học hôm nay", value: "0", color: "text-success" },
          { icon: DollarSign, label: "Doanh thu tháng", value: "0 ₫", color: "text-warning" },
        ];
      case "teacher":
        return [
          { icon: BookOpen, label: "Lớp của tôi", value: "0", color: "text-primary" },
          { icon: Calendar, label: "Buổi học hôm nay", value: "0", color: "text-accent" },
          { icon: Users, label: "Tổng học sinh", value: "0", color: "text-success" },
        ];
      case "family":
      case "student":
        return [
          { icon: BookOpen, label: "Lớp đang học", value: "0", color: "text-primary" },
          { icon: Calendar, label: "Buổi học tuần này", value: "0", color: "text-accent" },
          { icon: DollarSign, label: "Học phí tháng này", value: "0 ₫", color: "text-warning" },
        ];
      default:
        return [];
    }
  };

  const stats = getDashboardStats();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">
            Chào mừng đến với Tuition Manager
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
                <stat.icon className={`h-4 w-4 ${stat.color}`} />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Recent Activity */}
        <Card>
          <CardHeader>
            <CardTitle>Hoạt động gần đây</CardTitle>
            <CardDescription>
              Các hoạt động và thông báo mới nhất
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground text-center py-8">
              Chưa có hoạt động nào
            </p>
          </CardContent>
        </Card>
      </div>
    </Layout>
  );
};

export default Index;
