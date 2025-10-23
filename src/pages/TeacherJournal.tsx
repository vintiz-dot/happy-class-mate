import Layout from "@/components/Layout";
import { TeacherJournalViewEnhanced } from "@/components/teacher/TeacherJournalViewEnhanced";

export default function TeacherJournal() {
  return (
    <Layout title="Student Journals">
      <div className="space-y-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Student Journals</h1>
          <p className="text-muted-foreground">View and manage student journal entries</p>
        </div>
        <TeacherJournalViewEnhanced />
      </div>
    </Layout>
  );
}
