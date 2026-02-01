import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTuitionListEnhanced } from "@/components/admin/AdminTuitionListEnhanced";
import { TuitionBulkDownload } from "@/components/admin/TuitionBulkDownload";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { PayrollTab } from "./PayrollTab";
import { FinanceSummary } from "@/components/admin/FinanceSummary";
import { ExpendituresManager } from "@/components/admin/ExpendituresManager";
import { RecordedPaymentManager } from "@/components/admin/RecordedPaymentManager";
import { MonthPicker } from "@/components/MonthPicker";
import { dayjs } from "@/lib/date";
import { Button } from "@/components/ui/button";
import { Wallet } from "lucide-react";
import { SmartFamilyPaymentModal } from "@/components/admin/SmartFamilyPaymentModal";

const FinanceTab = () => {
  const [smartPaymentOpen, setSmartPaymentOpen] = useState(false);
  const [currentMonth, setCurrentMonth] = useState(dayjs().format("YYYY-MM"));

  return (
    <>
      <SmartFamilyPaymentModal open={smartPaymentOpen} onClose={() => setSmartPaymentOpen(false)} />
      
      <Tabs defaultValue="summary" className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <TabsList>
            <TabsTrigger value="summary">Summary</TabsTrigger>
            <TabsTrigger value="overview">Tuition</TabsTrigger>
            <TabsTrigger value="bulk">Bulk Download</TabsTrigger>
            <TabsTrigger value="recorded">Recorded Payments</TabsTrigger>
            <TabsTrigger value="expenditures">Expenditures</TabsTrigger>
            <TabsTrigger value="discounts">Discounts</TabsTrigger>
            <TabsTrigger value="sibling">Sibling Discounts</TabsTrigger>
            <TabsTrigger value="payroll">Teacher Payroll</TabsTrigger>
          </TabsList>
          
          <Button onClick={() => setSmartPaymentOpen(true)} className="gap-2">
            <Wallet className="h-4 w-4" />
            Smart Family Payment
          </Button>
        </div>

      <TabsContent value="summary" className="space-y-4">
        <FinanceSummary />
      </TabsContent>

      <TabsContent value="overview" className="space-y-4">
        <MonthPicker value={currentMonth} onChange={setCurrentMonth} />
        <AdminTuitionListEnhanced month={currentMonth} />
      </TabsContent>

      <TabsContent value="bulk">
        <TuitionBulkDownload month={currentMonth} />
      </TabsContent>

      <TabsContent value="recorded">
        <RecordedPaymentManager />
      </TabsContent>

      <TabsContent value="discounts">
        <DiscountManager />
      </TabsContent>

      <TabsContent value="expenditures" className="space-y-4">
        <MonthPicker value={currentMonth} onChange={setCurrentMonth} />
        <ExpendituresManager selectedMonth={currentMonth} />
      </TabsContent>

      <TabsContent value="sibling">
        <SiblingDiscountCompute />
      </TabsContent>

        <TabsContent value="payroll">
          <PayrollTab />
        </TabsContent>
      </Tabs>
    </>
  );
};

export default FinanceTab;
