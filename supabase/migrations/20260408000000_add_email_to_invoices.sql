-- ============================================================
-- Migration: 20260408000000_add_email_to_invoices
-- Adds nullable email column to invoices table
-- ============================================================

alter table public.invoices add column customer_email text;

-- Add comment for documentation
comment on column public.invoices.customer_email is 'Optional customer email address';
