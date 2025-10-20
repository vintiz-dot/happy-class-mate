import Layout from "@/components/Layout";
import { TeacherJournalView } from "@/components/teacher/TeacherJournalView";

export default function TeacherJournal() {
  return (
    <Layout title="Student Journals">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Journals</h1>
          <p className="text-muted-foreground">View and manage student journal entries</p>
        </div>
        <TeacherJournalView />
      </div>
    </Layout>
  );
}
