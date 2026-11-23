-- Ejecutar en Supabase SQL Editor; se puede volver a ejecutar al actualizar el esquema.
create table if not exists public.quote_requests (
  id uuid primary key default gen_random_uuid(),
  customer_name text not null check (char_length(customer_name) between 1 and 120),
  phone text not null default '',
  event_date date,
  city text not null default '',
  notes text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  status text not null default 'pending' check (status in ('pending', 'quoted', 'closed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.quotes (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references public.quote_requests(id) on delete set null,
  quote_number text not null unique,
  recipient_name text not null,
  phone text not null default '',
  customer_document text not null default '',
  email text not null default '',
  event_name text not null default '',
  event_date date,
  city text not null default '',
  validity_days integer not null default 30 check (validity_days between 1 and 365),
  comments text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal bigint not null default 0 check (subtotal >= 0),
  discount_percent numeric(5,2) not null default 0 check (discount_percent between 0 and 100),
  discount_amount bigint not null default 0 check (discount_amount >= 0),
  iva_percent numeric(5,2) not null default 0 check (iva_percent between 0 and 100),
  iva_amount bigint not null default 0 check (iva_amount >= 0),
  tax_type text not null default '',
  tax_percent numeric(5,2) not null default 0 check (tax_percent between 0 and 100),
  tax_amount bigint not null default 0 check (tax_amount >= 0),
  total bigint not null check (total >= 0),
  payment_method text not null default '',
  deposit text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);

-- Actualiza proyectos que ya ejecutaron una versión anterior del esquema.
alter table public.quotes add column if not exists customer_document text not null default '';
alter table public.quotes add column if not exists email text not null default '';
alter table public.quotes add column if not exists event_name text not null default '';
alter table public.quotes add column if not exists validity_days integer not null default 30;
alter table public.quotes add column if not exists subtotal bigint not null default 0;
alter table public.quotes add column if not exists discount_percent numeric(5,2) not null default 0;
alter table public.quotes add column if not exists discount_amount bigint not null default 0;
alter table public.quotes add column if not exists iva_percent numeric(5,2) not null default 0;
alter table public.quotes add column if not exists iva_amount bigint not null default 0;
alter table public.quotes add column if not exists tax_type text not null default '';
alter table public.quotes add column if not exists tax_percent numeric(5,2) not null default 0;
alter table public.quotes add column if not exists tax_amount bigint not null default 0;
alter table public.quotes add column if not exists payment_method text not null default '';
alter table public.quotes add column if not exists deposit text not null default '';

alter table public.quote_requests enable row level security;
alter table public.quotes enable row level security;

revoke all on public.quote_requests from anon, authenticated;
revoke all on public.quotes from anon, authenticated;
grant all on public.quote_requests to service_role;
grant all on public.quotes to service_role;

create or replace function public.admin_create_quote_v3(
  p_request_id uuid,
  p_quote_number text,
  p_recipient_name text,
  p_phone text,
  p_customer_document text,
  p_email text,
  p_event_name text,
  p_event_date date,
  p_city text,
  p_validity_days integer,
  p_comments text,
  p_items jsonb,
  p_subtotal bigint,
  p_discount_percent numeric,
  p_discount_amount bigint,
  p_iva_percent numeric,
  p_iva_amount bigint,
  p_tax_type text,
  p_tax_percent numeric,
  p_tax_amount bigint,
  p_total bigint,
  p_payment_method text,
  p_deposit text,
  p_created_by text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  saved_quote public.quotes;
begin
  insert into public.quotes (
    request_id, quote_number, recipient_name, phone, customer_document,
    email, event_name, event_date, city, validity_days, comments, items,
    subtotal, discount_percent, discount_amount, iva_percent, iva_amount,
    tax_type, tax_percent, tax_amount,
    total, payment_method, deposit, created_by
  ) values (
    p_request_id, p_quote_number, p_recipient_name, coalesce(p_phone, ''),
    coalesce(p_customer_document, ''), coalesce(p_email, ''), coalesce(p_event_name, ''),
    p_event_date, coalesce(p_city, ''), p_validity_days, coalesce(p_comments, ''),
    p_items, p_subtotal, p_discount_percent, p_discount_amount, p_iva_percent, p_iva_amount,
    coalesce(p_tax_type, ''), p_tax_percent, p_tax_amount,
    p_total, coalesce(p_payment_method, ''), coalesce(p_deposit, ''), p_created_by
  ) returning * into saved_quote;

  if p_request_id is not null then
    update public.quote_requests
      set status = 'quoted', updated_at = now()
      where id = p_request_id;
  end if;

  return to_jsonb(saved_quote);
end;
$$;

revoke all on function public.admin_create_quote_v3(uuid, text, text, text, text, text, text, date, text, integer, text, jsonb, bigint, numeric, bigint, numeric, bigint, text, numeric, bigint, bigint, text, text, text) from public, anon, authenticated;
grant execute on function public.admin_create_quote_v3(uuid, text, text, text, text, text, text, date, text, integer, text, jsonb, bigint, numeric, bigint, numeric, bigint, text, numeric, bigint, bigint, text, text, text) to service_role;
