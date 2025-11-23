import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useStudentProfile } from "@/contexts/StudentProfileContext";
import { dayjs } from "@/lib/date";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, FileText, DollarSign, Clock, Phone, Trophy, BookOpen, Edit, Mail } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { ClassLeaderboard } from "@/components/admin/ClassLeaderboard";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { StudentProfileEdit } from "@/components/student/StudentProfileEdit";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getAvatarUrl } from "@/lib/avatars";

export default function StudentDashboard() {
  const { studentId } = useStudentProfile();
  const navigate = useNavigate();
  const currentMonth = dayjs().format("YYYY-MM");
  const [showEditProfile, setShowEditProfile] = useState(false);

  const { data: studentProfile } = useQuery({
    queryKey: ["student-profile", studentId],
    queryFn: async () => {
      if (!studentId) return null;
      const { data } = await supabase
        .from("students")
        .select(`
          id, 
          full_name, 
          email, 
          phone, 
          date_of_birth,
          avatar_url,
          is_active,
          family:families(name),
          updated_at
        `)
        .eq("id", studentId)
        .single();
      return data;
    },
    enabled: !!studentId,
  });

  const { data: upcomingSessions } = useQuery({
    queryKey: ["student-upcoming-sessions", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          classes!inner(name)
        `)
        .in("class_id", classIds)
        .gte("date", dayjs().format("YYYY-MM-DD"))
        .lte("date", dayjs().add(7, "days").format("YYYY-MM-DD"))
        .in("status", ["Scheduled", "Held"])
        .order("date", { ascending: true })
        .limit(5);

      return data || [];
    },
    enabled: !!studentId,
  });

  const { data: pendingHomework } = useQuery({
    queryKey: ["student-pending-homework", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("class_id")
        .eq("student_id", studentId)
        .is("end_date", null);

      const classIds = enrollments?.map(e => e.class_id) || [];

      const { data: homeworks } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          due_date,
          classes(name)
        `)
        .in("class_id", classIds)
        .order("due_date", { ascending: true });

      // Filter out submitted homework
      const pending = [];
      for (const hw of homeworks || []) {
        const { data: submission } = await supabase
          .from("homework_submissions")
          .select("id, status")
          .eq("homework_id", hw.id)
          .eq("student_id", studentId)
          .maybeSingle();

        if (!submission || submission.status === "pending") {
          pending.push(hw);
        }
      }

      return pending.slice(0, 5);
    },
    enabled: !!studentId,
  });

  const { data: tuitionData } = useQuery({
    queryKey: ["student-tuition-summary", studentId, currentMonth],
    queryFn: async () => {
      if (!studentId) return null;

      // Fetch invoice from database (same as admin)
      const { data: invoice, error } = await supabase
        .from("invoices")
        .select("*")
        .eq("student_id", studentId)
        .eq("month", currentMonth)
        .maybeSingle();

      if (error) throw error;

      return {
        totalAmount: invoice?.total_amount || 0,
        balance: invoice ? invoice.total_amount - invoice.paid_amount : 0,
      };
    },
    enabled: !!studentId,
  });

  const { data: enrolledClasses } = useQuery({
    queryKey: ["student-enrolled-classes", studentId],
    queryFn: async () => {
      if (!studentId) return [];

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select(`
          id,
          class_id,
          classes(id, name)
        `)
        .eq("student_id", studentId)
        .is("end_date", null);

      return enrollments || [];
    },
    enabled: !!studentId,
  });

  if (!studentId || !studentProfile) {
    return (
      <Layout title="Dashboard">
        <p className="text-center text-muted-foreground">Please select a student profile.</p>
      </Layout>
    );
  }

  return (
    <Layout title={`Dashboard - ${studentProfile.full_name}`}>
      {/* Premium animated background orbs - different color scheme from auth */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
        <div className="absolute top-40 left-40 w-96 h-96 bg-secondary/30 rounded-full blur-3xl animate-pulse"></div>
        <div className="absolute bottom-40 right-40 w-[28rem] h-[28rem] bg-muted/40 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1.5s' }}></div>
        <div className="absolute top-1/2 left-1/3 w-80 h-80 bg-accent/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '3s' }}></div>
      </div>

      <div className="space-y-8 relative z-10">
        {/* Premium Profile Header */}
        <div className="glass-lg border-0 shadow-2xl rounded-3xl overflow-hidden animate-fade-in backdrop-blur-xl hover:shadow-3xl transition-all duration-500 hover:scale-[1.01]">
          {/* Premium glossy overlay effect */}
          <div className="absolute inset-0 bg-gradient-to-br from-secondary/20 via-transparent to-muted/10 pointer-events-none"></div>
          
          <div className="p-8 relative">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-6">
                {/* Premium Avatar with glow */}
                <div className="relative">
                  <div className="absolute inset-0 bg-primary/30 rounded-full blur-xl animate-pulse"></div>
                  <Avatar className="h-24 w-24 border-4 border-white/20 shadow-2xl relative ring-2 ring-primary/20">
                    <AvatarImage src={getAvatarUrl(studentProfile.avatar_url) || undefined} alt={studentProfile.full_name} className="object-cover" />
                    <AvatarFallback className="text-3xl font-bold bg-gradient-to-br from-primary to-accent text-white">
                      {studentProfile.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                      {studentProfile.full_name}
                    </h1>
                    <Badge 
                      variant={studentProfile.is_active ? "default" : "secondary"} 
                      className={`${studentProfile.is_active ? "bg-gradient-to-r from-success to-success/80 shadow-lg" : ""} px-3 py-1`}
                    >
                      {studentProfile.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                  
                  <div className="flex flex-col gap-2 text-muted-foreground">
                    {studentProfile.family?.name && (
                      <div className="flex items-center gap-2 glass-sm px-3 py-1.5 rounded-lg w-fit">
                        <span className="font-semibold text-foreground">Family:</span>
                        <span>{studentProfile.family.name}</span>
                      </div>
                    )}
                    {studentProfile.email && (
                      <div className="flex items-center gap-2 text-sm">
                        <Mail className="h-4 w-4 text-primary" />
                        <span>{studentProfile.email}</span>
                      </div>
                    )}
                    {studentProfile.phone && (
                      <div className="flex items-center gap-2 text-sm">
                        <Phone className="h-4 w-4 text-primary" />
                        <span>{studentProfile.phone}</span>
                      </div>
                    )}
                  </div>
                  
                  <p className="text-xs text-muted-foreground">
                    Last updated: {new Date(studentProfile.updated_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
              
              <Button 
                onClick={() => setShowEditProfile(true)} 
                className="glass border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 shadow-lg hover:shadow-xl"
                variant="outline"
              >
                <Edit className="h-4 w-4 mr-2" />
                Edit Profile
              </Button>
            </div>
          </div>
        </div>

        {/* Premium Stats Cards */}
        <div className="grid gap-6 md:grid-cols-3">
          <div className="glass-lg border-0 shadow-xl rounded-2xl p-6 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 relative overflow-hidden group animate-fade-in">
            <div className="absolute inset-0 bg-gradient-to-br from-secondary/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-secondary/30 to-muted/30 group-hover:scale-110 transition-transform duration-300">
                  <Clock className="h-6 w-6 text-secondary-foreground" />
                </div>
                <CardDescription className="text-base font-medium">Upcoming Sessions</CardDescription>
              </div>
              <CardTitle className="text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                {upcomingSessions?.length || 0}
              </CardTitle>
              <p className="text-sm text-muted-foreground">Next 7 days</p>
            </div>
          </div>

          <div className="glass-lg border-0 shadow-xl rounded-2xl p-6 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 relative overflow-hidden group animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-accent/30 to-secondary/30 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-6 w-6 text-accent-foreground" />
                </div>
                <CardDescription className="text-base font-medium">Pending Homework</CardDescription>
              </div>
              <CardTitle className="text-5xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                {pendingHomework?.length || 0}
              </CardTitle>
              <p className="text-sm text-muted-foreground">Assignments to complete</p>
            </div>
          </div>

          <div 
            onClick={() => navigate('/tuition')} 
            className="glass-lg border-0 shadow-xl rounded-2xl p-6 backdrop-blur-xl hover:shadow-2xl transition-all duration-500 hover:scale-105 cursor-pointer relative overflow-hidden group animate-fade-in" style={{ animationDelay: '0.2s' }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-muted/10 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <div className="relative">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-3 rounded-xl bg-gradient-to-br from-muted/30 to-accent/30 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-6 w-6 text-muted-foreground" />
                </div>
                <CardDescription className="text-base font-medium">Current Balance</CardDescription>
              </div>
              <CardTitle className="text-4xl font-bold bg-gradient-to-br from-foreground to-foreground/70 bg-clip-text text-transparent mb-2">
                {tuitionData?.balance?.toLocaleString() || 0} ₫
              </CardTitle>
              <p className="text-sm text-muted-foreground flex items-center gap-2">
                {dayjs().format("MMMM YYYY")} 
                <span className="text-xs glass-sm px-2 py-0.5 rounded-full">Click to view</span>
              </p>
            </div>
          </div>
        </div>

        {/* Premium Content Cards */}
        <div className="grid gap-6 md:grid-cols-2">
          <div className="glass-lg border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="p-6 relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10">
                  <Clock className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-2xl font-bold">Upcoming Sessions</CardTitle>
              </div>
              
              {upcomingSessions && upcomingSessions.length > 0 ? (
                <div className="space-y-3">
                  {upcomingSessions.map((session: any) => (
                    <div key={session.id} className="glass p-4 rounded-xl premium-hover flex justify-between items-center">
                      <div className="space-y-1">
                        <p className="font-semibold text-foreground">{session.classes.name}</p>
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <Calendar className="h-3.5 w-3.5" />
                          {dayjs(session.date).format("MMM D, YYYY")} • {session.start_time.slice(0, 5)}
                        </p>
                      </div>
                      <Badge className="shadow-md">{session.status}</Badge>
                    </div>
                  ))}
                  <Link to="/schedule">
                    <Button className="w-full glass border-primary/20 hover:border-primary hover:bg-primary/10 transition-all duration-300 shadow-lg" variant="outline">
                      View Full Schedule
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="glass-muted rounded-xl p-8 text-center">
                  <Clock className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No upcoming sessions</p>
                </div>
              )}
            </div>
          </div>

          <div className="glass-lg border-0 shadow-xl rounded-2xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
            <div className="p-6 relative">
              <div className="flex items-center gap-3 mb-6">
                <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-2xl font-bold">Pending Homework</CardTitle>
              </div>
              
              {pendingHomework && pendingHomework.length > 0 ? (
                <div className="space-y-3">
                  {pendingHomework.map((hw: any) => (
                    <div key={hw.id} className="glass p-4 rounded-xl premium-hover">
                      <p className="font-semibold text-foreground mb-1">{hw.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {hw.classes.name} • Due: {hw.due_date ? dayjs(hw.due_date).format("MMM D") : "No due date"}
                      </p>
                    </div>
                  ))}
                  <Link to="/student/assignments">
                    <Button className="w-full glass border-accent/20 hover:border-accent hover:bg-accent/10 transition-all duration-300 shadow-lg" variant="outline">
                      View All Assignments
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="glass-muted rounded-xl p-8 text-center">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-muted-foreground/50" />
                  <p className="text-muted-foreground">No pending homework</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Premium Class Leaderboards */}
        {enrolledClasses && enrolledClasses.length > 0 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10">
                <Trophy className="h-8 w-8 text-warning" />
              </div>
              <h2 className="text-3xl font-bold bg-gradient-to-r from-foreground to-foreground/70 bg-clip-text text-transparent">
                Class Rankings
              </h2>
            </div>
            
            <div className="grid gap-6 md:grid-cols-2">
              {enrolledClasses.map((enrollment: any) => {
                const classData = enrollment.classes;
                
                if (!classData?.id) {
                  console.warn('Enrollment missing class data:', enrollment);
                  return null;
                }
                
                return (
                  <div key={enrollment.id} className="glass-lg border-0 shadow-xl rounded-2xl overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                    <div className="relative">
                      <ClassLeaderboard classId={classData.id} showAddPoints={false} />
                    </div>
                  </div>
                );
              }).filter(Boolean)}
            </div>
          </div>
        )}

        {/* Premium Quick Access Cards */}
        <div className="grid gap-6 md:grid-cols-4">
          <Link to="/schedule">
            <div className="glass-lg border-0 shadow-xl rounded-2xl p-6 premium-hover cursor-pointer group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Calendar className="h-6 w-6 text-primary" />
                </div>
                <CardTitle className="text-xl font-bold mb-2">Schedule</CardTitle>
                <CardDescription>View your class schedule</CardDescription>
              </div>
            </div>
          </Link>

          <Link to="/student/assignments">
            <div className="glass-lg border-0 shadow-xl rounded-2xl p-6 premium-hover cursor-pointer group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="p-3 rounded-xl bg-gradient-to-br from-accent/20 to-accent/10 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <FileText className="h-6 w-6 text-accent" />
                </div>
                <CardTitle className="text-xl font-bold mb-2">Assignments</CardTitle>
                <CardDescription>Submit and track homework</CardDescription>
              </div>
            </div>
          </Link>

          <Link to="/student/journal">
            <div className="glass-lg border-0 shadow-xl rounded-2xl p-6 premium-hover cursor-pointer group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="p-3 rounded-xl bg-gradient-to-br from-success/20 to-success/10 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="h-6 w-6 text-success" />
                </div>
                <CardTitle className="text-xl font-bold mb-2">Journal</CardTitle>
                <CardDescription>Write and manage entries</CardDescription>
              </div>
            </div>
          </Link>

          <Link to="/tuition">
            <div className="glass-lg border-0 shadow-xl rounded-2xl p-6 premium-hover cursor-pointer group relative overflow-hidden">
              <div className="absolute inset-0 bg-gradient-to-br from-warning/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
              <div className="relative">
                <div className="p-3 rounded-xl bg-gradient-to-br from-warning/20 to-warning/10 w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <DollarSign className="h-6 w-6 text-warning" />
                </div>
                <CardTitle className="text-xl font-bold mb-2">Tuition</CardTitle>
                <CardDescription>View payment details</CardDescription>
              </div>
            </div>
          </Link>
        </div>
      </div>

      {/* Premium Edit Profile Dialog */}
      <Dialog open={showEditProfile} onOpenChange={setShowEditProfile}>
        <DialogContent className="glass-lg border-0 shadow-2xl max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent pointer-events-none"></div>
          <DialogHeader className="relative">
            <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
              Edit Your Profile
            </DialogTitle>
          </DialogHeader>
          <div className="relative">
            <StudentProfileEdit studentId={studentId} />
          </div>
        </DialogContent>
      </Dialog>
    </Layout>
  );
}
