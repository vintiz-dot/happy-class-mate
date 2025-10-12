import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function StudentTuitionTab({ studentId }: { studentId: string }) {
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), "yyyy-MM"));
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("cash");
  const [paymentDate, setPaymentDate] = useState<Date>(new Date());
  const [payerName, setPayerName] = useState("");

  const queryClient = useQueryClient();

  const { data: tuitionData, isLoading } = useQuery({
    queryKey: ["student-tuition", studentId, selectedMonth],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("calculate-tuition", {
        body: { studentId, month: selectedMonth },
      });

      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["student-payments", studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payments")
        .select("*")
        .eq("student_id", studentId)
        .order("occurred_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const recordPaymentMutation = useMutation({
    mutationFn: async (paymentData: any) => {
      const { data, error } = await supabase.functions.invoke("record-payment", {
        body: paymentData,
      });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success("Payment recorded successfully");
      queryClient.invalidateQueries({ queryKey: ["student-tuition", studentId] });
      queryClient.invalidateQueries({ queryKey: ["student-payments", studentId] });
      setPaymentDialogOpen(false);
      setPaymentAmount("");
      setPayerName("");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to record payment");
    },
  });

  const handleRecordPayment = () => {
    if (!paymentAmount || parseFloat(paymentAmount) <= 0) {
      toast.error("Please enter a valid payment amount");
      return;
    }

    recordPaymentMutation.mutate({
      studentId,
      amount: Math.round(parseFloat(paymentAmount)),
      method: paymentMethod,
      occurredAt: paymentDate.toISOString(),
      payerName,
    });
  };

  if (isLoading) {
    return <div>Loading tuition data...</div>;
  }

  const monthlyPayments = payments?.filter((p) =>
    p.occurred_at.startsWith(selectedMonth)
  ) || [];

  const totalPaid = monthlyPayments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <Label>Month</Label>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-48"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Projected Base</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {tuitionData?.baseAmount?.toLocaleString("vi-VN") || "0"} ₫
            </p>
            <p className="text-sm text-muted-foreground">
              {tuitionData?.sessionCount || 0} sessions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Discounts</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-green-600">
              -{tuitionData?.totalDiscount?.toLocaleString("vi-VN") || "0"} ₫
            </p>
            {tuitionData?.discounts && tuitionData.discounts.length > 0 && (
              <div className="mt-2 space-y-1">
                {tuitionData.discounts.map((d: any, i: number) => (
                  <p key={i} className="text-sm text-muted-foreground">
                    {d.name}: -{d.amount?.toLocaleString("vi-VN")} ₫
                  </p>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Final Payable</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {tuitionData?.totalAmount?.toLocaleString("vi-VN") || "0"} ₫
            </p>
            <p className="text-sm text-muted-foreground">
              Due: {selectedMonth}-05
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Paid to Date</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">
              {totalPaid.toLocaleString("vi-VN")} ₫
            </p>
            <p className="text-sm text-muted-foreground">
              Balance: {((tuitionData?.totalAmount || 0) - totalPaid).toLocaleString("vi-VN")} ₫
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Payment History</CardTitle>
          <Dialog open={paymentDialogOpen} onOpenChange={setPaymentDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">Record Payment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Record Payment</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Amount (₫)</Label>
                  <Input
                    type="number"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    placeholder="0"
                  />
                </div>
                <div>
                  <Label>Payment Method</Label>
                  <Select value={paymentMethod} onValueChange={setPaymentMethod}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Cash</SelectItem>
                      <SelectItem value="transfer">Bank Transfer</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Payment Date</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {paymentDate ? format(paymentDate, "PPP") : <span>Pick a date</span>}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                      <Calendar mode="single" selected={paymentDate} onSelect={(date) => date && setPaymentDate(date)} />
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <Label>Payer Name</Label>
                  <Input
                    value={payerName}
                    onChange={(e) => setPayerName(e.target.value)}
                    placeholder="Optional"
                  />
                </div>
                <Button onClick={handleRecordPayment} disabled={recordPaymentMutation.isPending} className="w-full">
                  {recordPaymentMutation.isPending ? "Recording..." : "Record Payment"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {monthlyPayments.length > 0 ? (
            <div className="space-y-2">
              {monthlyPayments.map((payment: any) => (
                <div key={payment.id} className="flex items-center justify-between border-b pb-2">
                  <div>
                    <p className="font-medium">{payment.amount.toLocaleString("vi-VN")} ₫</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(payment.occurred_at), "MMM d, yyyy")} • {payment.method}
                    </p>
                    {payment.memo && <p className="text-xs text-muted-foreground">{payment.memo}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No payments recorded for this month</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}