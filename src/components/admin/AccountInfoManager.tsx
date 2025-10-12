import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Loader2 } from "lucide-react";

export function AccountInfoManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    org_name: '',
    org_address: '',
    bank_name: '',
    account_number: '',
    account_name: '',
  });

  useEffect(() => {
    fetchBankInfo();
  }, []);

  const fetchBankInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('bank_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setFormData({
          org_name: data.org_name || 'Happy English Club',
          org_address: data.org_address || '',
          bank_name: data.bank_name || '',
          account_number: data.account_number || '',
          account_name: data.account_name || '',
        });
      }
    } catch (error: any) {
      toast({
        title: "Error loading account info",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('bank_info')
        .upsert({
          id: 1,
          ...formData,
          updated_at: new Date().toISOString(),
        });

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Account information updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error saving",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organization & Banking Information</CardTitle>
        <CardDescription>
          This information will appear on all invoices issued to students
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="org_name">Organization Name</Label>
          <Input
            id="org_name"
            value={formData.org_name}
            onChange={(e) => setFormData({ ...formData, org_name: e.target.value })}
            placeholder="Happy English Club"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="org_address">Organization Address</Label>
          <Textarea
            id="org_address"
            value={formData.org_address}
            onChange={(e) => setFormData({ ...formData, org_address: e.target.value })}
            placeholder="Enter your organization's address"
            rows={3}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="bank_name">Bank Name</Label>
            <Input
              id="bank_name"
              value={formData.bank_name}
              onChange={(e) => setFormData({ ...formData, bank_name: e.target.value })}
              placeholder="Sacombank"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="account_name">Account Name</Label>
            <Input
              id="account_name"
              value={formData.account_name}
              onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
              placeholder="Nguyen Thi Thu Huong"
            />
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="account_number">Account Number</Label>
          <Input
            id="account_number"
            value={formData.account_number}
            onChange={(e) => setFormData({ ...formData, account_number: e.target.value })}
            placeholder="020975679889"
          />
        </div>

        <Button onClick={handleSave} disabled={saving} className="w-full md:w-auto">
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}
