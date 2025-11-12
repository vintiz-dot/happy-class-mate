import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calculator, Loader2 } from "lucide-react";

export function SiblingDiscountCompute() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Generate list of months (current + next 2)
  const months = Array.from({ length: 3 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    return format(date, "yyyy-MM");
  });

  const handleCompute = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase.functions.invoke("compute-sibling-discounts", {
        body: { month: selectedMonth },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: `Processed ${data.processed} families for ${selectedMonth}. ${
          data.results?.filter((r: any) => r.status === 'assigned').length || 0
        } assigned${data.results?.some((r: any) => r.winner_class_name) ? ' (with class selection)' : ''}, ${
          data.results?.filter((r: any) => r.status === 'pending').length || 0
        } pending.`,
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Calculator className="h-5 w-5" />
          Compute Sibling Discounts
        </CardTitle>
        <CardDescription>
          Run on day-1 of each month to assign sibling discounts. Only families with ≥2 students having positive projected tuition will receive the discount.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-end gap-4">
          <div className="flex-1 space-y-2">
            <label className="text-sm font-medium">Month</label>
            <Select value={selectedMonth} onValueChange={setSelectedMonth}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {months.map((month) => (
                  <SelectItem key={month} value={month}>
                    {format(new Date(month + "-01"), "MMMM yyyy")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <Button 
            onClick={handleCompute} 
            disabled={loading}
            className="gap-2"
          >
            {loading && <Loader2 className="h-4 w-4 animate-spin" />}
            Compute Discounts
          </Button>
        </div>

        <div className="text-sm text-muted-foreground space-y-1">
          <p><strong>Logic:</strong></p>
          <ul className="list-disc list-inside space-y-1 ml-2">
            <li>Threshold: ≥2 students with projected tuition &gt; 0</li>
            <li><strong>Multi-class students:</strong> System selects their highest-tuition class</li>
            <li>Winner: Student with lowest highest-class tuition (tie → deterministic hash)</li>
            <li>Discount: Family override or default 5% <strong>applied to winner's selected class only</strong></li>
            <li>If threshold met later in month, discount applies retroactively from month start</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}