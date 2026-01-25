import { useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Eye, 
  CreditCard, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp,
  Award,
  Percent
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { getPaymentStatus, getTuitionStatusBadge, PaymentStatus } from "@/lib/tuitionStatus";
import { motion, AnimatePresence } from "framer-motion";
import { InvoiceDownloadButton } from "@/components/invoice/InvoiceDownloadButton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface TuitionStudentCardProps {
  item: any;
  month: string;
  isEditing: boolean;
  editValue: string;
  editDate: string;
  editMethod: string;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: () => void;
  onEditValueChange: (value: string) => void;
  onEditDateChange: (value: string) => void;
  onEditMethodChange: (value: string) => void;
}

const formatVND = (amount: number) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    minimumFractionDigits: 0,
  }).format(amount);
};

export function TuitionStudentCard({
  item,
  month,
  isEditing,
  editValue,
  editDate,
  editMethod,
  onStartEdit,
  onCancelEdit,
  onSaveEdit,
  onEditValueChange,
  onEditDateChange,
  onEditMethodChange,
}: TuitionStudentCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const navigate = useNavigate();

  const status = getPaymentStatus({
    carryOutDebt: item.carry_out_debt ?? 0,
    carryOutCredit: item.carry_out_credit ?? 0,
    totalAmount: item.total_amount ?? 0,
    monthPayments: item.recorded_payment ?? 0,
  });

  const getStatusColor = (status: PaymentStatus) => {
    switch (status) {
      case 'overpaid': return 'border-l-blue-500 bg-blue-50/50 dark:bg-blue-950/20';
      case 'settled': return 'border-l-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20';
      case 'underpaid': return 'border-l-amber-500 bg-amber-50/50 dark:bg-amber-950/20';
      case 'unpaid': return 'border-l-red-500 bg-red-50/50 dark:bg-red-950/20';
      default: return 'border-l-gray-300';
    }
  };

  const classes = (item as any).classes?.map((c: any) => c.name).join(", ") || "No class";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      layout
    >
      <Card className={`border-l-4 transition-all duration-200 hover:shadow-md ${getStatusColor(status)}`}>
        <CardContent className="p-4">
          {/* Main Row */}
          <div className="flex items-center justify-between gap-4">
            {/* Left: Student Info */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="font-semibold text-base truncate">
                  {(item.students as any)?.full_name}
                </h3>
                {getTuitionStatusBadge(status)}
                {item.hasDiscount && (
                  <Badge variant="outline" className="gap-1 text-xs border-violet-300 text-violet-700 bg-violet-50 dark:bg-violet-950/30">
                    <Percent className="h-3 w-3" />
                    Discount
                  </Badge>
                )}
                {item.hasSiblings && (
                  <Badge variant="outline" className="gap-1 text-xs border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-950/30">
                    <Award className="h-3 w-3" />
                    Sibling
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">{classes}</p>
            </div>

            {/* Center: Financial Summary */}
            <div className="hidden md:flex items-center gap-6 text-sm">
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Payable</p>
                <p className="font-semibold">{formatVND(item.finalPayable)}</p>
              </div>
              <div className="text-center">
                <p className="text-xs text-muted-foreground">Paid</p>
                <p className="font-semibold text-emerald-600">
                  {formatVND(item.recorded_payment ?? 0)}
                </p>
              </div>
              {item.balance !== 0 && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground">Balance</p>
                  <p className={`font-semibold ${item.balance > 0 ? 'text-red-600' : 'text-blue-600'}`}>
                    {formatVND(Math.abs(item.balance))}
                    {item.balance < 0 && ' CR'}
                  </p>
                </div>
              )}
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {!isEditing && (
                <>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onStartEdit}
                    className="gap-1.5 hidden sm:flex"
                  >
                    <CreditCard className="h-4 w-4" />
                    Record Pay
                  </Button>
                  <div className="hidden sm:block">
                    <InvoiceDownloadButton 
                      studentId={item.student_id} 
                      month={month}
                      variant="ghost"
                      size="sm"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => navigate(`/students/${item.student_id}`)}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setIsExpanded(!isExpanded)}
                    className="md:hidden"
                  >
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                </>
              )}
            </div>
          </div>

          {/* Expanded Details (Mobile) */}
          <AnimatePresence>
            {isExpanded && !isEditing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="grid grid-cols-2 gap-3 mt-4 pt-4 border-t text-sm">
                  <div>
                    <p className="text-xs text-muted-foreground">Base</p>
                    <p className="font-medium">{formatVND(item.base_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Discount</p>
                    <p className="font-medium text-emerald-600">-{formatVND(item.discount_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Current Charges</p>
                    <p className="font-medium">{formatVND(item.total_amount)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Prior Balance</p>
                    <p className={`font-medium ${item.priorBalance >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {item.priorBalance >= 0 ? '+' : ''}{formatVND(item.priorBalance)}
                    </p>
                  </div>
                  <div className="col-span-2 flex gap-2 mt-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={onStartEdit}
                      className="flex-1 gap-1.5"
                    >
                      <CreditCard className="h-4 w-4" />
                      Record Payment
                    </Button>
                    <InvoiceDownloadButton 
                      studentId={item.student_id} 
                      month={month}
                      variant="outline"
                      size="sm"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Inline Edit Form */}
          <AnimatePresence>
            {isEditing && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="overflow-hidden"
              >
                <div className="mt-4 pt-4 border-t">
                  <div className="grid gap-3 sm:grid-cols-4">
                    <div className="sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Amount (₫)
                      </label>
                      <Input
                        type="number"
                        value={editValue}
                        onChange={(e) => onEditValueChange(e.target.value)}
                        placeholder="0"
                        className="h-9"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Date
                      </label>
                      <Input
                        type="date"
                        value={editDate}
                        onChange={(e) => onEditDateChange(e.target.value)}
                        className="h-9"
                      />
                    </div>
                    <div className="sm:col-span-1">
                      <label className="text-xs font-medium text-muted-foreground mb-1.5 block">
                        Method
                      </label>
                      <Select value={editMethod} onValueChange={onEditMethodChange}>
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Cash">Cash</SelectItem>
                          <SelectItem value="Bank Transfer">Bank Transfer</SelectItem>
                          <SelectItem value="Card">Card</SelectItem>
                          <SelectItem value="Other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="flex items-end gap-2 sm:col-span-1">
                      <Button size="sm" onClick={onSaveEdit} className="flex-1 gap-1.5">
                        <Check className="h-4 w-4" />
                        Save
                      </Button>
                      <Button size="sm" variant="ghost" onClick={onCancelEdit}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    Outstanding: {formatVND(item.finalPayable - (item.recorded_payment ?? 0))}
                  </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </CardContent>
      </Card>
    </motion.div>
  );
}
