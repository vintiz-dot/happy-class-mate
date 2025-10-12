export async function projectedByFamily(supabase: any, familyId: string, ym: string) {
  const { data: students } = await supabase
    .from('students')
    .select('id')
    .eq('family_id', familyId)
    .eq('is_active', true);
  
  if (!students || students.length === 0) {
    return [];
  }
  
  const { data } = await supabase
    .from('v_projected_base')
    .select('student_id, ym, projected_sessions, projected_base')
    .eq('ym', ym)
    .in('student_id', students.map((s: any) => s.id));
  
  return data || [];
}
