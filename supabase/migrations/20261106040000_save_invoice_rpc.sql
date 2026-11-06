-- ============================================================
-- Migration: 20261106040000_save_invoice_rpc
-- Create or update an invoice and its line items in ONE transaction.
-- Totals are recomputed server-side. For new invoices the user's
-- running number is advanced atomically (never moves backwards).
--
-- Runs as SECURITY INVOKER, so all existing RLS policies still apply.
-- ============================================================

CREATE OR REPLACE FUNCTION public.save_invoice(
  p_invoice jsonb,
  p_items jsonb,
  p_running_number int DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_id        uuid := nullif(p_invoice->>'id', '')::uuid;
  v_doc_type  text := coalesce(p_invoice->>'document_type', 'INVOICE');
  v_discount  numeric(10,2) := coalesce((p_invoice->>'discount')::numeric, 0);
  v_subtotal  numeric(10,2);
  v_total     numeric(10,2);
  v_status    text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'Not authenticated' USING ERRCODE = '42501';
  END IF;

  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 THEN
    RAISE EXCEPTION 'Invoice must have at least one item' USING ERRCODE = '22023';
  END IF;

  IF EXISTS (
    SELECT 1 FROM jsonb_array_elements(p_items) x
    WHERE coalesce((x->>'quantity')::numeric, 0) < 0
       OR coalesce((x->>'price')::numeric, 0) < 0
  ) OR v_discount < 0 THEN
    RAISE EXCEPTION 'Quantity, price and discount cannot be negative' USING ERRCODE = '22023';
  END IF;

  IF v_id IS NULL AND NOT EXISTS (
    SELECT 1 FROM public.businesses b
    WHERE b.id = (p_invoice->>'business_id')::uuid AND b.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Business not found' USING ERRCODE = 'P0002';
  END IF;

  IF nullif(p_invoice->>'customer_id', '') IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.customers c
    WHERE c.id = (p_invoice->>'customer_id')::uuid AND c.user_id = v_uid
  ) THEN
    RAISE EXCEPTION 'Customer not found' USING ERRCODE = 'P0002';
  END IF;

  SELECT coalesce(sum(round(coalesce((x->>'quantity')::numeric, 0) * coalesce((x->>'price')::numeric, 0), 2)), 0)
    INTO v_subtotal
    FROM jsonb_array_elements(p_items) x;

  v_total := greatest(v_subtotal - v_discount, 0);

  v_status := coalesce(
    nullif(p_invoice->>'status', ''),
    CASE v_doc_type WHEN 'RECEIPT' THEN 'PAID' WHEN 'QUOTATION' THEN 'DRAFT' ELSE 'UNPAID' END
  );

  IF v_id IS NULL THEN
    INSERT INTO public.invoices (
      user_id, business_id, invoice_number, document_type,
      customer_id, customer_name, customer_phone, customer_email,
      description, discount, subtotal, total, invoice_date,
      status, due_date, paid_at, amount_paid, source_invoice_id
    ) VALUES (
      v_uid,
      (p_invoice->>'business_id')::uuid,
      p_invoice->>'invoice_number',
      v_doc_type,
      nullif(p_invoice->>'customer_id', '')::uuid,
      p_invoice->>'customer_name',
      p_invoice->>'customer_phone',
      nullif(p_invoice->>'customer_email', ''),
      p_invoice->>'description',
      v_discount, v_subtotal, v_total,
      coalesce((p_invoice->>'invoice_date')::date, current_date),
      v_status,
      nullif(p_invoice->>'due_date', '')::date,
      CASE WHEN v_status = 'PAID'
        THEN coalesce(nullif(p_invoice->>'paid_at', '')::date, current_date)
        ELSE nullif(p_invoice->>'paid_at', '')::date END,
      CASE WHEN v_status = 'PAID' THEN v_total
        ELSE coalesce((p_invoice->>'amount_paid')::numeric, 0) END,
      nullif(p_invoice->>'source_invoice_id', '')::uuid
    )
    RETURNING id INTO v_id;

    IF p_running_number IS NOT NULL THEN
      INSERT INTO public.user_settings (user_id, last_invoice_number)
      VALUES (v_uid, p_running_number)
      ON CONFLICT (user_id) DO UPDATE
        SET last_invoice_number = greatest(public.user_settings.last_invoice_number, EXCLUDED.last_invoice_number);
    END IF;
  ELSE
    UPDATE public.invoices SET
      invoice_number = p_invoice->>'invoice_number',
      document_type  = v_doc_type,
      customer_id    = nullif(p_invoice->>'customer_id', '')::uuid,
      customer_name  = p_invoice->>'customer_name',
      customer_phone = p_invoice->>'customer_phone',
      customer_email = nullif(p_invoice->>'customer_email', ''),
      description    = p_invoice->>'description',
      discount       = v_discount,
      subtotal       = v_subtotal,
      total          = v_total,
      invoice_date   = coalesce((p_invoice->>'invoice_date')::date, invoice_date),
      status         = v_status,
      due_date       = nullif(p_invoice->>'due_date', '')::date,
      paid_at        = CASE WHEN v_status = 'PAID'
                         THEN coalesce(nullif(p_invoice->>'paid_at', '')::date, paid_at, current_date)
                         ELSE nullif(p_invoice->>'paid_at', '')::date END,
      amount_paid    = CASE WHEN v_status = 'PAID' THEN v_total
                         ELSE coalesce((p_invoice->>'amount_paid')::numeric, amount_paid) END
    WHERE id = v_id AND user_id = v_uid;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Invoice not found' USING ERRCODE = 'P0002';
    END IF;

    DELETE FROM public.invoice_items WHERE invoice_id = v_id;
  END IF;

  INSERT INTO public.invoice_items (invoice_id, item_name, quantity, price, total, sort_order)
  SELECT
    v_id,
    coalesce(x->>'item_name', ''),
    coalesce((x->>'quantity')::numeric, 0),
    coalesce((x->>'price')::numeric, 0),
    round(coalesce((x->>'quantity')::numeric, 0) * coalesce((x->>'price')::numeric, 0), 2),
    (ord - 1)::int
  FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(x, ord);

  RETURN v_id;
END;
$$;

REVOKE ALL ON FUNCTION public.save_invoice(jsonb, jsonb, int) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.save_invoice(jsonb, jsonb, int) TO authenticated;
