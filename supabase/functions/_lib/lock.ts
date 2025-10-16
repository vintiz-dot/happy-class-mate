export async function acquireLock(supabase: any, job: string, month: string): Promise<boolean> {
  // Check if lock can be acquired using database function
  const { data: canAcquire, error: assertError } = await supabase.rpc('assert_job_lock', {
    p_job: job,
    p_month: month,
  });
  
  if (assertError) {
    console.error(`Error checking lock for ${job} - ${month}:`, assertError);
    return false;
  }
  
  if (!canAcquire) {
    console.log(`Lock already held for ${job} - ${month}`);
    return false;
  }
  
  // Try to insert lock with upsert to handle race conditions
  const { error } = await supabase
    .from('job_lock')
    .upsert({ job, month, started_at: new Date().toISOString(), finished_at: null }, {
      onConflict: 'job,month',
      ignoreDuplicates: false,
    });
  
  if (error) {
    console.error(`Failed to acquire lock for ${job} - ${month}:`, error);
    return false;
  }
  
  console.log(`Lock acquired for ${job} - ${month}`);
  return true;
}

export async function releaseLock(supabase: any, job: string, month: string): Promise<void> {
  const { error } = await supabase
    .from('job_lock')
    .update({ finished_at: new Date().toISOString() })
    .eq('job', job)
    .eq('month', month);
  
  if (error) {
    console.error(`Failed to release lock for ${job} - ${month}:`, error);
  } else {
    console.log(`Lock released for ${job} - ${month}`);
  }
}

export function ymNowBangkok(): string {
  const now = new Date();
  const tzNow = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' }));
  const y = tzNow.getFullYear();
  const m = String(tzNow.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}
