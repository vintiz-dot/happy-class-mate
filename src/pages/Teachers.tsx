import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { TeacherForm } from "@/components/admin/TeacherForm";
import { TeachersList } from "@/components/admin/TeachersList";
import { TeachingAssistantForm } from "@/components/admin/TeachingAssistantForm";
import { TeachingAssistantsList } from "@/components/admin/TeachingAssistantsList";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";
import { ManualPointAdjustment } from "@/components/admin/ManualPointAdjustment";
import { LeaderboardResetControl } from "@/components/admin/LeaderboardResetControl";
import { TeacherScheduleTransfer } from "@/components/admin/TeacherScheduleTransfer";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const Teachers = () => {
  const queryClient = useQueryClient();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers & Admins</h1>
          <p className="text-muted-foreground">Manage teaching staff, assistants, admin users, and leaderboard</p>
        </div>

        <Tabs defaultValue="teachers" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="teachers">Teachers</TabsTrigger>
            <TabsTrigger value="assistants">Teaching Assistants</TabsTrigger>
            <TabsTrigger value="transfer">Schedule Transfer</TabsTrigger>
            <TabsTrigger value="admins">Admins</TabsTrigger>
            <TabsTrigger value="points">Points</TabsTrigger>
            <TabsTrigger value="leaderboard">Leaderboard</TabsTrigger>
          </TabsList>

          <TabsContent value="teachers" className="space-y-6">
            <TeacherForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["teachers"] })} />
            <TeachersList />
          </TabsContent>

          <TabsContent value="assistants" className="space-y-6">
            <TeachingAssistantForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["teaching-assistants"] })} />
            <TeachingAssistantsList />
          </TabsContent>

          <TabsContent value="transfer">
            <TeacherScheduleTransfer />
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
