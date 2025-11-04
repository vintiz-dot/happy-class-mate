import Layout from "@/components/Layout";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { GenerateTuition } from "@/components/admin/GenerateTuition";
import { TuitionBulkDownload } from "@/components/admin/TuitionBulkDownload";
import { MonthPicker } from "@/components/MonthPicker";
import { useState } from "react";
import { dayjs } from "@/lib/date";

const Finance = () => {
  const [selectedMonth, setSelectedMonth] = useState(dayjs().format("YYYY-MM"));

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Manage payments, payroll, and discounts</p>
        </div>

        <div className="space-y-4">
          <h2 className="text-2xl font-bold">Tuition Management</h2>
          
          <div className="mb-4">
            <label className="text-sm font-medium mb-2 block">Select Month</label>
            <MonthPicker value={selectedMonth} onChange={setSelectedMonth} />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <GenerateTuition />
            <TuitionBulkDownload month={selectedMonth} />
          </div>
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Sibling Discount Computation</h2>
          <SiblingDiscountCompute />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Teacher Payroll</h2>
          <PayrollManager />
        </div>

        <div>
          <h2 className="text-2xl font-bold mb-4">Discount Management</h2>
          <DiscountManager />
        </div>
      </div>
    </Layout>
  );
};

export default Finance;
