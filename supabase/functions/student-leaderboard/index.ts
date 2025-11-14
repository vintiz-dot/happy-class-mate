import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('[student-leaderboard] Request received');

    // Create Supabase client with service role to bypass RLS
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get authenticated user from JWT
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error('[student-leaderboard] Auth error:', authError);
      throw new Error('Unauthorized');
    }

    console.log('[student-leaderboard] Authenticated user:', user.id);

    // Get student record for logged-in user
    const { data: student, error: studentError } = await supabase
      .from('students')
      .select('id, full_name')
      .eq('linked_user_id', user.id)
      .single();

    if (studentError || !student) {
      console.error('[student-leaderboard] Student not found:', studentError);
      throw new Error('No student profile found for this user');
    }

    console.log('[student-leaderboard] Student found:', student.id);

    // Get request body for month parameter
    const body = req.method === 'POST' ? await req.json() : {};
    const month = body.month || new Date().toISOString().slice(0, 7);

    console.log('[student-leaderboard] Fetching leaderboards for month:', month);

    // Get active enrollments for the student
    const { data: enrollments, error: enrollmentError } = await supabase
      .from('enrollments')
      .select(`
        class_id,
        classes(id, name)
      `)
      .eq('student_id', student.id)
      .is('end_date', null);

    if (enrollmentError) {
      console.error('[student-leaderboard] Enrollment error:', enrollmentError);
      throw enrollmentError;
    }

    if (!enrollments || enrollments.length === 0) {
      console.log('[student-leaderboard] No active enrollments found');
      return new Response(
        JSON.stringify({
          success: true,
          current_student_id: student.id,
          current_student_name: student.full_name,
          leaderboards: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('[student-leaderboard] Found enrollments:', enrollments.length);

    // Fetch leaderboard for each enrolled class
    const leaderboards = [];

    for (const enrollment of enrollments) {
      const classInfo = Array.isArray(enrollment.classes) ? enrollment.classes[0] : enrollment.classes;
      if (!classInfo) continue;

      console.log('[student-leaderboard] Fetching leaderboard for class:', enrollment.class_id);

      const { data: points, error: pointsError } = await supabase
        .from('student_points')
        .select(`
          homework_points,
          participation_points,
          total_points,
          updated_at,
          student_id,
          students(full_name, avatar_url)
        `)
        .eq('class_id', enrollment.class_id)
        .eq('month', month)
        .order('total_points', { ascending: false });

      if (pointsError) {
        console.error('[student-leaderboard] Points error:', pointsError);
        continue; // Skip this class if error
      }

      if (!points || points.length === 0) {
        console.log('[student-leaderboard] No points found for class:', enrollment.class_id);
        continue;
      }

      // Calculate dense ranks and format entries
      let rank = 0;
      let previousPoints = -1;

      const entries = points.map((p, idx) => {
        const studentInfo = Array.isArray(p.students) ? p.students[0] : p.students;
        
        // Dense ranking: same points = same rank, next different points = rank + 1
        if (p.total_points !== previousPoints) {
          rank = idx + 1;
          previousPoints = p.total_points;
        }

        return {
          rank,
          student_name: studentInfo?.full_name || 'Unknown',
          avatar_url: studentInfo?.avatar_url || null,
          homework_points: p.homework_points,
          participation_points: p.participation_points,
          total_points: p.total_points,
          is_current_user: p.student_id === student.id,
          updated_at: p.updated_at
          // NOTE: student_id is intentionally NOT included for privacy
        };
      });

      leaderboards.push({
        class_id: enrollment.class_id,
        class_name: classInfo.name,
        month,
        entries
      });

      console.log('[student-leaderboard] Added leaderboard for class:', classInfo.name, 'with', entries.length, 'entries');
    }

    console.log('[student-leaderboard] Returning', leaderboards.length, 'leaderboards');

    return new Response(
      JSON.stringify({
        success: true,
        current_student_id: student.id,
        current_student_name: student.full_name,
        leaderboards
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('[student-leaderboard] Error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return new Response(
      JSON.stringify({
        success: false,
        error: errorMessage
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
