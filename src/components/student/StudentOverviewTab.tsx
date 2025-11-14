import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { format } from "date-fns";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { StudentEditDrawer } from "@/components/admin/StudentEditDrawer";
import { ProfilePictureUpload } from "./ProfilePictureUpload";
import { PointsBreakdownChart } from "./PointsBreakdownChart";
import { Users, Trophy, Medal, Award } from "lucide-react";

export function StudentOverviewTab({ student }: { student: any }) {
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [selectedMonth, setSelectedMonth] = useState(new Date().toISOString().slice(0, 7));

  // Fetch family and siblings
  const { data: familyData } = useQuery({
    queryKey: ["student-family", student.id],
    queryFn: async () => {
      if (!student.family_id) return null;
      
      const { data, error } = await supabase
        .from("families")
        .select(`
          id,
          name,
          students(id, full_name)
        `)
        .eq("id", student.family_id)
        .single();

      if (error) throw error;
      return data;
    },
    enabled: !!student.family_id,
  });

  // Fetch leaderboards from edge function
  const { data: leaderboardData, isLoading: leaderboardLoading } = useQuery({
    queryKey: ["student-leaderboard", selectedMonth],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const { data, error } = await supabase.functions.invoke('student-leaderboard', {
        body: { month: selectedMonth }
      });

      if (error) throw error;
      return data;
    },
  });

  const getRankIcon = (rank: number) => {
    if (rank === 1) return <Trophy className="h-5 w-5 text-yellow-500" />;
    if (rank === 2) return <Medal className="h-5 w-5 text-gray-400" />;
    if (rank === 3) return <Award className="h-5 w-5 text-amber-600" />;
    return null;
  };

  return (
    <>
      {/* Overall Points Summary - All Classes Combined */}
      {leaderboardData?.leaderboards && leaderboardData.leaderboards.length > 1 && (
        <div className="space-y-2">
          <h2 className="text-xl font-semibold">Overall Performance (All Classes)</h2>
          <PointsBreakdownChart studentId={student.id} />
        </div>
      )}

      {/* Per-Class Points and Leaderboards */}
      {leaderboardLoading ? (
        <div className="text-center py-8 text-muted-foreground">Loading leaderboards...</div>
      ) : leaderboardData?.leaderboards && leaderboardData.leaderboards.length > 0 ? (
        <div className="space-y-8">
          <h2 className="text-2xl font-bold">My Classes</h2>
          {leaderboardData.leaderboards.map((classData: any) => (
            <div key={classData.class_id} className="space-y-4">
              <div className="border-l-4 border-primary pl-4">
                <h3 className="text-xl font-semibold">{classData.class_name}</h3>
                <p className="text-sm text-muted-foreground">Class Performance</p>
              </div>
              
              {/* Points breakdown for this specific class */}
              <PointsBreakdownChart studentId={student.id} classId={classData.class_id} />
              
              {/* Leaderboard for this class */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Class Leaderboard</span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {format(new Date(classData.month + '-01'), 'MMMM yyyy')}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {classData.entries.map((entry: any, idx: number) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-4 p-3 rounded-lg transition-colors ${
                          entry.is_current_user
                            ? 'bg-primary/10 border border-primary shadow-lg ring-2 ring-primary/20'
                            : 'hover:bg-muted/50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-[60px]">
                          {getRankIcon(entry.rank)}
                          <span className="font-semibold text-lg">{entry.rank}</span>
                        </div>
                        
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={entry.avatar_url} alt={entry.student_name} />
                          <AvatarFallback>
                            {entry.student_name.split(' ').map((n: string) => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        
                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">
                            {entry.student_name}
                            {entry.is_current_user && (
                              <span className="ml-2 text-xs text-primary font-normal">(You)</span>
                            )}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            HW: {entry.homework_points} | Participation: {entry.participation_points}
                          </p>
                        </div>
                        
                        <div className="text-right">
                          <p className="font-bold text-lg">{entry.total_points}</p>
                          <p className="text-xs text-muted-foreground">points</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No active class enrollments found.
          </CardContent>
        </Card>
      )}

      {/* Family & Siblings Card */}
      {familyData && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Family Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Family</p>
              <p className="font-medium">{familyData.name}</p>
            </div>
            
            {familyData.students && familyData.students.length > 1 && (
              <div>
                <p className="text-sm text-muted-foreground mb-2">Siblings</p>
                <div className="flex flex-wrap gap-2">
                  {familyData.students
                    .filter((s: any) => s.id !== student.id)
                    .map((sibling: any) => (
                      <Badge key={sibling.id} variant="outline">
                        {sibling.full_name}
                      </Badge>
                    ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Profile</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
            Edit
          </Button>
        </CardHeader>
        <CardContent className="space-y-6">
          <ProfilePictureUpload 
            studentId={student.id}
            currentAvatarUrl={student.avatar_url}
            studentName={student.full_name}
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{student.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-medium">{student.email || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-medium">{student.phone || "—"}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Date of Birth</p>
              <p className="font-medium">
                {student.date_of_birth ? format(new Date(student.date_of_birth), "MMM d, yyyy") : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Status</p>
              <Badge variant={student.is_active ? "default" : "secondary"}>
                {student.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
          </div>
          {student.notes && (
            <div>
              <p className="text-sm text-muted-foreground">Notes</p>
              <p className="text-sm">{student.notes}</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Enrollments</CardTitle>
        </CardHeader>
        <CardContent>
          {student.enrollments && student.enrollments.length > 0 ? (
            <div className="space-y-3">
              {student.enrollments.map((enrollment: any) => (
                <div key={enrollment.id} className="flex items-center justify-between border-b pb-3 last:border-0">
                  <div>
                    <p className="font-medium">{enrollment.class?.name}</p>
                    <p className="text-sm text-muted-foreground">
                      Teacher: {enrollment.class?.default_teacher?.full_name || "—"}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(enrollment.start_date), "MMM d, yyyy")} 
                      {enrollment.end_date && ` - ${format(new Date(enrollment.end_date), "MMM d, yyyy")}`}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">
                      {enrollment.class?.session_rate_vnd?.toLocaleString("vi-VN")} ₫
                    </p>
                    {enrollment.discount_type && (
                      <Badge variant="secondary" className="text-xs">
                        {enrollment.discount_type === "percent" ? `${enrollment.discount_value}%` : `${enrollment.discount_value?.toLocaleString("vi-VN")} ₫`} 
                        {" "}off - {enrollment.discount_cadence}
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No active enrollments</p>
          )}
        </CardContent>
      </Card>

      <StudentEditDrawer
        student={student}
        open={isEditOpen}
        onOpenChange={setIsEditOpen}
      />
    </>
  );
}