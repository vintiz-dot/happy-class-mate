-- Add RLS policy for authenticated users to view bank info
-- Students need to see payment details on invoices
CREATE POLICY "Authenticated users can view bank info"
ON bank_info FOR SELECT
TO authenticated
USING (true);