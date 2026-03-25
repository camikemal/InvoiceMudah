-- ============================================================
-- Migration: 20260324200000_phase2
-- Phase 2: Multi-business, running number, document type
-- ============================================================

-- 1. Drop single-business-per-user constraint
--    (users can now have multiple businesses)
ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_user_id_key;

-- 2. Add document_type to invoices
--    Supported values: 'INVOICE', 'RECEIPT', 'QUOTATION'
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS document_type text NOT NULL DEFAULT 'INVOICE'
  CHECK (document_type IN ('INVOICE', 'RECEIPT', 'QUOTATION'));

-- 3. user_settings table — stores per-user running invoice number
CREATE TABLE IF NOT EXISTS public.user_settings (
  user_id            uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  last_invoice_number int NOT NULL DEFAULT 0,
  updated_at         timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Users can only access their own settings
CREATE POLICY "Users can view own settings"
  ON public.user_settings FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own settings"
  ON public.user_settings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own settings"
  ON public.user_settings FOR UPDATE
  USING (auth.uid() = user_id);


-- Auto-update timestamp
CREATE OR REPLACE TRIGGER set_user_settings_updated_at
  BEFORE UPDATE ON public.user_settings
  FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();
