-- ============================================================
-- Migration: 20261106000000_invoice_integrity
-- Prevent duplicate invoice numbers, add numeric sanity checks,
-- and expose an atomic "next running number" helper.
-- ============================================================

-- 1. Unique invoice number per user.
--    Skipped (with a notice) if existing data already has duplicates,
--    so the migration never fails on legacy rows. Fix duplicates and
--    re-run the CREATE UNIQUE INDEX manually in that case.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM public.invoices
    GROUP BY user_id, invoice_number
    HAVING count(*) > 1
  ) THEN
    RAISE NOTICE 'Duplicate invoice numbers exist; unique index invoices_user_number_key NOT created.';
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS invoices_user_number_key
      ON public.invoices (user_id, invoice_number);
  END IF;
END $$;

-- 2. Numeric sanity checks (NOT VALID = only enforced for new/updated rows)
ALTER TABLE public.invoices
  DROP CONSTRAINT IF EXISTS invoices_amounts_non_negative;
ALTER TABLE public.invoices
  ADD CONSTRAINT invoices_amounts_non_negative
  CHECK (discount >= 0 AND subtotal >= 0 AND total >= 0) NOT VALID;

ALTER TABLE public.invoice_items
  DROP CONSTRAINT IF EXISTS invoice_items_amounts_non_negative;
ALTER TABLE public.invoice_items
  ADD CONSTRAINT invoice_items_amounts_non_negative
  CHECK (quantity >= 0 AND price >= 0 AND total >= 0) NOT VALID;

-- 3. Missing UPDATE policy on invoice_items
DROP POLICY IF EXISTS "Users can update own invoice items" ON public.invoice_items;
CREATE POLICY "Users can update own invoice items"
  ON public.invoice_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.invoices i
      WHERE i.id = invoice_id AND i.user_id = auth.uid()
    )
  );

-- 4. Helpful indexes for listing / filtering
CREATE INDEX IF NOT EXISTS invoices_business_date_idx
  ON public.invoices (business_id, invoice_date DESC);
CREATE INDEX IF NOT EXISTS invoice_items_invoice_idx
  ON public.invoice_items (invoice_id, sort_order);

-- 5. Next running number for the current user (read-only helper).
--    The counter itself is advanced atomically inside save_invoice().
CREATE OR REPLACE FUNCTION public.next_invoice_number()
RETURNS int
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT coalesce(
    (SELECT last_invoice_number FROM public.user_settings WHERE user_id = auth.uid()),
    0
  ) + 1;
$$;

GRANT EXECUTE ON FUNCTION public.next_invoice_number() TO authenticated;
