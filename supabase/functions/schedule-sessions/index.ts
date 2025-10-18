import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.75.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface WeeklySlot {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  teacherId?: string;
}

interface ExpectedSession {
  classId: string;
  className: string;
  date: string;
  startTime: string;
  endTime: string;
  teacherId: string | null;
  key: string;
}

interface TeacherReport {
  teacher_id: string | null;
  teacher_name: string;
  scheduled_minutes: number;
  held_minutes: number;
  sessions: Array<{
    id: string;
    class_id: string;
    class_name: string;
    date: string;
    start_time: string;
    end_time: string;
    status: string;
  }>;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { month } = await req.json();
    
    // Get current month in Bangkok timezone if not provided
    const targetMonth = month || (() => {
      const now = new Date();
      const bkk = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
      return `${bkk.getFullYear()}-${String(bkk.getMonth() + 1).padStart(2, '0')}`;
    })();

    console.log(`Starting schedule generation for ${targetMonth}`);

    // Try to acquire job lock
    const lockAcquired = await acquireLock(supabase, 'schedule-sessions', targetMonth);
    if (!lockAcquired) {
      return new Response(JSON.stringify({ 
        success: false, 
        reason: 'Job already running for this month' 
      }), {
        status: 409,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    try {
      // Step 1: Normalize invalid future state
      const normalized = await normalizeFutureHeld(supabase, targetMonth);
      console.log(`Normalized ${normalized.length} future Held sessions to Scheduled`);

      // Step 2: Load active classes
      const { data: classes, error: classError } = await supabase
        .from('classes')
        .select('id, name, default_teacher_id, session_rate_vnd, schedule_template')
        .eq('is_active', true);

      if (classError) throw classError;

      // Step 3: Build expected sessions
      const expected = buildExpectedSessions(classes || [], targetMonth);
      console.log(`Expected ${expected.length} sessions from templates`);

      // Step 4: Load existing sessions
      const monthStart = `${targetMonth}-01`;
      const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0)
        .toISOString().split('T')[0];

      const { data: existingSessions, error: sessionsError } = await supabase
        .from('sessions')
        .select('id, class_id, date, start_time, end_time, teacher_id, status, is_manual')
        .in('class_id', classes?.map(c => c.id) || [])
        .gte('date', monthStart)
        .lte('date', monthEnd);

      if (sessionsError) throw sessionsError;

      // Step 5: Reconcile (create-only, non-destructive)
      const result = await reconcileSessions(
        supabase,
        expected,
        existingSessions || [],
        targetMonth
      );

      // Step 6: Generate per-teacher report
      const report = await generateTeacherReport(supabase, targetMonth);

      await releaseLock(supabase, 'schedule-sessions', targetMonth);

      return new Response(JSON.stringify({
        success: true,
        month: targetMonth,
        normalized: normalized.length,
        created: result.created,
        skippedConflicts: result.skippedConflicts,
        attention: result.attention,
        perTeacher: report,
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });

    } catch (error) {
      await releaseLock(supabase, 'schedule-sessions', targetMonth);
      throw error;
    }

  } catch (error: any) {
    console.error('Schedule generation error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function acquireLock(supabase: any, job: string, month: string): Promise<boolean> {
  const { data: canAcquire } = await supabase.rpc('assert_job_lock', {
    p_job: job,
    p_month: month,
  });
  
  if (!canAcquire) return false;
  
  const { error } = await supabase
    .from('job_lock')
    .upsert({ job, month, started_at: new Date().toISOString(), finished_at: null }, {
      onConflict: 'job,month',
      ignoreDuplicates: false,
    });
  
  return !error;
}

async function releaseLock(supabase: any, job: string, month: string): Promise<void> {
  await supabase
    .from('job_lock')
    .update({ finished_at: new Date().toISOString() })
    .eq('job', job)
    .eq('month', month);
}

async function normalizeFutureHeld(supabase: any, month: string): Promise<string[]> {
  const now = new Date();
  const bkkNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const today = bkkNow.toISOString().split('T')[0];

  const { data: futureHeld } = await supabase
    .from('sessions')
    .select('id')
    .eq('status', 'Held')
    .eq('is_manual', false)
    .gte('date', today)
    .like('date', `${month}%`);

  if (!futureHeld || futureHeld.length === 0) return [];

  const ids = futureHeld.map((s: any) => s.id);
  
  await supabase
    .from('sessions')
    .update({ status: 'Scheduled' })
    .in('id', ids);

  return ids;
}

function buildExpectedSessions(classes: any[], month: string): ExpectedSession[] {
  const expected: ExpectedSession[] = [];
  const [year, monthNum] = month.split('-').map(Number);
  
  // Get all dates in the month
  const firstDay = new Date(year, monthNum - 1, 1);
  const lastDay = new Date(year, monthNum, 0);
  
  for (let d = new Date(firstDay); d <= lastDay; d.setDate(d.getDate() + 1)) {
    // Get the day-of-week in Asia/Bangkok timezone
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Bangkok',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      weekday: 'short'
    }).formatToParts(d);
    
    const year = parts.find(p => p.type === 'year')!.value;
    const month = parts.find(p => p.type === 'month')!.value;
    const day = parts.find(p => p.type === 'day')!.value;
    const weekday = parts.find(p => p.type === 'weekday')!.value;
    
    const dateStr = `${year}-${month}-${day}`;
    const dayOfWeek = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(weekday);
    
    for (const cls of classes) {
      const template = cls.schedule_template || { weeklySlots: [] };
      const slots: WeeklySlot[] = template.weeklySlots || [];
      
      for (const slot of slots) {
        if (slot.dayOfWeek === dayOfWeek) {
          const teacherId = slot.teacherId || cls.default_teacher_id || null;
          const key = `${cls.id}|${dateStr}|${slot.startTime}`;
          
          expected.push({
            classId: cls.id,
            className: cls.name,
            date: dateStr,
            startTime: slot.startTime,
            endTime: slot.endTime,
            teacherId,
            key,
          });
        }
      }
    }
  }
  
  return expected;
}

async function reconcileSessions(
  supabase: any,
  expected: ExpectedSession[],
  existing: any[],
  month: string
) {
  const created: any[] = [];
  const skippedConflicts: any[] = [];
  const attention = {
    noTeacherExpected: [] as ExpectedSession[],
    noTeacherExisting: [] as any[],
  };

  // Build map of existing sessions
  const existingMap = new Map<string, any>();
  for (const session of existing) {
    const key = `${session.class_id}|${session.date}|${session.start_time}`;
    existingMap.set(key, session);
    
    // Track existing sessions without teacher
    if (!session.teacher_id && !session.is_manual) {
      attention.noTeacherExisting.push(session);
    }
  }

  // Create missing sessions
  for (const exp of expected) {
    if (existingMap.has(exp.key)) {
      continue; // Session already exists, don't modify
    }

    // Skip if no teacher
    if (!exp.teacherId) {
      attention.noTeacherExpected.push(exp);
      continue;
    }

    // Check teacher availability
    const hasConflict = await checkTeacherConflict(
      supabase,
      exp.teacherId,
      exp.date,
      exp.startTime,
      exp.endTime
    );

    if (hasConflict) {
      skippedConflicts.push({
        class: exp.className,
        date: exp.date,
        time: `${exp.startTime}-${exp.endTime}`,
        reason: 'Teacher time conflict',
      });
      continue;
    }

    // Create session with ON CONFLICT DO NOTHING for idempotency
    const { data: newSession, error } = await supabase
      .from('sessions')
      .insert({
        class_id: exp.classId,
        date: exp.date,
        start_time: exp.startTime,
        end_time: exp.endTime,
        teacher_id: exp.teacherId,
        status: 'Scheduled',
        is_manual: false,
      })
      .select()
      .single();

    if (!error && newSession) {
      created.push(newSession);
    }
  }

  return { created, skippedConflicts, attention };
}

async function checkTeacherConflict(
  supabase: any,
  teacherId: string,
  date: string,
  startTime: string,
  endTime: string
): Promise<boolean> {
  const { data } = await supabase
    .from('sessions')
    .select('id')
    .eq('teacher_id', teacherId)
    .eq('date', date)
    .neq('status', 'Canceled')
    .or(`start_time.lte.${startTime},end_time.gte.${endTime}`);

  return (data?.length || 0) > 0;
}

async function generateTeacherReport(
  supabase: any,
  month: string
): Promise<TeacherReport[]> {
  const monthStart = `${month}-01`;
  const monthEnd = new Date(new Date(monthStart).getFullYear(), new Date(monthStart).getMonth() + 1, 0)
    .toISOString().split('T')[0];

  // Get all sessions with class and teacher info
  const { data: sessions } = await supabase
    .from('sessions')
    .select(`
      id, date, start_time, end_time, status,
      class_id,
      classes!inner(name),
      teacher_id,
      teachers(full_name)
    `)
    .gte('date', monthStart)
    .lte('date', monthEnd)
    .in('status', ['Scheduled', 'Held']);

  if (!sessions) return [];

  // Group by teacher
  const teacherMap = new Map<string, TeacherReport>();

  for (const session of sessions) {
    const teacherId = session.teacher_id || 'unassigned';
    const teacherName = session.teachers?.full_name || 'Unassigned';

    if (!teacherMap.has(teacherId)) {
      teacherMap.set(teacherId, {
        teacher_id: session.teacher_id,
        teacher_name: teacherName,
        scheduled_minutes: 0,
        held_minutes: 0,
        sessions: [],
      });
    }

    const report = teacherMap.get(teacherId)!;
    
    // Calculate duration in minutes
    const start = new Date(`2000-01-01 ${session.start_time}`);
    const end = new Date(`2000-01-01 ${session.end_time}`);
    const minutes = (end.getTime() - start.getTime()) / (1000 * 60);

    if (session.status === 'Held') {
      report.held_minutes += minutes;
    }
    report.scheduled_minutes += minutes;

    report.sessions.push({
      id: session.id,
      class_id: session.class_id,
      class_name: session.classes.name,
      date: session.date,
      start_time: session.start_time,
      end_time: session.end_time,
      status: session.status,
    });
  }

  return Array.from(teacherMap.values());
}
