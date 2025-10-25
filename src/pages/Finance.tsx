import Layout from "@/components/Layout";
import { PayrollManager } from "@/components/admin/PayrollManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";

const Finance = () => {
  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Finance</h1>
          <p className="text-muted-foreground">Manage payments, payroll, and discounts</p>
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
