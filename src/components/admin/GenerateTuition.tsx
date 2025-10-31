import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MonthPicker } from "@/components/MonthPicker";
import { dayjs } from "@/lib/date";
import { toast } from "sonner";
import { Calculator, Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

export function GenerateTuition() {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));
  const [results, setResults] = useState<any>(null);
  const queryClient = useQueryClient();

  const generateMutation = useMutation({
    mutationFn: async (month: string) => {
      const monthStart = `${month}-01`;
      const monthEnd = `${month}-31`;

      // Get all active students with enrollments for the month
      const { data: enrollments, error: enrollError } = await supabase
        .from("enrollments")
        .select(`
          student_id,
          students(id, full_name, is_active)
        `)
        .lte("start_date", monthEnd)
        .or(`end_date.is.null,end_date.gte.${monthStart}`);

      if (enrollError) throw enrollError;

      const activeStudentIds = Array.from(
        new Set(
          enrollments
            ?.filter((e: any) => e.students?.is_active)
            .map((e: any) => e.student_id) || []
        )
      );

      if (activeStudentIds.length === 0) {
        return { success: true, processed: 0, errors: [] };
      }

      // Generate tuition for each student
      const results = {
        processed: 0,
        errors: [] as string[],
      };

      for (const studentId of activeStudentIds) {
        try {
          const { error } = await supabase.functions.invoke("calculate-tuition", {
            body: { student_id: studentId, month },
          });

          if (error) {
            results.errors.push(`Student ${studentId}: ${error.message}`);
          } else {
            results.processed++;
          }
        } catch (err: any) {
          results.errors.push(`Student ${studentId}: ${err.message}`);
        }
      }

      return results;
    },
    onSuccess: (data) => {
      setResults(data);
      queryClient.invalidateQueries({ queryKey: ["admin-tuition-list"] });
      
      if (data.errors.length === 0) {
        toast.success(`Successfully generated tuition for ${data.processed} students`);
      } else {
        toast.warning(
          `Generated tuition for ${data.processed} students with ${data.errors.length} errors`
        );
      }
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to generate tuition");
    },
  });

  const handleGenerate = () => {
    if (!selectedMonth) {
      toast.error("Please select a month");
      return;
    }
    setResults(null);
    generateMutation.mutate(selectedMonth);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Generate Tuition
        </CardTitle>
        <CardDescription>
          Calculate and generate tuition invoices for all active students in a specific month
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1">
            <label className="text-sm font-medium mb-2 block">Select Month</label>
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>
          <Button 
            onClick={handleGenerate} 
            disabled={generateMutation.isPending}
            className="min-w-[140px]"
          >
            {generateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Generating...
              </>
            ) : (
              <>
                <Calculator className="h-4 w-4 mr-2" />
                Generate
              </>
            )}
          </Button>
        </div>

        {results && (
          <Alert>
            <AlertDescription>
              <div className="space-y-2">
                <p className="font-medium">
                  Successfully processed: {results.processed} students
                </p>
                {results.errors.length > 0 && (
                  <div>
                    <p className="font-medium text-destructive">
                      Errors ({results.errors.length}):
                    </p>
                    <ul className="list-disc list-inside text-sm text-muted-foreground mt-1">
                      {results.errors.slice(0, 5).map((err: string, i: number) => (
                        <li key={i}>{err}</li>
                      ))}
                      {results.errors.length > 5 && (
                        <li>... and {results.errors.length - 5} more errors</li>
                      )}
                    </ul>
                  </div>
                )}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
}
