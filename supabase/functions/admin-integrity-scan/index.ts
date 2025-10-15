import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify admin role
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { data: roles } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id);

    if (!roles?.some(r => r.role === 'admin')) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const issues: any = {
      enrollments_orphaned: [],
      enrollments_duplicates: [],
      sessions_orphaned: [],
      sessions_invalid_status: [],
      attendance_orphaned: [],
      students_bad_link: [],
      sibling_state_bad: [],
      ledger_unbalanced: []
    };

    // Check orphaned enrollments (student or class doesn't exist)
    const { data: orphanedEnrollments } = await supabase
      .from('enrollments')
      .select('id, student_id, class_id')
      .is('students.id', null)
      .is('classes.id', null);
    
    if (orphanedEnrollments) {
      issues.enrollments_orphaned = orphanedEnrollments.map(e => ({
        id: e.id,
        student_id: e.student_id,
        class_id: e.class_id
      }));
    }

    // Check duplicate enrollments
    const { data: allEnrollments } = await supabase
      .from('enrollments')
      .select('student_id, class_id, start_date, end_date');
    
    if (allEnrollments) {
      const seen = new Set();
      for (const e of allEnrollments) {
        const key = `${e.student_id}-${e.class_id}`;
        if (seen.has(key)) {
          issues.enrollments_duplicates.push(e);
        }
        seen.add(key);
      }
    }

    // Check sessions with invalid status
    const today = new Date().toISOString().slice(0, 10);
    const nowTime = new Date().toISOString().slice(11, 16); // HH:MM
    
    const { data: allSessions } = await supabase
      .from('sessions')
      .select('id, date, start_time, end_time, status, class_id, teacher_id');
    
    if (allSessions) {
      for (const s of allSessions) {
        // Future sessions should not be Held
        if (s.date > today && s.status === 'Held') {
          issues.sessions_invalid_status.push({
            id: s.id,
            date: s.date,
            status: s.status,
            reason: 'Future session marked as Held'
          });
        }
        
        // Today's sessions before end time should not be Held
        if (s.date === today) {
          const endMinute = new Date(`${today}T${s.end_time}`).getTime() + 60000; // 1 min after
          const nowMinute = new Date(`${today}T${nowTime}`).getTime();
          if (nowMinute < endMinute && s.status === 'Held') {
            issues.sessions_invalid_status.push({
              id: s.id,
              date: s.date,
              start_time: s.start_time,
              end_time: s.end_time,
              status: s.status,
              reason: 'Today session marked as Held before end time'
            });
          }
        }
      }
    }

    // Check orphaned sessions
    const { data: classIds } = await supabase.from('classes').select('id');
    const { data: teacherIds } = await supabase.from('teachers').select('id');
    
    const validClassIds = new Set(classIds?.map(c => c.id));
    const validTeacherIds = new Set(teacherIds?.map(t => t.id));
    
    if (allSessions) {
      issues.sessions_orphaned = allSessions.filter(s => 
        !validClassIds.has(s.class_id) || !validTeacherIds.has(s.teacher_id)
      ).map(s => ({ id: s.id, class_id: s.class_id, teacher_id: s.teacher_id }));
    }

    // Check orphaned attendance
    const { data: allAttendance } = await supabase
      .from('attendance')
      .select('id, session_id, student_id');
    
    const { data: sessionIds } = await supabase.from('sessions').select('id');
    const { data: studentIds } = await supabase.from('students').select('id');
    
    const validSessionIds = new Set(sessionIds?.map(s => s.id));
    const validStudentIds = new Set(studentIds?.map(s => s.id));
    
    if (allAttendance) {
      issues.attendance_orphaned = allAttendance.filter(a =>
        !validSessionIds.has(a.session_id) || !validStudentIds.has(a.student_id)
      ).map(a => ({ id: a.id, session_id: a.session_id, student_id: a.student_id }));
    }

    // Check students with bad user links
    const { data: students } = await supabase
      .from('students')
      .select('id, linked_user_id')
      .not('linked_user_id', 'is', null);
    
    if (students) {
      for (const s of students) {
        const { data: user } = await supabase.auth.admin.getUserById(s.linked_user_id);
        if (!user) {
          issues.students_bad_link.push({ id: s.id, linked_user_id: s.linked_user_id });
        }
      }
    }

    // Check ledger balance per student
    const { data: accounts } = await supabase
      .from('ledger_accounts')
      .select('id, student_id, code');
    
    if (accounts) {
      const studentAccounts = new Map<string, any[]>();
      for (const acc of accounts) {
        if (!studentAccounts.has(acc.student_id)) {
          studentAccounts.set(acc.student_id, []);
        }
        studentAccounts.get(acc.student_id)!.push(acc);
      }

      for (const [studentId, accs] of studentAccounts) {
        let totalDebit = 0;
        let totalCredit = 0;

        for (const acc of accs) {
          const { data: entries } = await supabase
            .from('ledger_entries')
            .select('debit, credit')
            .eq('account_id', acc.id);
          
          if (entries) {
            totalDebit += entries.reduce((sum, e) => sum + e.debit, 0);
            totalCredit += entries.reduce((sum, e) => sum + e.credit, 0);
          }
        }

        if (totalDebit !== totalCredit) {
          issues.ledger_unbalanced.push({
            student_id: studentId,
            total_debit: totalDebit,
            total_credit: totalCredit,
            diff: totalDebit - totalCredit
          });
        }
      }
    }

    return new Response(JSON.stringify({
      ok: true,
      issues,
      summary: {
        enrollments_orphaned: issues.enrollments_orphaned.length,
        enrollments_duplicates: issues.enrollments_duplicates.length,
        sessions_orphaned: issues.sessions_orphaned.length,
        sessions_invalid_status: issues.sessions_invalid_status.length,
        attendance_orphaned: issues.attendance_orphaned.length,
        students_bad_link: issues.students_bad_link.length,
        sibling_state_bad: issues.sibling_state_bad.length,
        ledger_unbalanced: issues.ledger_unbalanced.length
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: any) {
    console.error('Integrity scan error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
