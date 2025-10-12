export async function acquireLock(supabase: any, job: string, month: string): Promise<boolean> {
  const { data } = await supabase
    .from('job_lock')
    .select('job')
    .eq('job', job)
    .eq('month', month)
    .is('finished_at', null)
    .maybeSingle();
  
  if (data) {
    console.log(`Lock already held for ${job} - ${month}`);
    return false;
  }
  
  const { error } = await supabase.from('job_lock').insert({ job, month });
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
