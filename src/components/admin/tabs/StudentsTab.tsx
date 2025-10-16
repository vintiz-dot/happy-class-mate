import { StudentsList } from "@/components/admin/StudentsList";
import { StudentForm } from "@/components/admin/StudentForm";
import { FamilyForm } from "@/components/admin/FamilyForm";
import { useQueryClient } from "@tanstack/react-query";

const StudentsTab = () => {
  const queryClient = useQueryClient();

  return (
    <div className="space-y-8">
      <FamilyForm onSuccess={() => {
        queryClient.invalidateQueries({ queryKey: ["families"] });
        queryClient.invalidateQueries({ queryKey: ["students"] });
      }} />
      <StudentForm onSuccess={() => queryClient.invalidateQueries({ queryKey: ["students"] })} />
      <StudentsList />
    </div>
  );
};

export default StudentsTab;
