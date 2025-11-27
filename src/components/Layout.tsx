import { ReactNode, useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import {
  GraduationCap,
  LogOut,
  Users,
  BookOpen,
  Calendar,
  DollarSign,
  BarChart3,
  Receipt,
  Wallet,
  LayoutDashboard,
  FileText,
  ClipboardList,
  BookMarked,
} from "lucide-react";
import ProfileSwitcher from "@/components/ProfileSwitcher";
import { ChangePassword } from "@/components/auth/ChangePassword";
import NotificationBell from "@/components/NotificationBell";
import { supabase } from "@/integrations/supabase/client";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const Layout = ({ children, title }: LayoutProps) => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();
  const [userName, setUserName] = useState<string>("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  useEffect(() => {
    const fetchUserInfo = async () => {
      if (!user) return;

      // Try to get student info
      const { data: studentData } = await supabase
        .from("students")
        .select("full_name, avatar_url")
        .eq("linked_user_id", user.id)
        .single();

      if (studentData?.full_name) {
        setUserName(studentData.full_name);
        setAvatarUrl(studentData.avatar_url);
        return;
      }

      // Try to get teacher info
      const { data: teacherData } = await supabase
        .from("teachers")
        .select("full_name, avatar_url")
        .eq("user_id", user.id)
        .single();

      if (teacherData?.full_name) {
        setUserName(teacherData.full_name);
        setAvatarUrl(teacherData.avatar_url);
        return;
      }

      // Try to get family name
      const { data: familyData } = await supabase
        .from("families")
        .select("name")
        .eq("primary_user_id", user.id)
        .single();

      if (familyData?.name) {
        setUserName(familyData.name);
      }
    };

    fetchUserInfo();
  }, [user]);

  if (!user) {
    return <>{children}</>;
  }

  const getNavigationItems = () => {
    switch (role) {
      case "admin":
        return [
          { icon: LayoutDashboard, label: "Admin", path: "/admin" },
          { icon: Users, label: "Students", path: "/students" },
          { icon: Users, label: "Teachers", path: "/teachers" },
          { icon: BookOpen, label: "Classes", path: "/classes" },
        ];
      case "teacher":
        return [
          { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
          { icon: Calendar, label: "Schedule", path: "/schedule" },
          { icon: Wallet, label: "Payroll", path: "/teacher/payroll" },
          { icon: FileText, label: "Assignments", path: "/teacher/assignments" },
          { icon: ClipboardList, label: "Attendance", path: "/teacher/attendance" },
          { icon: BookMarked, label: "Journal", path: "/teacher/journal" },
        ];
      case "family":
        return [
          { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
          { icon: Users, label: "Children", path: "/students" },
          { icon: Receipt, label: "Tuition", path: "/tuition" },
        ];
      case "student":
        return [
          { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
          { icon: Calendar, label: "Schedule", path: "/schedule" },
          { icon: Receipt, label: "Tuition", path: "/tuition" },
          { icon: FileText, label: "Assignments", path: "/student/assignments" },
          { icon: BookMarked, label: "Journal", path: "/student/journal" },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavigationItems();

  return (
    <div className="min-h-screen">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base md:text-xl font-bold text-foreground">{title || "Education Manager"}</h1>
              <p className="text-xs text-muted-foreground hidden md:block">Happy English Club</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {(role === "student" || role === "family") && <ProfileSwitcher />}
            <NotificationBell />
            {userName && (
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={avatarUrl || undefined} alt={userName} />
                  <AvatarFallback className="text-xs">
                    {userName.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium text-foreground">{userName}</span>
              </div>
            )}
            <ChangePassword />
            <Button onClick={signOut} variant="outline" size="sm" className="hidden sm:flex">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
            <Button onClick={signOut} variant="outline" size="icon" className="sm:hidden">
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="sticky top-[73px] md:top-[81px] z-40 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm">
        <div className="container mx-auto px-4">
          <div className="flex gap-2 py-2 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className="flex-col gap-1 whitespace-nowrap min-w-[60px] h-auto py-2 px-3 rounded-xl"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-5 w-5 shrink-0" />
                <span className="text-[10px] sm:text-xs leading-tight">{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 md:py-6 lg:py-8">{children}</main>
    </div>
  );
};

export default Layout;
