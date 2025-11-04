import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTuitionList } from "@/components/admin/AdminTuitionList";
import { TuitionBulkDownload } from "@/components/admin/TuitionBulkDownload";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { PayrollTab } from "./PayrollTab";
import { FinanceSummary } from "@/components/admin/FinanceSummary";
import { ExpendituresManager } from "@/components/admin/ExpendituresManager";
import { RecordedPaymentManager } from "@/components/admin/RecordedPaymentManager";
import { MonthPicker } from "@/components/MonthPicker";
import { dayjs } from "@/lib/date";

const FinanceTab = () => {
  const [currentMonth, setCurrentMonth] = useState(dayjs().format("YYYY-MM"));

  return (
    <Tabs defaultValue="summary" className="space-y-4">
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

      <TabsContent value="summary" className="space-y-4">
        <FinanceSummary />
      </TabsContent>

      <TabsContent value="overview" className="space-y-4">
        <MonthPicker value={currentMonth} onChange={setCurrentMonth} />
        <AdminTuitionList month={currentMonth} />
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
  );
};

export default FinanceTab;
