import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { TeacherForm } from "@/components/admin/TeacherForm";
import { TeachersList } from "@/components/admin/TeachersList";
import { AdminUsersManager } from "@/components/admin/AdminUsersManager";

const Teachers = () => {
  const queryClient = useQueryClient();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Teachers & Admins</h1>
          <p className="text-muted-foreground">Manage teaching staff and admin users</p>
        </div>

        <TeacherForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["teachers"] })} />
        <TeachersList />
        
        <div className="pt-8">
          <h2 className="text-2xl font-bold mb-4">Admin Users</h2>
          <AdminUsersManager />
        </div>
      </div>
    </Layout>
  );
};

export default Teachers;
