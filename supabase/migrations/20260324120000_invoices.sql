-- ============================================================
-- Migration: 20260324120000_invoices
-- Creates businesses, invoices, invoice_items tables with RLS
-- ============================================================

-- ─── 1. businesses ───────────────────────────────────────────
-- Stores each user's business profile (name, location, etc.)
create table if not exists public.businesses (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  name           text not null,
  location       text,
  phone          text,
  -- Payment information shown on the invoice footer
  bank           text,
  account_name   text,
  account_number text,
  -- Terms & conditions shown on the invoice footer
  terms          text default 'Payment is due before the check-in date.',
  created_at     timestamptz default now() not null,
  updated_at     timestamptz default now() not null
);

alter table public.businesses enable row level security;

-- Users can only see their own business
create policy "Users can view own business"
  on public.businesses for select
  using (auth.uid() = user_id);

-- Users can insert their own business
create policy "Users can insert own business"
  on public.businesses for insert
  with check (auth.uid() = user_id);

-- Users can update their own business
create policy "Users can update own business"
  on public.businesses for update
  using (auth.uid() = user_id);

-- ─── 2. invoices ─────────────────────────────────────────────
-- Each row represents one invoice header.
create table if not exists public.invoices (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  business_id     uuid references public.businesses (id) on delete set null,
  invoice_number  text not null,           -- e.g. "INV-1049"
  customer_name   text not null,
  customer_phone  text,
  description     text,                    -- e.g. check-in / check-out text
  discount        numeric(10,2) default 0, -- optional discount amount
  subtotal        numeric(10,2) default 0,
  total           numeric(10,2) default 0,
  invoice_date    date default current_date,
  created_at      timestamptz default now() not null,
  updated_at      timestamptz default now() not null
);

alter table public.invoices enable row level security;

create policy "Users can view own invoices"
  on public.invoices for select
  using (auth.uid() = user_id);

create policy "Users can insert own invoices"
  on public.invoices for insert
  with check (auth.uid() = user_id);

create policy "Users can update own invoices"
  on public.invoices for update
  using (auth.uid() = user_id);

create policy "Users can delete own invoices"
  on public.invoices for delete
  using (auth.uid() = user_id);

-- ─── 3. invoice_items ────────────────────────────────────────
-- Each row is one line item belonging to an invoice.
create table if not exists public.invoice_items (
  id          uuid primary key default gen_random_uuid(),
  invoice_id  uuid not null references public.invoices (id) on delete cascade,
  item_name   text not null,
  quantity    numeric(10,2) default 1,
  price       numeric(10,2) default 0,
  total       numeric(10,2) default 0,     -- quantity × price (computed at insert)
  sort_order  int default 0,               -- preserves row display order
  created_at  timestamptz default now() not null
);

alter table public.invoice_items enable row level security;

-- Invoice items are accessed via the parent invoice's user_id
create policy "Users can view own invoice items"
  on public.invoice_items for select
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

create policy "Users can insert own invoice items"
  on public.invoice_items for insert
  with check (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

create policy "Users can delete own invoice items"
  on public.invoice_items for delete
  using (
    exists (
      select 1 from public.invoices i
      where i.id = invoice_id
        and i.user_id = auth.uid()
    )
  );

-- ─── 4. auto updated_at for businesses & invoices ────────────
create or replace trigger set_businesses_updated_at
  before update on public.businesses
  for each row execute procedure public.set_updated_at();

create or replace trigger set_invoices_updated_at
  before update on public.invoices
  for each row execute procedure public.set_updated_at();
