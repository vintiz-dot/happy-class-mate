import { useNavigate, useLocation } from "react-router-dom";
import { Home, Calendar, Trophy, BookOpen, CreditCard, Star, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "dashboard", label: "Dashboard", icon: Home, path: "/student" },
  { id: "schedule", label: "Schedule", icon: Calendar, path: "/schedule" },
  { id: "quests", label: "Quests", icon: Trophy, path: "/student/assignments" },
  { id: "journal", label: "Journal", icon: BookOpen, path: "/student/journal" },
  { id: "tuition", label: "Tuition", icon: CreditCard, path: "/tuition" },
];

export function StudentNavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === "/student") {
      return location.pathname === "/student" || location.pathname === "/student/";
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-0 z-40 bg-background/95 backdrop-blur-md border-b border-border/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4">
        <div className="flex items-center justify-center gap-1 py-2 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const active = isActive(item.path);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all duration-200",
                  "hover:bg-muted/80",
                  active
                    ? "bg-blue-600/15 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400 shadow-sm"
                    : "text-muted-foreground"
                )}
              >
                <item.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
