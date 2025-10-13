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
  ClipboardList
} from "lucide-react";
import ProfileSwitcher from "@/components/ProfileSwitcher";

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
          { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
          { icon: LayoutDashboard, label: "Admin", path: "/admin" },
          { icon: Users, label: "Students", path: "/students" },
          { icon: Users, label: "Teachers", path: "/teachers" },
          { icon: BookOpen, label: "Classes", path: "/classes" },
          { icon: Calendar, label: "Schedule", path: "/schedule" },
          { icon: DollarSign, label: "Finance", path: "/finance" },
        ];
      case "teacher":
        return [
          { icon: BarChart3, label: "Dashboard", path: "/dashboard" },
          { icon: Calendar, label: "Schedule", path: "/schedule" },
          { icon: BookOpen, label: "Classes", path: "/classes" },
          { icon: Wallet, label: "Payroll", path: "/teacher/payroll" },
          { icon: FileText, label: "Assignments", path: "/teacher/assignments" },
          { icon: ClipboardList, label: "Attendance", path: "/teacher/attendance" },
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
          { icon: BookOpen, label: "Classes", path: "/classes" },
          { icon: Receipt, label: "Tuition", path: "/tuition" },
          { icon: FileText, label: "Assignments", path: "/student/assignments" },
        ];
      default:
        return [];
    }
  };

  const navItems = getNavigationItems();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <GraduationCap className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground">
                {title || "Tuition Manager"}
              </h1>
              <p className="text-xs text-muted-foreground">Happy English Club</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            {(role === "student" || role === "family") && <ProfileSwitcher />}
            <div className="text-right">
              <p className="text-sm font-medium text-foreground">{user.email}</p>
              <p className="text-xs text-muted-foreground capitalize">{role}</p>
            </div>
            <Button onClick={signOut} variant="outline" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>
      </header>

      {/* Navigation */}
      <nav className="border-b bg-card">
        <div className="container mx-auto px-4">
          <div className="flex gap-1 py-2">
            {navItems.map((item) => (
              <Button
                key={item.path}
                variant="ghost"
                className="gap-2"
                onClick={() => navigate(item.path)}
              >
                <item.icon className="h-4 w-4" />
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {children}
      </main>
    </div>
  );
};

export default Layout;
