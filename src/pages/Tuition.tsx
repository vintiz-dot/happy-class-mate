import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { PaymentManager } from "@/components/admin/PaymentManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { StudentTuitionOverview } from "@/components/admin/StudentTuitionOverview";
import { TuitionCard } from "@/components/student/TuitionCard";
import { AccountInfoManager } from "@/components/admin/AccountInfoManager";
import { BulkInvoiceDownload } from "@/components/admin/BulkInvoiceDownload";
import { DollarSign, Percent, Users, GraduationCap, Building2, Download } from "lucide-react";
import { useStudentProfile } from "@/contexts/StudentProfileContext";

const Tuition = () => {
  const { role } = useAuth();
  const { studentId } = useStudentProfile();
  const [currentMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });

  return (
    <Layout>
      <div className="space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Tuition Management</h1>
          <p className="text-muted-foreground">
            {role === "admin" 
              ? "Manage tuition, payments, and discounts"
              : "View tuition details and payment history"}
          </p>
        </div>

        {role === "admin" ? (
          <Tabs defaultValue="overview" className="space-y-6">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="overview" className="gap-2">
                <GraduationCap className="h-4 w-4" />
                Overview
              </TabsTrigger>
              <TabsTrigger value="bulk" className="gap-2">
                <Download className="h-4 w-4" />
                Bulk Download
              </TabsTrigger>
              <TabsTrigger value="payments" className="gap-2">
                <DollarSign className="h-4 w-4" />
                Payments
              </TabsTrigger>
              <TabsTrigger value="discounts" className="gap-2">
                <Percent className="h-4 w-4" />
                Discounts
              </TabsTrigger>
              <TabsTrigger value="siblings" className="gap-2">
                <Users className="h-4 w-4" />
                Sibling Discounts
              </TabsTrigger>
              <TabsTrigger value="account" className="gap-2">
                <Building2 className="h-4 w-4" />
                Account Info
              </TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-6">
              <StudentTuitionOverview />
            </TabsContent>

            <TabsContent value="bulk" className="space-y-6">
              <BulkInvoiceDownload month={currentMonth} />
            </TabsContent>

            <TabsContent value="payments" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Payment Management</CardTitle>
                  <CardDescription>
                    Record and track student tuition payments
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <PaymentManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="discounts" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Discount Management</CardTitle>
                  <CardDescription>
                    Create and assign custom discounts to students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DiscountManager />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="siblings" className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle>Sibling Discount Computation</CardTitle>
                  <CardDescription>
                    Compute and assign sibling discounts for families with multiple students
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SiblingDiscountCompute />
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="account" className="space-y-6">
              <AccountInfoManager />
            </TabsContent>
          </Tabs>
        ) : (
          <div className="space-y-6">
            {studentId ? (
              <TuitionCard studentId={studentId} />
            ) : (
              <p className="text-muted-foreground">Please select a student profile to view tuition.</p>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Tuition;
