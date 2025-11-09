import Layout from "@/components/Layout";
import { AssignmentUpload } from "@/components/teacher/AssignmentUpload";
import { HomeworkGradingList } from "@/components/teacher/HomeworkGradingList";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Filter } from "lucide-react";
import { AssignmentCalendar } from "@/components/assignments/AssignmentCalendar";

export default function TeacherAssignments() {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  return (
    <Layout title="Assignments">
      <div className="space-y-4 md:space-y-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Assignments</h1>
          <p className="text-sm md:text-base text-muted-foreground">Create and manage homework assignments</p>
        </div>

        <Tabs defaultValue="create" className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-auto">
            <TabsTrigger value="create" className="text-xs sm:text-sm py-3">
              Create
            </TabsTrigger>
            <TabsTrigger value="calendar" className="text-xs sm:text-sm py-3">
              Calendar
            </TabsTrigger>
            <TabsTrigger value="grade" className="text-xs sm:text-sm py-3">
              Grade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="create" className="space-y-4 md:space-y-6 mt-4">
            <AssignmentUpload />
          </TabsContent>

          <TabsContent value="calendar" className="space-y-4 md:space-y-6 mt-4">
            <AssignmentCalendar role="teacher" />
          </TabsContent>

          <TabsContent value="grade" className="space-y-4 md:space-y-6 mt-4">
            {/* Status Filter */}
            <div className="flex flex-col gap-3 p-4 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl border">
              <div className="flex items-center gap-2">
                <Filter className="h-4 w-4" />
                <p className="text-sm font-semibold">Filter by status</p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={statusFilter === "all" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("all")}
                  className="flex-1 sm:flex-none min-h-[44px] rounded-full"
                >
                  All
                </Button>
                <Button
                  variant={statusFilter === "not_submitted" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("not_submitted")}
                  className="flex-1 sm:flex-none min-h-[44px] rounded-full"
                >
                  <div className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-400 mr-2" />
                  Not Submitted
                </Button>
                <Button
                  variant={statusFilter === "submitted" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("submitted")}
                  className="flex-1 sm:flex-none min-h-[44px] rounded-full"
                >
                  <div className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                  Submitted
                </Button>
                <Button
                  variant={statusFilter === "graded" ? "default" : "outline"}
                  size="sm"
                  onClick={() => setStatusFilter("graded")}
                  className="flex-1 sm:flex-none min-h-[44px] rounded-full"
                >
                  <div className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                  Graded
                </Button>
              </div>
            </div>

            <HomeworkGradingList statusFilter={statusFilter} />
          </TabsContent>
        </Tabs>
      </div>
    </Layout>
  );
}
