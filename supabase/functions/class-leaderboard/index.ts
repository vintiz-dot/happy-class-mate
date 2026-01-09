import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Get the authorization header to validate the user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create client with user's token to get their identity
    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Parse request body
    const { classId, month } = await req.json();
    if (!classId || !month) {
      return new Response(JSON.stringify({ error: "classId and month are required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create admin client to bypass RLS
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);

    let isAuthorized = false;
    let currentStudentId: string | null = null;

    // Check if user is a teacher for this class
    const { data: teacher } = await adminClient
      .from("teachers")
      .select("id")
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single();

    if (teacher) {
      // Check if teacher is assigned to this class
      const { data: classData } = await adminClient
        .from("classes")
        .select("id")
        .eq("id", classId)
        .eq("default_teacher_id", teacher.id)
        .single();

      if (classData) {
        isAuthorized = true;
      }

      // Also check if teacher has any sessions for this class
      if (!isAuthorized) {
        const { data: teacherSession } = await adminClient
          .from("sessions")
          .select("id")
          .eq("class_id", classId)
          .eq("teacher_id", teacher.id)
          .limit(1);

        if (teacherSession && teacherSession.length > 0) {
          isAuthorized = true;
        }
      }
    }

    // Check if user is a student enrolled in this class
    if (!isAuthorized) {
      const { data: userStudent } = await adminClient
        .from("students")
        .select("id, family_id")
        .eq("linked_user_id", user.id)
        .single();

      if (userStudent) {
        currentStudentId = userStudent.id;
        // Check if this student has ANY enrollment in the class (active or with future end_date)
        const { data: enrollment } = await adminClient
          .from("enrollments")
          .select("id, end_date")
          .eq("student_id", userStudent.id)
          .eq("class_id", classId)
          .limit(1);

        if (enrollment && enrollment.length > 0) {
          // Allow if no end_date or end_date is in the future
          const enr = enrollment[0];
          if (!enr.end_date || new Date(enr.end_date) >= new Date()) {
            isAuthorized = true;
          }
        }
      }
    }

    // Also check if user is a family primary user
    if (!isAuthorized) {
      const { data: family } = await adminClient
        .from("families")
        .select("id")
        .eq("primary_user_id", user.id)
        .single();

      if (family) {
        // Check if any family member is enrolled in this class
        const { data: familyEnrollment } = await adminClient
          .from("enrollments")
          .select("id, student_id, end_date, students!inner(family_id)")
          .eq("class_id", classId)
          .eq("students.family_id", family.id)
          .limit(1);

        if (familyEnrollment && familyEnrollment.length > 0) {
          const enr = familyEnrollment[0];
          if (!enr.end_date || new Date(enr.end_date) >= new Date()) {
            isAuthorized = true;
            currentStudentId = enr.student_id;
          }
        }
      }
    }

    if (!isAuthorized) {
      return new Response(JSON.stringify({ error: "Not enrolled in this class" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch all active enrollments for this class
    const { data: enrollments, error: enrollError } = await adminClient
      .from("enrollments")
      .select(`
        id,
        student_id,
        students (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq("class_id", classId)
      .is("end_date", null);

    if (enrollError) {
      console.error("Error fetching enrollments:", enrollError);
      return new Response(JSON.stringify({ error: "Failed to fetch enrollments" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch points for all students in this class for the given month
    const studentIds = enrollments?.map((e) => e.student_id) || [];

    const { data: points, error: pointsError } = await adminClient
      .from("student_points")
      .select("student_id, participation_points, homework_points, total_points")
      .eq("class_id", classId)
      .eq("month", month)
      .in("student_id", studentIds);

    if (pointsError) {
      console.error("Error fetching points:", pointsError);
    }

    // Create points map
    const pointsMap = new Map(
      (points || []).map((p) => [p.student_id, p])
    );

    // Combine data and calculate rankings
    const leaderboard = (enrollments || [])
      .map((enrollment) => {
        const studentPoints = pointsMap.get(enrollment.student_id);
        const student = enrollment.students as unknown as { id: string; full_name: string; avatar_url: string | null } | null;
        
        return {
          student_id: enrollment.student_id,
          student_name: student?.full_name || "Unknown",
          avatar_url: student?.avatar_url || null,
          participation_points: studentPoints?.participation_points || 0,
          homework_points: studentPoints?.homework_points || 0,
          total_points: studentPoints?.total_points || 0,
          is_current_user: enrollment.student_id === currentStudentId,
        };
      })
      .sort((a, b) => {
        if (b.total_points !== a.total_points) {
          return b.total_points - a.total_points;
        }
        return a.student_name.localeCompare(b.student_name);
      })
      .map((entry, index) => ({
        ...entry,
        rank: index + 1,
      }));

    return new Response(JSON.stringify({ leaderboard, currentStudentId }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in class-leaderboard function:", error);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
