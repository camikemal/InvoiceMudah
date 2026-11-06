-- ============================================================
-- Migration: 20261106030000_business_defaults
-- Per-business type and invoice defaults, so the app is not
-- hardcoded to homestay wording.
-- ============================================================

ALTER TABLE public.businesses
  ADD COLUMN IF NOT EXISTS business_type text NOT NULL DEFAULT 'HOMESTAY',
  ADD COLUMN IF NOT EXISTS default_description text,
  ADD COLUMN IF NOT EXISTS default_due_days int NOT NULL DEFAULT 0;

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_type_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_type_check
  CHECK (business_type IN ('HOMESTAY', 'RETAIL', 'SERVICE', 'FOOD', 'OTHER'));

ALTER TABLE public.businesses
  DROP CONSTRAINT IF EXISTS businesses_due_days_check;
ALTER TABLE public.businesses
  ADD CONSTRAINT businesses_due_days_check
  CHECK (default_due_days >= 0 AND default_due_days <= 365);

-- Existing businesses were all homestays: keep their current behaviour.
UPDATE public.businesses
  SET default_description = E'Check in  :\nCheck out :'
  WHERE default_description IS NULL AND business_type = 'HOMESTAY';
