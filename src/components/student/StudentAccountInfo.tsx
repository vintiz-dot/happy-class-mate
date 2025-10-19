import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Users, Building2, Mail, Phone, MapPin } from "lucide-react";

interface StudentAccountInfoProps {
  studentId: string;
}

/**
 * Read-only account information from cloud DB
 * Respects RLS - students can only see their own data
 */
export function StudentAccountInfo({ studentId }: StudentAccountInfoProps) {
  const { data: studentData, isLoading: studentLoading } = useQuery({
    queryKey: ['student-account-info', studentId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('students')
        .select(`
          id,
          full_name,
          email,
          phone,
          date_of_birth,
          family:families(
            id,
            name,
            email,
            phone,
            address
          ),
          enrollments(
            id,
            class:classes(
              id,
              name
            )
          )
        `)
        .eq('id', studentId)
        .single();

      if (error) throw error;
      return data;
    },
  });

  const { data: bankInfo, isLoading: bankLoading } = useQuery({
    queryKey: ['bank-info'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('bank_info')
        .select('*')
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
  });

  if (studentLoading || bankLoading) {
    return (
      <div className="space-y-4">
        <div className="animate-pulse">
          <div className="h-32 bg-muted rounded-lg" />
        </div>
      </div>
    );
  }

  const family = studentData?.family ? (Array.isArray(studentData.family) ? studentData.family[0] : studentData.family) : null;
  const classes = studentData?.enrollments?.map(e => {
    const classData = e.class ? (Array.isArray(e.class) ? e.class[0] : e.class) : null;
    return classData?.name;
  }).filter(Boolean) || [];

  return (
    <div className="space-y-6">
      {/* Student Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5" />
            Student Information
          </CardTitle>
          <CardDescription>Personal details and enrollment</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Full Name</p>
              <p className="font-medium">{studentData?.full_name}</p>
            </div>
            
            {studentData?.date_of_birth && (
              <div>
                <p className="text-sm text-muted-foreground">Date of Birth</p>
                <p className="font-medium">
                  {new Date(studentData.date_of_birth).toLocaleDateString('en-US', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            )}
            
            {studentData?.email && (
              <div className="flex items-start gap-2">
                <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{studentData.email}</p>
                </div>
              </div>
            )}
            
            {studentData?.phone && (
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <p className="font-medium">{studentData.phone}</p>
                </div>
              </div>
            )}
          </div>

          {classes.length > 0 && (
            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground mb-2">Enrolled Classes</p>
              <div className="flex flex-wrap gap-2">
                {classes.map((className, idx) => (
                  <span key={idx} className="px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                    {className}
                  </span>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Family Information */}
      {family && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Family / Guardian Information
            </CardTitle>
            <CardDescription>Billing and contact details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Family Name</p>
                <p className="font-medium">{family.name}</p>
              </div>
              
              {family.email && (
                <div className="flex items-start gap-2">
                  <Mail className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Email</p>
                    <p className="font-medium">{family.email}</p>
                  </div>
                </div>
              )}
              
              {family.phone && (
                <div className="flex items-start gap-2">
                  <Phone className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Phone</p>
                    <p className="font-medium">{family.phone}</p>
                  </div>
                </div>
              )}
              
              {family.address && (
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Address</p>
                    <p className="font-medium whitespace-pre-line">{family.address}</p>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bank Information (Read-only) */}
      {bankInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Payment Information
            </CardTitle>
            <CardDescription>Bank details for tuition payment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {bankInfo.org_name && (
              <div>
                <p className="text-sm text-muted-foreground">Organization</p>
                <p className="font-medium">{bankInfo.org_name}</p>
              </div>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Bank Name</p>
                <p className="font-medium">{bankInfo.bank_name}</p>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground">Account Number</p>
                <p className="font-mono font-medium">{bankInfo.account_number}</p>
              </div>
              
              <div className="md:col-span-2">
                <p className="text-sm text-muted-foreground">Account Name</p>
                <p className="font-medium">{bankInfo.account_name}</p>
              </div>
            </div>

            <div className="pt-4 border-t">
              <p className="text-xs text-muted-foreground">
                Use these details for bank transfer payments. Please include your student name and invoice number as reference.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
