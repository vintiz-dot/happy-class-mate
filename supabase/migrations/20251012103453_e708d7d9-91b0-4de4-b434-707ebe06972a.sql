-- Create storage bucket for QR codes
INSERT INTO storage.buckets (id, name, public)
VALUES ('qr-codes', 'qr-codes', true)
ON CONFLICT (id) DO NOTHING;

-- Create storage policies for QR codes
CREATE POLICY "QR codes are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'qr-codes');

CREATE POLICY "Admins can upload QR codes"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'qr-codes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update QR codes"
ON storage.objects FOR UPDATE
USING (bucket_id = 'qr-codes' AND has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete QR codes"
ON storage.objects FOR DELETE
USING (bucket_id = 'qr-codes' AND has_role(auth.uid(), 'admin'::app_role));