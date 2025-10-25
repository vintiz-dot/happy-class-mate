import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTuitionList } from "@/components/admin/AdminTuitionList";
import { BulkInvoiceDownload } from "@/components/admin/BulkInvoiceDownload";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { PayrollTab } from "./PayrollTab";
import { FinanceSummary } from "@/components/admin/FinanceSummary";
import { ExpendituresManager } from "@/components/admin/ExpendituresManager";
import { RecordedPaymentManager } from "@/components/admin/RecordedPaymentManager";

const FinanceTab = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

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

      <TabsContent value="overview">
        <AdminTuitionList month={currentMonth} />
      </TabsContent>

      <TabsContent value="bulk">
        <BulkInvoiceDownload month={currentMonth} />
      </TabsContent>

      <TabsContent value="recorded">
        <RecordedPaymentManager />
      </TabsContent>

      <TabsContent value="discounts">
        <DiscountManager />
      </TabsContent>

      <TabsContent value="expenditures">
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
