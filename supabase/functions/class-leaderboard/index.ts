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

    // First, verify the user is enrolled in this class (or is a family member of someone enrolled)
    const { data: userStudent } = await adminClient
      .from("students")
      .select("id, family_id")
      .eq("linked_user_id", user.id)
      .single();

    let isAuthorized = false;
    let currentStudentId: string | null = null;

    if (userStudent) {
      currentStudentId = userStudent.id;
      // Check if this student is enrolled in the class
      const { data: enrollment } = await adminClient
        .from("enrollments")
        .select("id")
        .eq("student_id", userStudent.id)
        .eq("class_id", classId)
        .is("end_date", null)
        .single();

      if (enrollment) {
        isAuthorized = true;
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
          .select("id, student_id, students!inner(family_id)")
          .eq("class_id", classId)
          .eq("students.family_id", family.id)
          .is("end_date", null)
          .limit(1);

        if (familyEnrollment && familyEnrollment.length > 0) {
          isAuthorized = true;
          // Set current student to the first family member in this class
          currentStudentId = familyEnrollment[0].student_id;
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
