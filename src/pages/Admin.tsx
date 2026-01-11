import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import OverviewTab from "@/components/admin/tabs/OverviewTab";
import StudentsTab from "@/components/admin/tabs/StudentsTab";
import ClassesTab from "@/components/admin/tabs/ClassesTab";
import TeachersTab from "@/components/admin/tabs/TeachersTab";
import FinanceTab from "@/components/admin/tabs/FinanceTab";
import ReportsTab from "@/components/admin/tabs/ReportsTab";
import AccountInfoTab from "@/components/admin/tabs/AccountInfoTab";
import AutomationTab from "@/components/admin/tabs/AutomationTab";
import DataTab from "@/components/admin/tabs/DataTab";
import GlobalCalendar from "@/components/schedule/GlobalCalendar";
import { AdminJournalViewEnhanced } from "@/components/admin/AdminJournalViewEnhanced";
import { FamiliesList } from "@/components/admin/FamiliesList";
import { AssignmentsOverview } from "@/components/admin/AssignmentsOverview";
import { 
  LayoutDashboard, 
  Users, 
  BookOpen, 
  GraduationCap, 
  Calendar, 
  ClipboardList, 
  BookMarked, 
  Wallet, 
  Home, 
  BarChart3, 
  CreditCard, 
  Cog, 
  Database,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const tabConfig = [
  { value: "overview", label: "Overview", icon: LayoutDashboard, color: "from-violet-500 to-purple-600" },
  { value: "students", label: "Students", icon: Users, color: "from-blue-500 to-cyan-500" },
  { value: "classes", label: "Classes", icon: BookOpen, color: "from-emerald-500 to-teal-500" },
  { value: "teachers", label: "Teachers", icon: GraduationCap, color: "from-amber-500 to-orange-500" },
  { value: "schedule", label: "Schedule", icon: Calendar, color: "from-rose-500 to-pink-500" },
  { value: "assignments", label: "Assignments", icon: ClipboardList, color: "from-indigo-500 to-violet-500" },
  { value: "journal", label: "Journal", icon: BookMarked, color: "from-cyan-500 to-blue-500" },
  { value: "finance", label: "Finance", icon: Wallet, color: "from-green-500 to-emerald-500" },
  { value: "families", label: "Families", icon: Home, color: "from-orange-500 to-amber-500" },
  { value: "reports", label: "Reports", icon: BarChart3, color: "from-purple-500 to-indigo-500" },
  { value: "account", label: "Account", icon: CreditCard, color: "from-pink-500 to-rose-500" },
  { value: "automation", label: "Automation", icon: Cog, color: "from-slate-500 to-zinc-600" },
  { value: "data", label: "Data", icon: Database, color: "from-teal-500 to-cyan-500" },
];

const Admin = ({ defaultTab }: { defaultTab?: string } = {}) => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = defaultTab || searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    navigate(`/admin?tab=${value}`);
  };

  const activeTab = tabConfig.find(t => t.value === tab) || tabConfig[0];

  return (
    <Layout>
      <div className="space-y-6">
        {/* Premium Header */}
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className="relative overflow-hidden rounded-2xl glass-lg p-6 md:p-8"
        >
          {/* Animated gradient background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 pointer-events-none" />
          <div className="absolute -top-24 -right-24 w-48 h-48 bg-gradient-to-br from-primary/20 to-transparent rounded-full blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 bg-gradient-to-tr from-accent/20 to-transparent rounded-full blur-2xl pointer-events-none" />
          
          <div className="relative flex items-center gap-4">
            <div className={cn(
              "h-14 w-14 rounded-2xl flex items-center justify-center shadow-lg",
              "bg-gradient-to-br",
              activeTab.color
            )}>
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <div>
              <h1 className="text-3xl md:text-4xl font-bold tracking-tight bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text">
                Admin Dashboard
              </h1>
              <p className="text-muted-foreground mt-1">
                Manage your English club with powerful tools
              </p>
            </div>
          </div>
        </motion.div>

        {/* Premium Tabs */}
        <Tabs value={tab} onValueChange={handleTabChange} className="space-y-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.1 }}
          >
            <TabsList className="w-full h-auto p-1.5 bg-card/50 backdrop-blur-xl border border-border/50 rounded-xl flex flex-wrap gap-1 justify-start">
              {tabConfig.map((tabItem, index) => {
                const Icon = tabItem.icon;
                const isActive = tab === tabItem.value;
                
                return (
                  <TabsTrigger
                    key={tabItem.value}
                    value={tabItem.value}
                    className={cn(
                      "relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-300",
                      "data-[state=active]:shadow-md",
                      isActive && "text-white"
                    )}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="activeTab"
                        className={cn(
                          "absolute inset-0 rounded-lg bg-gradient-to-r",
                          tabItem.color
                        )}
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <span className="relative z-10 flex items-center gap-2">
                      <Icon className={cn(
                        "h-4 w-4 transition-transform duration-300",
                        isActive && "scale-110"
                      )} />
                      <span className="hidden sm:inline">{tabItem.label}</span>
                    </span>
                  </TabsTrigger>
                );
              })}
            </TabsList>
          </motion.div>

          <AnimatePresence mode="wait">
            <motion.div
              key={tab}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              <TabsContent value="overview" className="mt-0">
                <OverviewTab />
              </TabsContent>
              <TabsContent value="students" className="mt-0">
                <StudentsTab />
              </TabsContent>
              <TabsContent value="classes" className="mt-0">
                <ClassesTab />
              </TabsContent>
              <TabsContent value="teachers" className="mt-0">
                <TeachersTab />
              </TabsContent>
              <TabsContent value="schedule" className="mt-0">
                <GlobalCalendar role="admin" />
              </TabsContent>
              <TabsContent value="assignments" className="mt-0">
                <AssignmentsOverview />
              </TabsContent>
              <TabsContent value="journal" className="mt-0">
                <AdminJournalViewEnhanced />
              </TabsContent>
              <TabsContent value="finance" className="mt-0">
                <FinanceTab />
              </TabsContent>
              <TabsContent value="families" className="mt-0">
                <FamiliesList />
              </TabsContent>
              <TabsContent value="reports" className="mt-0">
                <ReportsTab />
              </TabsContent>
              <TabsContent value="account" className="mt-0">
                <AccountInfoTab />
              </TabsContent>
              <TabsContent value="automation" className="mt-0">
                <AutomationTab />
              </TabsContent>
              <TabsContent value="data" className="mt-0">
                <DataTab />
              </TabsContent>
            </motion.div>
          </AnimatePresence>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;
