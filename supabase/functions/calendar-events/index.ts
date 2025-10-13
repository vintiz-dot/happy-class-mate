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

    let events: any[] = [];

    if (userRole.role === "admin") {
      const { data, error } = await supabase
        .from("sessions")
        .select(`
          id,
          date,
          start_time,
          end_time,
          status,
          notes,
          classes!inner(name)
        `)
        .gte("date", `${month}-01`)
        .lte("date", `${month}-31`)
        .order("date", { ascending: true });

      if (error) throw error;
      events = (data || []).map((s: any) => ({
        id: s.id,
        date: s.date,
        start_time: s.start_time,
        end_time: s.end_time,
        class_name: s.classes.name,
        status: s.status,
        notes: s.notes,
      }));
    } else if (userRole.role === "teacher") {
      const { data: teacher } = await supabase
        .from("teachers")
        .select("id")
        .eq("user_id", user.id)
        .single();

      if (teacher) {
        const { data, error } = await supabase
          .from("sessions")
          .select(`
            id,
            date,
            start_time,
            end_time,
            status,
            notes,
            classes!inner(name)
          `)
          .eq("teacher_id", teacher.id)
          .gte("date", `${month}-01`)
          .lte("date", `${month}-31`)
          .order("date", { ascending: true });

        if (error) throw error;
        events = (data || []).map((s: any) => ({
          id: s.id,
          date: s.date,
          start_time: s.start_time,
          end_time: s.end_time,
          class_name: s.classes.name,
          status: s.status,
          notes: s.notes,
        }));
      }
    } else if (userRole.role === "student") {
      const { data: students } = await supabase
        .from("students")
        .select("id")
        .or(`linked_user_id.eq.${user.id},family_id.in.(select id from families where primary_user_id='${user.id}')`);

      if (students && students.length > 0) {
        const studentIds = students.map((s: any) => s.id);
        
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("class_id")
          .in("student_id", studentIds)
          .is("end_date", null);

        if (enrollments && enrollments.length > 0) {
          const classIds = enrollments.map((e: any) => e.class_id);

          const { data, error } = await supabase
            .from("sessions")
            .select(`
              id,
              date,
              start_time,
              end_time,
              status,
              notes,
              classes!inner(name)
            `)
            .in("class_id", classIds)
            .gte("date", `${month}-01`)
            .lte("date", `${month}-31`)
            .order("date", { ascending: true });

          if (error) throw error;
          events = (data || []).map((s: any) => ({
            id: s.id,
            date: s.date,
            start_time: s.start_time,
            end_time: s.end_time,
            class_name: s.classes.name,
            status: s.status,
            notes: s.notes,
          }));
        }
      }
    }

    return new Response(JSON.stringify({ events }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
