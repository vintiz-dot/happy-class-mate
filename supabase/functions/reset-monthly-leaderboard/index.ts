import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

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
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get target month from request or default to previous month
    const { targetMonth } = await req.json().catch(() => ({}));
    
    const monthToArchive = targetMonth || (() => {
      const now = new Date();
      now.setMonth(now.getMonth() - 1);
      return now.toISOString().slice(0, 7); // YYYY-MM format
    })();

    console.log(`Starting monthly leaderboard reset for month: ${monthToArchive}`);

    // Call the database function to archive and reset
    const { data, error } = await supabase.rpc('archive_and_reset_monthly_leaderboard', {
      target_month: monthToArchive
    });

    if (error) {
      console.error('Error resetting leaderboard:', error);
      throw error;
    }

    console.log(`Successfully archived ${data?.[0]?.archived_count || 0} records and reset ${data?.[0]?.reset_count || 0} student points`);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Monthly leaderboard reset complete for ${monthToArchive}`,
        archived: data?.[0]?.archived_count || 0,
        reset: data?.[0]?.reset_count || 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );
  } catch (error) {
    console.error('Error in reset-monthly-leaderboard function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});