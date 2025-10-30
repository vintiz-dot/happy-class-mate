import { ReactNode } from "react";
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
  BookMarked
} from "lucide-react";
import ProfileSwitcher from "@/components/ProfileSwitcher";
import { ChangePassword } from "@/components/auth/ChangePassword";
import NotificationBell from "@/components/NotificationBell";

interface LayoutProps {
  children: ReactNode;
  title?: string;
}

const Layout = ({ children, title }: LayoutProps) => {
  const { user, role, signOut } = useAuth();
  const navigate = useNavigate();

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
    <div className="min-h-screen bg-background">
      {/* Sticky Header */}
      <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 shadow-sm">
        <div className="container mx-auto px-4 py-3 md:py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 md:gap-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-full bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center">
              <GraduationCap className="h-5 w-5 md:h-6 md:w-6 text-primary" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-base md:text-xl font-bold text-foreground">
                {title || "Tuition Manager"}
              </h1>
              <p className="text-xs text-muted-foreground hidden md:block">Happy English Club</p>
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            {(role === "student" || role === "family") && <ProfileSwitcher />}
            <NotificationBell />
            <div className="text-right hidden lg:block">
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
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
          <div className="flex gap-1 py-2 overflow-x-auto scrollbar-hide">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className="gap-2 whitespace-nowrap min-h-[44px] rounded-xl"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                <span className="text-xs sm:text-sm">{item.label}</span>
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-4 md:py-6 lg:py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
