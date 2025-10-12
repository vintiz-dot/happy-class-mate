import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { StudentForm } from "@/components/admin/StudentForm";
import { StudentsList } from "@/components/admin/StudentsList";

const Students = () => {
  const queryClient = useQueryClient();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Students</h1>
          <p className="text-muted-foreground">Manage student records and enrollments</p>
        </div>

        <StudentForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["students-list"] })} />
        <StudentsList />
      </div>
    </Layout>
  );
};

export default Students;
