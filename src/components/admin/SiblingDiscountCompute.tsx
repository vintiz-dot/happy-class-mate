import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { Calculator, Loader2, Eye, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { formatVND } from "@/lib/invoice/formatter";

interface PreviewResult {
  family_id: string;
  status: 'assigned' | 'pending' | 'none';
  reason?: string;
  winner_student_id?: string;
  winner_class_name?: string;
  winner_base?: number;
  discount_percent?: number;
  discount_amount?: number;
  student_count?: number;
  positive_count?: number;
  all_students?: Array<{
    student_id: string;
    class_name: string;
    projected_base: number;
    is_winner: boolean;
  }>;
}

export function SiblingDiscountCompute() {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewResults, setPreviewResults] = useState<PreviewResult[] | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const { toast } = useToast();

  // Generate list of months (current + next 2)
  const months = Array.from({ length: 3 }, (_, i) => {
    const date = new Date();
    date.setMonth(date.getMonth() + i);
    return format(date, "yyyy-MM");
  });

  const handlePreview = async () => {
    try {
      setPreviewLoading(true);
      
      const { data, error } = await supabase.functions.invoke("compute-sibling-discounts", {
        body: { month: selectedMonth, dryRun: true },
      });

      if (error) throw error;

      setPreviewResults(data.results || []);
      setShowPreview(true);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setPreviewLoading(false);
    }
  };

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
      
      // Close preview if open and refresh any necessary data
      setShowPreview(false);
      setPreviewResults(null);
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
    <>
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
              onClick={handlePreview} 
              disabled={previewLoading || loading}
              variant="outline"
              className="gap-2"
            >
              {previewLoading && <Loader2 className="h-4 w-4 animate-spin" />}
              {!previewLoading && <Eye className="h-4 w-4" />}
              Preview
            </Button>
            <Button 
              onClick={handleCompute} 
              disabled={loading || previewLoading}
              className="gap-2"
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Apply Discounts
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

      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Discount Preview for {format(new Date(selectedMonth + "-01"), "MMMM yyyy")}</DialogTitle>
            <DialogDescription>
              Review the discount assignments before applying them. No changes will be made until you click "Apply Now".
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {previewResults && previewResults.length === 0 && (
              <p className="text-center text-muted-foreground py-8">No families found for this month.</p>
            )}

            {previewResults?.map((result) => (
              <Card key={result.family_id}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-4 w-4" />
                        <span className="font-medium text-sm">Family ID: {result.family_id.slice(0, 8)}</span>
                      </div>
                      <Badge variant={
                        result.status === 'assigned' ? 'default' :
                        result.status === 'pending' ? 'secondary' :
                        'outline'
                      }>
                        {result.status === 'assigned' && <CheckCircle2 className="h-3 w-3 mr-1" />}
                        {result.status === 'pending' && <AlertCircle className="h-3 w-3 mr-1" />}
                        {result.status.toUpperCase()}
                      </Badge>
                    </div>

                    {result.status === 'assigned' && result.all_students && (
                      <div className="space-y-2">
                        <p className="text-sm font-medium">Students & Classes:</p>
                        <div className="space-y-1.5">
                          {result.all_students.map((student) => (
                            <div
                              key={student.student_id}
                              className={`flex items-center justify-between p-2 rounded text-sm ${
                                student.is_winner
                                  ? 'bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800'
                                  : 'bg-muted/50'
                              }`}
                            >
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{student.class_name}</span>
                                {student.is_winner && (
                                  <Badge variant="default" className="bg-green-600 text-xs">Winner</Badge>
                                )}
                              </div>
                              <span className={student.is_winner ? 'font-semibold' : ''}>
                                {formatVND(student.projected_base)}
                              </span>
                            </div>
                          ))}
                        </div>
                        
                        <div className="pt-2 border-t space-y-1">
                          <div className="flex justify-between text-sm">
                            <span>Discount ({result.discount_percent}% on {result.winner_class_name})</span>
                            <span className="font-semibold text-green-600 dark:text-green-400">
                              -{formatVND(result.discount_amount || 0)}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}

                    {(result.status === 'pending' || result.status === 'none') && (
                      <p className="text-sm text-muted-foreground">{result.reason}</p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPreview(false)}>
              Cancel
            </Button>
            <Button onClick={handleCompute} disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
              Apply Now
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}