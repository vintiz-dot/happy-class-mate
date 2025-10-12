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

const Admin = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const tab = searchParams.get("tab") || "overview";

  const handleTabChange = (value: string) => {
    navigate(`/admin?tab=${value}`);
  };

  return (
    <Layout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Admin</h1>
          <p className="text-muted-foreground">Manage your English club</p>
        </div>

        <Tabs value={tab} onValueChange={handleTabChange}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="students">Students</TabsTrigger>
            <TabsTrigger value="classes">Classes</TabsTrigger>
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
            <TabsTrigger value="finance">Finance</TabsTrigger>
            <TabsTrigger value="reports">Reports</TabsTrigger>
            <TabsTrigger value="account">Account Info</TabsTrigger>
            <TabsTrigger value="automation">Automation</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-6">
            <OverviewTab />
          </TabsContent>
          <TabsContent value="students" className="mt-6">
            <StudentsTab />
          </TabsContent>
          <TabsContent value="classes" className="mt-6">
            <ClassesTab />
          </TabsContent>
          <TabsContent value="teachers" className="mt-6">
            <TeachersTab />
          </TabsContent>
          <TabsContent value="finance" className="mt-6">
            <FinanceTab />
          </TabsContent>
          <TabsContent value="reports" className="mt-6">
            <ReportsTab />
          </TabsContent>
          <TabsContent value="account" className="mt-6">
            <AccountInfoTab />
          </TabsContent>
          <TabsContent value="automation" className="mt-6">
            <AutomationTab />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Admin;
