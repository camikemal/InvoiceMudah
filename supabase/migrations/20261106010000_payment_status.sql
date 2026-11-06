-- ============================================================
-- Migration: 20261106010000_payment_status
-- Payment tracking on invoices + link between converted documents
-- ============================================================

ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'UNPAID',
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS paid_at date,
  ADD COLUMN IF NOT EXISTS amount_paid numeric(10,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source_invoice_id uuid
    REFERENCES public.invoices (id) ON DELETE SET NULL;

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_status_check;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_status_check
  CHECK (status IN ('DRAFT', 'UNPAID', 'PARTIAL', 'PAID', 'CANCELLED'));

ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_amount_paid_non_negative;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_amount_paid_non_negative CHECK (amount_paid >= 0);

-- Backfill existing rows: receipts are paid, quotations are drafts.
UPDATE public.invoices
  SET status = 'PAID', amount_paid = total, paid_at = invoice_date
  WHERE document_type = 'RECEIPT' AND status = 'UNPAID';

UPDATE public.invoices
  SET status = 'DRAFT'
  WHERE document_type = 'QUOTATION' AND status = 'UNPAID';

CREATE INDEX IF NOT EXISTS invoices_status_idx
  ON public.invoices (business_id, status);
CREATE INDEX IF NOT EXISTS invoices_source_idx
  ON public.invoices (source_invoice_id);
