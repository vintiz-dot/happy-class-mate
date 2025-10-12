import { useQueryClient } from "@tanstack/react-query";
import Layout from "@/components/Layout";
import { useAuth } from "@/hooks/useAuth";
import { SessionGenerator } from "@/components/admin/SessionGenerator";
import { ScheduleCalendar } from "@/components/schedule/ScheduleCalendar";

const Schedule = () => {
  const queryClient = useQueryClient();
  const { role } = useAuth();

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground">View and manage class schedules</p>
        </div>

        {role === "admin" && (
          <SessionGenerator onSuccess={() => queryClient.invalidateQueries({ queryKey: ["sessions"] })} />
        )}

        <ScheduleCalendar role={role} />
      </div>
    </Layout>
  );
};

export default Schedule;
