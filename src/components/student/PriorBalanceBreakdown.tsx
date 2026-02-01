import { useState } from "react";
import { ChevronRight } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { formatVND } from "@/hooks/useStudentMonthFinance";
import { cn } from "@/lib/utils";

export interface PriorBalanceItem {
  type: 'charge' | 'payment' | 'canceled';
  className?: string;
  classId?: string;
  amount: number;
  description: string;
  date?: string;
}

export interface PriorBalanceMonth {
  month: string;
  label: string;
  charges: number;
  payments: number;
  netBalance: number;
  items: PriorBalanceItem[];
}

export interface PriorBalanceBreakdownData {
  months: PriorBalanceMonth[];
  summary: {
    totalPriorCharges: number;
    totalPriorPayments: number;
    netCarryIn: number;
  };
}

interface Props {
  breakdown: PriorBalanceBreakdownData;
}

function formatShortMonth(monthStr: string): string {
  const date = new Date(`${monthStr}-01`);
  return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

export function PriorBalanceBreakdown({ breakdown }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  if (!breakdown.months || breakdown.months.length === 0) {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        No prior balance history
      </p>
    );
  }

  const { months, summary } = breakdown;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors">
        <ChevronRight 
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-90"
          )} 
        />
        View History
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 border-t border-border/50 pt-3">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border/50 text-muted-foreground">
                <th className="text-left py-1.5 font-medium">Month</th>
                <th className="text-right py-1.5 font-medium">Charged</th>
                <th className="text-right py-1.5 font-medium">Paid</th>
                <th className="text-right py-1.5 font-medium">Balance</th>
              </tr>
            </thead>
            <tbody>
              {months.map((m, idx) => {
                // Calculate running balance up to this point
                const runningBalance = months
                  .slice(0, idx + 1)
                  .reduce((sum, month) => sum + month.netBalance, 0);
                
                return (
                  <tr key={m.month} className="border-b border-border/30">
                    <td className="py-1.5">{formatShortMonth(m.month)}</td>
                    <td className="text-right text-red-600 dark:text-red-400 tabular-nums">
                      {formatVND(m.charges)}
                    </td>
                    <td className="text-right text-green-600 dark:text-green-400 tabular-nums">
                      {formatVND(m.payments)}
                    </td>
                    <td className={cn(
                      "text-right font-medium tabular-nums",
                      runningBalance > 0 && "text-green-600 dark:text-green-400",
                      runningBalance < 0 && "text-red-600 dark:text-red-400"
                    )}>
                      {runningBalance > 0 ? '+' : ''}{formatVND(runningBalance)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="font-semibold bg-muted/30">
                <td className="py-2">Total</td>
                <td className="text-right text-red-600 dark:text-red-400 tabular-nums">
                  {formatVND(summary.totalPriorCharges)}
                </td>
                <td className="text-right text-green-600 dark:text-green-400 tabular-nums">
                  {formatVND(summary.totalPriorPayments)}
                </td>
                <td className={cn(
                  "text-right tabular-nums",
                  summary.netCarryIn > 0 && "text-green-600 dark:text-green-400",
                  summary.netCarryIn < 0 && "text-red-600 dark:text-red-400"
                )}>
                  {summary.netCarryIn > 0 ? '+' : ''}{formatVND(summary.netCarryIn)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
