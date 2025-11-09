import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      throw new Error("Missing authorization header");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      throw new Error("Unauthorized");
    }

    const { month } = await req.json();
    if (!month || !/^\d{4}-\d{2}$/.test(month)) {
      throw new Error("Invalid month format");
    }

    const { data: userRole } = await supabase
      .from("users")
      .select("role")
      .eq("id", user.id)
      .single();

    if (!userRole) {
      throw new Error("User role not found");
    }

    let assignments: any[] = [];

    if (userRole.role === "admin") {
      // Admin sees all assignments
      const { data, error } = await supabase
        .from("homeworks")
        .select(`
          id,
          title,
          due_date,
          class_id,
          classes!inner(name, id),
          homework_submissions(
            id,
            status,
            student_id,
            submitted_at,
            graded_at
          )
        `)
        .gte("due_date", `${month}-01`)
        .lte("due_date", `${month}-31`)
        .order("due_date", { ascending: true });

      if (error) throw error;
      assignments = data || [];
    } else if (userRole.role === "teacher") {
      // Teachers see assignments from their classes
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (teacher) {
        const { data: teacherClasses } = await supabase
          .from("sessions")
          .select("class_id")
          .eq("teacher_id", teacher.id);

        const classIds = [...new Set(teacherClasses?.map(s => s.class_id) || [])];

        if (classIds.length > 0) {
          const { data, error } = await supabase
            .from("homeworks")
            .select(`
              id,
              title,
              due_date,
              class_id,
              classes!inner(name, id),
              homework_submissions(
                id,
                status,
                student_id,
                submitted_at,
                graded_at
              )
            `)
            .in("class_id", classIds)
            .gte("due_date", `${month}-01`)
            .lte("due_date", `${month}-31`)
            .order("due_date", { ascending: true });

          if (error) throw error;
          assignments = data || [];
        }
      }
    } else if (userRole.role === "student") {
      // Students see their own assignments
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .or(`linked_user_id.eq.${user.id},family_id.in.(select id from families where primary_user_id='${user.id}')`);

      if (students && students.length > 0) {
        const studentIds = students.map(s => s.id);

        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("class_id")
          .in("student_id", studentIds)
          .is("end_date", null);

        if (enrollments && enrollments.length > 0) {
          const classIds = [...new Set(enrollments.map(e => e.class_id))];

          const { data, error } = await supabase
            .from("homeworks")
            .select(`
              id,
              title,
              due_date,
              class_id,
              classes!inner(name, id),
              homework_submissions!left(
                id,
                status,
                student_id,
                submitted_at,
                graded_at
              )
            `)
            .in("class_id", classIds)
            .gte("due_date", `${month}-01`)
            .lte("due_date", `${month}-31`)
            .order("due_date", { ascending: true });

          if (error) throw error;
          
          // Filter submissions to only show for current student
          assignments = (data || []).map(hw => ({
            ...hw,
            homework_submissions: hw.homework_submissions?.filter((sub: any) => 
              studentIds.includes(sub.student_id)
            ) || []
          }));
        }
      }
    }

    return new Response(JSON.stringify({ assignments }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
