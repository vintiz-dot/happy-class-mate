import { useState } from "react";
import { ChevronRight, ArrowDown, ArrowUp, X } from "lucide-react";
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

export function PriorBalanceBreakdown({ breakdown }: Props) {
  const [isOpen, setIsOpen] = useState(false);

  // Don't show if no prior months
  if (!breakdown.months || breakdown.months.length === 0) {
    return (
      <p className="text-xs text-muted-foreground mt-2">
        No prior balance history
      </p>
    );
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground mt-2 transition-colors">
        <ChevronRight 
          className={cn(
            "h-3 w-3 transition-transform duration-200",
            isOpen && "rotate-90"
          )} 
        />
        View Details
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mt-3 space-y-4 border-t border-border/50 pt-3">
          {breakdown.months.map((monthData) => (
            <div key={monthData.month} className="space-y-1.5">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold">{monthData.label}</p>
                <span className={cn(
                  "text-xs font-medium",
                  monthData.netBalance > 0 ? "text-green-600 dark:text-green-400" : 
                  monthData.netBalance < 0 ? "text-red-600 dark:text-red-400" : ""
                )}>
                  {monthData.netBalance > 0 ? '+' : ''}{formatVND(monthData.netBalance)}
                </span>
              </div>
              <div className="ml-3 space-y-0.5 border-l-2 border-border/50 pl-3">
                {monthData.items.map((item, idx) => (
                  <div 
                    key={idx} 
                    className="flex justify-between text-[11px] leading-relaxed"
                  >
                    <span className="flex items-center gap-1.5 text-muted-foreground">
                      {item.type === 'charge' && (
                        <ArrowDown className="h-3 w-3 text-red-500 shrink-0" />
                      )}
                      {item.type === 'payment' && (
                        <ArrowUp className="h-3 w-3 text-green-500 shrink-0" />
                      )}
                      {item.type === 'canceled' && (
                        <X className="h-3 w-3 text-blue-500 shrink-0" />
                      )}
                      <span className="truncate">
                        {item.className && `${item.className}: `}
                        {item.description}
                        {item.date && ` (${item.date})`}
                      </span>
                    </span>
                    <span className={cn(
                      "ml-2 tabular-nums shrink-0",
                      item.amount > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"
                    )}>
                      {item.amount > 0 ? '+' : ''}{formatVND(item.amount)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          {/* Cumulative summary */}
          <div className="border-t border-border/50 pt-2 mt-3">
            <div className="flex justify-between text-xs font-medium">
              <span className="text-muted-foreground">Cumulative Balance</span>
              <span className={cn(
                breakdown.summary.netCarryIn > 0 ? "text-green-600 dark:text-green-400" :
                breakdown.summary.netCarryIn < 0 ? "text-red-600 dark:text-red-400" : ""
              )}>
                {breakdown.summary.netCarryIn > 0 ? '+' : ''}{formatVND(breakdown.summary.netCarryIn)}
              </span>
            </div>
          </div>
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
