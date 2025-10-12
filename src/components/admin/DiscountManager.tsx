import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Percent, Gift, Users } from "lucide-react";

interface Family {
  id: string;
  name: string;
  sibling_percent_override: number | null;
}

interface Student {
  id: string;
  full_name: string;
}

interface DiscountDefinition {
  id: string;
  name: string;
  type: string;
  cadence: string;
  value: number;
  is_active: boolean;
}

export function DiscountManager() {
  const [families, setFamilies] = useState<Family[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [discountDefs, setDiscountDefs] = useState<DiscountDefinition[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  // Sibling discount state
  const [selectedFamily, setSelectedFamily] = useState("");
  const [siblingOverride, setSiblingOverride] = useState("");

  // Special discount state
  const [discountName, setDiscountName] = useState("");
  const [discountType, setDiscountType] = useState<"percent" | "amount">("percent");
  const [discountValue, setDiscountValue] = useState("");
  const [discountCadence, setDiscountCadence] = useState<"once" | "monthly">("monthly");

  // Referral bonus state
  const [selectedStudent, setSelectedStudent] = useState("");
  const [referralType, setReferralType] = useState<"percent" | "amount">("percent");
  const [referralValue, setReferralValue] = useState("");
  const [referralCadence, setReferralCadence] = useState<"once" | "monthly">("monthly");

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const [familiesRes, studentsRes, discountsRes] = await Promise.all([
        supabase.from("families").select("*").eq("is_active", true),
        supabase.from("students").select("id, full_name").eq("is_active", true),
        supabase.from("discount_definitions" as any).select("*").eq("is_active", true),
      ]);

      if (familiesRes.data) setFamilies(familiesRes.data);
      if (studentsRes.data) setStudents(studentsRes.data);
      if (discountsRes.data) setDiscountDefs(discountsRes.data as any);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const updateSiblingDiscount = async () => {
    if (!selectedFamily) return;

    setLoading(true);
    try {
      const value = siblingOverride ? parseFloat(siblingOverride) : null;
      const { error } = await supabase
        .from("families")
        .update({ sibling_percent_override: value })
        .eq("id", selectedFamily);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Sibling discount updated",
      });

      setSelectedFamily("");
      setSiblingOverride("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createSpecialDiscount = async () => {
    if (!discountName || !discountValue) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const currentMonth = new Date().toISOString().slice(0, 7);
      const { error } = await supabase.from("discount_definitions" as any).insert({
        name: discountName,
        type: discountType,
        cadence: discountCadence,
        value: parseInt(discountValue),
        start_month: currentMonth,
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Discount created",
      });

      setDiscountName("");
      setDiscountValue("");
      loadData();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const createReferralBonus = async () => {
    if (!selectedStudent || !referralValue) {
      toast({
        title: "Missing fields",
        description: "Please select student and value",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.from("referral_bonuses" as any).insert({
        student_id: selectedStudent,
        type: referralType,
        cadence: referralCadence,
        value: parseInt(referralValue),
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Referral bonus created",
      });

      setSelectedStudent("");
      setReferralValue("");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Tabs defaultValue="sibling" className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <TabsTrigger value="sibling">Sibling Discount</TabsTrigger>
        <TabsTrigger value="special">Special Discounts</TabsTrigger>
        <TabsTrigger value="referral">Referral Bonuses</TabsTrigger>
      </TabsList>

      <TabsContent value="sibling">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Sibling Discount Override
            </CardTitle>
            <CardDescription>
              Default: 5% for one student per family. Override per family here.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Family</Label>
              <Select value={selectedFamily} onValueChange={setSelectedFamily}>
                <SelectTrigger>
                  <SelectValue placeholder="Select family" />
                </SelectTrigger>
                <SelectContent>
                  {families.map((family) => (
                    <SelectItem key={family.id} value={family.id}>
                      {family.name}
                      {family.sibling_percent_override && (
                        <span className="ml-2 text-muted-foreground">
                          (Current: {family.sibling_percent_override}%)
                        </span>
                      )}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Override Percent (leave empty to use default 5%)</Label>
              <Input
                type="number"
                value={siblingOverride}
                onChange={(e) => setSiblingOverride(e.target.value)}
                placeholder="e.g. 10"
                step="0.01"
              />
            </div>

            <Button onClick={updateSiblingDiscount} disabled={loading} className="w-full">
              Update Sibling Discount
            </Button>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="special">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Percent className="h-5 w-5" />
              Create Special Discount
            </CardTitle>
            <CardDescription>
              Create a discount that can be assigned to students
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Discount Name</Label>
              <Input
                value={discountName}
                onChange={(e) => setDiscountName(e.target.value)}
                placeholder="e.g. Early Bird Discount"
              />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={discountType} onValueChange={(v: any) => setDiscountType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="amount">Amount (VND)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === "percent" ? "e.g. 10" : "e.g. 50000"}
                />
              </div>

              <div className="space-y-2">
                <Label>Cadence</Label>
                <Select value={discountCadence} onValueChange={(v: any) => setDiscountCadence(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={createSpecialDiscount} disabled={loading} className="w-full">
              Create Discount
            </Button>

            <div className="mt-6 space-y-2">
              <h4 className="font-semibold">Active Discounts</h4>
              {discountDefs.length === 0 ? (
                <p className="text-muted-foreground text-sm">No discounts created yet</p>
              ) : (
                discountDefs.map((discount) => (
                  <div key={discount.id} className="flex items-center justify-between p-3 border rounded">
                    <div>
                      <p className="font-medium">{discount.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {discount.value}
                        {discount.type === "percent" ? "%" : " VND"} - {discount.cadence}
                      </p>
                    </div>
                    <Badge>{discount.cadence}</Badge>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="referral">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5" />
              Create Referral Bonus
            </CardTitle>
            <CardDescription>Award bonuses to students who refer others</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Student</Label>
              <Select value={selectedStudent} onValueChange={setSelectedStudent}>
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Type</Label>
                <Select value={referralType} onValueChange={(v: any) => setReferralType(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="percent">Percent</SelectItem>
                    <SelectItem value="amount">Amount (VND)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Value</Label>
                <Input
                  type="number"
                  value={referralValue}
                  onChange={(e) => setReferralValue(e.target.value)}
                  placeholder={referralType === "percent" ? "e.g. 10" : "e.g. 100000"}
                />
              </div>

              <div className="space-y-2">
                <Label>Cadence</Label>
                <Select value={referralCadence} onValueChange={(v: any) => setReferralCadence(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Once</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Button onClick={createReferralBonus} disabled={loading} className="w-full">
              Create Referral Bonus
            </Button>
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
}
