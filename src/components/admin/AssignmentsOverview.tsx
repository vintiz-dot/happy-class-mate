import { useAssignmentAnalytics } from "@/hooks/useAssignmentAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BookOpen, School, GraduationCap, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { AssignmentGlobalView } from "./assignments/AssignmentGlobalView";
import { AssignmentByClassView } from "./assignments/AssignmentByClassView";
import { AssignmentByTeacherView } from "./assignments/AssignmentByTeacherView";
import { AssignmentByStudentView } from "./assignments/AssignmentByStudentView";

export function AssignmentsOverview() {
  const { data, isLoading } = useAssignmentAnalytics();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <BookOpen className="h-6 w-6" /> Assignments Overview
          </h2>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-[400px] rounded-xl" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <BookOpen className="h-6 w-6" /> Assignments Overview
        </h2>
        <p className="text-muted-foreground">Comprehensive assignment analytics across all classes</p>
      </div>

      <Tabs defaultValue="global" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="global" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Global
          </TabsTrigger>
          <TabsTrigger value="class" className="gap-1.5">
            <School className="h-4 w-4" /> By Class
          </TabsTrigger>
          <TabsTrigger value="teacher" className="gap-1.5">
            <GraduationCap className="h-4 w-4" /> By Teacher
          </TabsTrigger>
          <TabsTrigger value="student" className="gap-1.5">
            <Users className="h-4 w-4" /> By Student
          </TabsTrigger>
        </TabsList>

        <TabsContent value="global" className="mt-4">
          <AssignmentGlobalView
            global={data.global}
            assignments={data.assignments}
            gradeDistribution={data.gradeDistribution}
            byClass={data.byClass}
          />
        </TabsContent>

        <TabsContent value="class" className="mt-4">
          <AssignmentByClassView byClass={data.byClass} enrolledPerClass={data.enrolledPerClass} />
        </TabsContent>

        <TabsContent value="teacher" className="mt-4">
          <AssignmentByTeacherView byTeacher={data.byTeacher} />
        </TabsContent>

        <TabsContent value="student" className="mt-4">
          <AssignmentByStudentView byStudent={data.byStudent} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
