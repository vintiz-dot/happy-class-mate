import { useState } from "react";
import Layout from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/hooks/useAuth";
import { PaymentManager } from "@/components/admin/PaymentManager";
import { DiscountManager } from "@/components/admin/DiscountManager";
import { SiblingDiscountCompute } from "@/components/admin/SiblingDiscountCompute";
import { TuitionCard } from "@/components/student/TuitionCard";
import ProfilePicker from "@/components/ProfilePicker";
import { DollarSign, Percent, Users } from "lucide-react";

const Tuition = () => {
  const { role } = useAuth();
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);
  const [showProfilePicker, setShowProfilePicker] = useState(role === "family" && !selectedStudent);

  const handleStudentSelect = (studentId: string) => {
    setSelectedStudent(studentId);
    setShowProfilePicker(false);
  };

  if (showProfilePicker && role === "family") {
    return <ProfilePicker onSelect={handleStudentSelect} />;
  }

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
          <Tabs defaultValue="payments" className="space-y-6">
            <TabsList className="grid w-full grid-cols-3">
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
            </TabsList>

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
          </Tabs>
        ) : (
          <div className="space-y-6">
            {selectedStudent && <TuitionCard studentId={selectedStudent} />}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Tuition;
