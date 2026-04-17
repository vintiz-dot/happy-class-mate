import { useAuth } from "@/hooks/useAuth";
import { ExamReportsManager } from "@/components/exam-reports/ExamReportsManager";

export default function ExamReportsTab() {
  const { user } = useAuth();
  return (
    <ExamReportsManager
      isAdmin={true}
      currentUserId={user?.id}
      staffClassIds={null}
    />
  );
}
