import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentTuitionOverview } from "@/components/admin/StudentTuitionOverview";
import { BulkInvoiceDownload } from "@/components/admin/BulkInvoiceDownload";
import { PaymentManager } from "@/components/admin/PaymentManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { PayrollTab } from "./PayrollTab";

const FinanceTab = () => {
  const [currentMonth, setCurrentMonth] = useState(new Date().toISOString().slice(0, 7));

  return (
    <Tabs defaultValue="overview" className="space-y-4">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="bulk">Bulk Download</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        <TabsTrigger value="discounts">Discounts</TabsTrigger>
        <TabsTrigger value="sibling">Sibling Discounts</TabsTrigger>
        <TabsTrigger value="payroll">Teacher Payroll</TabsTrigger>
      </TabsList>

      <TabsContent value="overview">
        <StudentTuitionOverview />
      </TabsContent>

      <TabsContent value="bulk">
        <BulkInvoiceDownload month={currentMonth} />
      </TabsContent>

      <TabsContent value="payments">
        <PaymentManager />
      </TabsContent>

      <TabsContent value="discounts">
        <DiscountManager />
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
