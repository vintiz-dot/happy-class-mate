import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { targetMonth, scope, classId, studentId } = await req.json();

    console.log("Reset points request:", { targetMonth, scope, classId, studentId });

    // Validate input
    if (!targetMonth || !/^\d{4}-\d{2}$/.test(targetMonth)) {
      throw new Error("Invalid month format. Use YYYY-MM");
    }

    if (!scope || !["all", "class", "student"].includes(scope)) {
      throw new Error("Invalid scope. Must be 'all', 'class', or 'student'");
    }

    if (scope === "class" && !classId) {
      throw new Error("classId is required when scope is 'class'");
    }

    if (scope === "student" && !studentId) {
      throw new Error("studentId is required when scope is 'student'");
    }

    // Build delete query for point_transactions
    let deleteTransactionsQuery = supabase
      .from("point_transactions")
      .delete()
      .eq("month", targetMonth);

    if (scope === "class") {
      deleteTransactionsQuery = deleteTransactionsQuery.eq("class_id", classId);
    } else if (scope === "student") {
      deleteTransactionsQuery = deleteTransactionsQuery.eq("student_id", studentId);
    }

    const { error: deleteError, count: deletedCount } = await deleteTransactionsQuery;

    if (deleteError) {
      console.error("Error deleting transactions:", deleteError);
      throw deleteError;
    }

    // Build reset query for student_points
    let resetPointsQuery = supabase
      .from("student_points")
      .update({
        homework_points: 0,
        participation_points: 0,
        total_points: 0,
      })
      .eq("month", targetMonth);

    if (scope === "class") {
      resetPointsQuery = resetPointsQuery.eq("class_id", classId);
    } else if (scope === "student") {
      resetPointsQuery = resetPointsQuery.eq("student_id", studentId);
    }

    const { error: resetError, count: resetCount } = await resetPointsQuery;

    if (resetError) {
      console.error("Error resetting points:", resetError);
      throw resetError;
    }

    console.log(`Reset complete: deleted ${deletedCount} transactions, reset ${resetCount} student_points records`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount || 0,
        reset: resetCount || 0,
        message: `Successfully reset points for ${targetMonth}`,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error in reset-points function:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
