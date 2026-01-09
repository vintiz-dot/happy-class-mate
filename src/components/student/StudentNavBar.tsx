import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

const navItems = [
  { id: "dashboard", label: "🏠 Dashboard", path: "/student" },
  { id: "schedule", label: "📅 Schedule", path: "/schedule" },
  { id: "quests", label: "📚 Quests", path: "/student/assignments" },
  { id: "journal", label: "📖 Journal", path: "/student/journal" },
  { id: "tuition", label: "💰 Tuition", path: "/tuition" },
  { id: "achievements", label: "🏆 Achievements", path: "/student?tab=achievements" },
  { id: "xp-guide", label: "⚡ XP Guide", path: "/student?tab=xp-guide" },
];

export function StudentNavBar() {
  const navigate = useNavigate();
  const location = useLocation();

  const isActive = (path: string, id: string) => {
    const searchParams = new URLSearchParams(location.search);
    const currentTab = searchParams.get("tab");
    
    if (id === "achievements" || id === "xp-guide") {
      return currentTab === id;
    }
    if (path === "/student") {
      return (location.pathname === "/student" || location.pathname === "/student/" || location.pathname === "/student/dashboard") && !currentTab;
    }
    return location.pathname.startsWith(path);
  };

  return (
    <nav className="sticky top-[57px] md:top-[65px] z-40 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60 border-b shadow-sm">
      <div className="container mx-auto px-4">
        <div className="flex items-center gap-0.5 py-1.5 overflow-x-auto scrollbar-hide">
          {navItems.map((item) => {
            const active = isActive(item.path, item.id);
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.path)}
                className={cn(
                  "px-2 md:px-3 py-1.5 rounded-lg text-xs md:text-sm font-medium whitespace-nowrap transition-all duration-200",
                  "hover:text-red-500",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted/80"
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}