import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { ClassForm } from "@/components/admin/ClassForm";
import { ClassesList } from "@/components/admin/ClassesList";
import { EnrollmentManager } from "@/components/admin/EnrollmentManager";

const Classes = () => {
  const queryClient = useQueryClient();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Classes</h1>
          <p className="text-muted-foreground">Manage classes and student enrollments</p>
        </div>

        <ClassForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["classes"] })} />
        <ClassesList />
        
        <div className="pt-8">
          <h2 className="text-2xl font-bold mb-4">Enrollment Management</h2>
          <EnrollmentManager />
        </div>
      </div>
    </Layout>
  );
};

export default Classes;
