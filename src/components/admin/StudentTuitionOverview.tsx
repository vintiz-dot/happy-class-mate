import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Award, Loader2 } from "lucide-react";
import { InvoiceDownloadButton } from "@/components/invoice/InvoiceDownloadButton";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

interface TuitionData {
  studentId: string;
  month: string;
  baseAmount: number;
  totalDiscount: number;
  totalAmount: number;
  sessionCount: number;
  payments?: {
    monthPayments: number;
    cumulativePaidAmount: number;
  };
  carry?: {
    carryOutCredit: number;
    carryOutDebt: number;
    status: string;
  };
  siblingState?: {
    status: string;
    percent: number;
    isWinner?: boolean;
  };
}

export function StudentTuitionOverview() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select('id, full_name, family:families(name)')
        .eq('is_active', true)
        .order('full_name');
      
      if (error) throw error;
      return data;
    },
  });

  const { data: tuitionData, isLoading: tuitionLoading } = useQuery({
    queryKey: ['all-student-tuition', selectedMonth, students],
    queryFn: async () => {
      if (!students?.length) return [];
      
      const results = await Promise.all(
        students.map(async (student) => {
          try {
            const { data, error } = await supabase.functions.invoke('calculate-tuition', {
              body: { studentId: student.id, month: selectedMonth }
            });
            
            if (error) throw error;
            return data as TuitionData;
          } catch (err) {
            console.error(`Error fetching tuition for ${student.full_name}:`, err);
            return null;
          }
        })
      );
      
      return results.filter((r): r is TuitionData => r !== null);
    },
    enabled: !!students?.length,
  });

  const formatVND = (amount: number) => {
    return new Intl.NumberFormat('vi-VN', {
      style: 'currency',
      currency: 'VND',
    }).format(amount);
  };

  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    for (let i = -2; i <= 2; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() + i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      options.push({ value, label });
    }
    return options;
  };

  if (studentsLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Student Tuition Overview</CardTitle>
            <CardDescription>
              View tuition details for all active students
            </CardDescription>
          </div>
          <Select value={selectedMonth} onValueChange={setSelectedMonth}>
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {getMonthOptions().map(({ value, label }) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {tuitionLoading ? (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Family</TableHead>
                <TableHead className="text-right">Sessions</TableHead>
                <TableHead className="text-right">Base Amount</TableHead>
                <TableHead className="text-right">Discounts</TableHead>
                <TableHead className="text-right">Total Payable</TableHead>
                <TableHead className="text-right">Recorded Pay</TableHead>
                <TableHead>Balance / Credit</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Invoice</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {students?.map((student) => {
                const tuition = tuitionData?.find(t => t.studentId === student.id);
                const recordedPay = tuition?.payments?.cumulativePaidAmount || 0;
                const balanceStatus = tuition?.carry?.status || 'settled';
                const balanceAmount = balanceStatus === 'credit' 
                  ? tuition?.carry?.carryOutCredit || 0
                  : balanceStatus === 'debt'
                  ? tuition?.carry?.carryOutDebt || 0
                  : 0;
                
                return (
                  <TableRow 
                    key={student.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/students/${student.id}`)}
                  >
                    <TableCell className="font-medium">{student.full_name}</TableCell>
                    <TableCell className="text-muted-foreground">
                      {student.family?.name || '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      {tuition?.sessionCount || 0}
                    </TableCell>
                    <TableCell className="text-right">
                      {tuition ? formatVND(tuition.baseAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-right text-green-600">
                      {tuition && tuition.totalDiscount > 0 
                        ? `-${formatVND(tuition.totalDiscount)}`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right font-semibold">
                      {tuition ? formatVND(tuition.totalAmount) : '—'}
                    </TableCell>
                    <TableCell className="text-right font-medium text-blue-600">
                      {recordedPay > 0 ? formatVND(recordedPay) : '—'}
                    </TableCell>
                    <TableCell>
                      {balanceStatus === 'credit' && balanceAmount > 0 && (
                        <Badge variant="default" className="bg-green-600">
                          Credit: {formatVND(balanceAmount)}
                        </Badge>
                      )}
                      {balanceStatus === 'debt' && balanceAmount > 0 && (
                        <Badge variant="destructive">
                          Balance Due: {formatVND(balanceAmount)}
                        </Badge>
                      )}
                      {balanceStatus === 'settled' && (
                        <Badge variant="secondary">Settled</Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {tuition?.siblingState?.status === 'assigned' && tuition.siblingState.isWinner && (
                        <Badge variant="secondary" className="gap-1">
                          <Award className="h-3 w-3" />
                          Sibling {tuition.siblingState.percent}%
                        </Badge>
                      )}
                      {tuition?.siblingState?.status === 'pending' && (
                        <Badge variant="outline" className="text-yellow-600 border-yellow-600">
                          Pending
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      {tuition && (
                        <InvoiceDownloadButton 
                          studentId={student.id} 
                          month={selectedMonth}
                          variant="ghost"
                          size="sm"
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
