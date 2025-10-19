import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import Layout from "@/components/Layout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentOverviewTab } from "@/components/student/StudentOverviewTab";
import { StudentTuitionTab } from "@/components/student/StudentTuitionTab";
import { StudentAttendanceTab } from "@/components/student/StudentAttendanceTab";
import { StudentDiscountsTab } from "@/components/admin/discount/StudentDiscountsTab";
import { StudentAccountInfo } from "@/components/student/StudentAccountInfo";
import { ClassLeaderboard } from "@/components/admin/ClassLeaderboard";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Link } from "lucide-react";
import { useState } from "react";
import { StudentLinkDialog } from "@/components/admin/StudentLinkDialog";

const StudentDetail = () => {
  const { id } = useParams<{ id: string }>();
  const [showLinkDialog, setShowLinkDialog] = useState(false);

  const { data: student, isLoading } = useQuery({
    queryKey: ["student-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("students")
        .select(`
          *,
          family:families(id, name),
          enrollments(
            id,
            start_date,
            end_date,
            discount_type,
            discount_value,
            discount_cadence,
            class:classes(id, name, session_rate_vnd, default_teacher:teachers(id, full_name))
          )
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <Layout>
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-96 w-full" />
        </div>
      </Layout>
    );
  }

  if (!student) {
    return (
      <Layout>
        <div className="text-center py-12">
          <h2 className="text-2xl font-bold">Student not found</h2>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">{student.full_name}</h1>
            <p className="text-muted-foreground">
              Family: {student.family?.name || "No family"}
              {student.linked_user_id && ` • Linked to user: ${student.linked_user_id.substring(0, 8)}...`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowLinkDialog(true)}>
            <Link className="h-4 w-4 mr-2" />
            Link User
          </Button>
        </div>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="tuition">Tuition</TabsTrigger>
            <TabsTrigger value="attendance">Attendance</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="account">Account</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            <StudentOverviewTab student={student} />
            
            {/* Class Leaderboards - using Admin's ClassLeaderboard for unified rankings */}
            {student.enrollments && student.enrollments.length > 0 && (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold">Class Rankings</h2>
                {student.enrollments.map((enrollment: any) => {
                  // Safely extract class data - handle both array and object responses
                  const classData = enrollment.class 
                    ? (Array.isArray(enrollment.class) ? enrollment.class[0] : enrollment.class)
                    : null;
                  
                  if (!classData?.id) {
                    console.warn('Enrollment missing class ID:', enrollment);
                    return null;
                  }
                  
                  return (
                    <div key={enrollment.id} className="space-y-2">
                      <h3 className="text-lg font-semibold">{classData.name || 'Class'}</h3>
                      <ClassLeaderboard classId={classData.id} />
                    </div>
                  );
                }).filter(Boolean)}
              </div>
            )}
          </TabsContent>

          <TabsContent value="tuition" className="space-y-6">
            <StudentTuitionTab studentId={student.id} />
          </TabsContent>

          <TabsContent value="attendance" className="space-y-6">
            <StudentAttendanceTab studentId={student.id} />
          </TabsContent>

          <TabsContent value="discounts" className="space-y-6">
            <StudentDiscountsTab studentId={student.id} />
          </TabsContent>

          <TabsContent value="account" className="space-y-6">
            <StudentAccountInfo studentId={student.id} />
          </TabsContent>
        </Tabs>

        <StudentLinkDialog
          open={showLinkDialog}
          onOpenChange={setShowLinkDialog}
          studentId={student.id}
          studentName={student.full_name}
          currentUserId={student.linked_user_id}
        />
      </div>
    </Layout>
  );
};

export default StudentDetail;