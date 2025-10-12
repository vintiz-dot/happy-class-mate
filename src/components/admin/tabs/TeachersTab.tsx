import { TeachersList } from "@/components/admin/TeachersList";
import { TeacherForm } from "@/components/admin/TeacherForm";
import { useQueryClient } from "@tanstack/react-query";

const TeachersTab = () => {
  const queryClient = useQueryClient();

  return (
    <div className="space-y-8">
      <TeacherForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["teachers"] })} />
      <TeachersList />
    </div>
  );
};

export default TeachersTab;
