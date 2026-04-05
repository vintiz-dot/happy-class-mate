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

    // Check if the target class has economy_mode enabled
    if (scope === "class" && classId) {
      const { data: cls } = await supabase
        .from("classes")
        .select("economy_mode")
        .eq("id", classId)
        .single();
      if (cls?.economy_mode) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Cannot reset points for a class with Economy Mode enabled. Points accumulate indefinitely in economy mode.",
          }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // For "all" scope, exclude economy-mode classes
    let economyClassIds: string[] = [];
    if (scope === "all") {
      const { data: economyClasses } = await supabase
        .from("classes")
        .select("id")
        .eq("economy_mode", true);
      economyClassIds = (economyClasses || []).map((c: any) => c.id);
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

    // Exclude economy classes for "all" scope
    if (scope === "all" && economyClassIds.length > 0) {
      // We need to use not.in filter
      for (const ecId of economyClassIds) {
        deleteTransactionsQuery = deleteTransactionsQuery.neq("class_id", ecId);
      }
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
      })
      .eq("month", targetMonth);

    if (scope === "class") {
      resetPointsQuery = resetPointsQuery.eq("class_id", classId);
    } else if (scope === "student") {
      resetPointsQuery = resetPointsQuery.eq("student_id", studentId);
    }

    if (scope === "all" && economyClassIds.length > 0) {
      for (const ecId of economyClassIds) {
        resetPointsQuery = resetPointsQuery.neq("class_id", ecId);
      }
    }

    const { error: resetError, count: resetCount } = await resetPointsQuery;

    if (resetError) {
      console.error("Error resetting points:", resetError);
      throw resetError;
    }

    console.log(`Reset complete: deleted ${deletedCount} transactions, reset ${resetCount} student_points records (skipped ${economyClassIds.length} economy classes)`);

    return new Response(
      JSON.stringify({
        success: true,
        deleted: deletedCount || 0,
        reset: resetCount || 0,
        economySkipped: economyClassIds.length,
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
        error: error instanceof Error ? error.message : "Unknown error occurred",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
