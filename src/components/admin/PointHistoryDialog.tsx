import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Calendar, BookOpen, Users, TrendingUp, TrendingDown } from "lucide-react";
import { format } from "date-fns";

interface PointHistoryDialogProps {
  studentId: string;
  classId: string;
  month: string;
  studentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PointHistoryDialog({
  studentId,
  classId,
  month,
  studentName,
  open,
  onOpenChange,
}: PointHistoryDialogProps) {
  const { data: transactions, isLoading } = useQuery({
    queryKey: ["point-transactions", studentId, classId, month],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("point_transactions")
        .select("*")
        .eq("student_id", studentId)
        .eq("class_id", classId)
        .gte("date", `${month}-01`)
        .lt("date", `${month}-32`)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "homework":
        return <BookOpen className="h-4 w-4" />;
      case "participation":
        return <Users className="h-4 w-4" />;
      case "adjustment":
        return <TrendingUp className="h-4 w-4" />;
      default:
        return null;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case "homework":
        return "bg-blue-500/10 text-blue-700 dark:text-blue-400";
      case "participation":
        return "bg-green-500/10 text-green-700 dark:text-green-400";
      case "adjustment":
        return "bg-purple-500/10 text-purple-700 dark:text-purple-400";
      default:
        return "bg-gray-500/10 text-gray-700 dark:text-gray-400";
    }
  };

  const totalPoints = transactions?.reduce((sum, t) => sum + t.points, 0) || 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Point History - {studentName}
          </DialogTitle>
          <p className="text-sm text-muted-foreground">
            {format(new Date(`${month}-01`), "MMMM yyyy")} • Total: {totalPoints} points
          </p>
        </DialogHeader>

        <ScrollArea className="max-h-[500px] pr-4">
          {isLoading ? (
            <p className="text-center text-muted-foreground py-8">Loading history...</p>
          ) : transactions?.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">No point history for this month</p>
          ) : (
            <div className="space-y-3">
              {transactions?.map((transaction) => (
                <div
                  key={transaction.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-start gap-3 flex-1">
                      <div className={`p-2 rounded-lg ${getTypeColor(transaction.type)}`}>
                        {getTypeIcon(transaction.type)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge
                            variant="outline"
                            className="capitalize"
                          >
                            {transaction.type}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {format(new Date(transaction.date), "MMM dd, yyyy")}
                          </span>
                        </div>
                        
                        {transaction.type === "homework" && transaction.homework_title && (
                          <p className="text-sm font-medium mb-1">
                            {transaction.homework_title}
                          </p>
                        )}
                        
                        {transaction.type === "participation" && (
                          <p className="text-sm font-medium mb-1">
                            Class Participation
                          </p>
                        )}
                        
                        {transaction.type === "adjustment" && (
                          <p className="text-sm font-medium mb-1">
                            Point Adjustment
                          </p>
                        )}
                        
                        {transaction.notes && (
                          <p className="text-xs text-muted-foreground">
                            {transaction.notes}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-1">
                      {transaction.points > 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span
                        className={`text-lg font-bold ${
                          transaction.points > 0 ? "text-green-600" : "text-red-600"
                        }`}
                      >
                        {transaction.points > 0 ? "+" : ""}
                        {transaction.points}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
