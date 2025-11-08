import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { TeacherForm } from "@/components/admin/TeacherForm";
import { TeachersList } from "@/components/admin/TeachersList";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { ManualPointAdjustment } from "@/components/admin/ManualPointAdjustment";
import { LeaderboardResetControl } from "@/components/admin/LeaderboardResetControl";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Teachers = () => {
  const queryClient = useQueryClient();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers & Admins</h1>
          <p className="text-muted-foreground">Manage teaching staff, admin users, and leaderboard</p>
        </div>

        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="points">Point Management</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard Reset</TabsTrigger>
          </TabsList>

          <TabsContent value="teachers" className="space-y-6">
            <TeacherForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["teachers"] })} />
            <TeachersList />
          </TabsContent>

          <TabsContent value="admins">
            <AdminUsersManager />
          </TabsContent>

          <TabsContent value="points">
            <ManualPointAdjustment />
          </TabsContent>

          <TabsContent value="leaderboard">
            <LeaderboardResetControl />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
};

export default Teachers;
