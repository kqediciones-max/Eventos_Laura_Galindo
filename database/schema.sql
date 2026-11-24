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

-- Documentos internos de venta. Conservan una copia de la cotización confirmada.
create table if not exists public.sales_documents (
  id uuid primary key default gen_random_uuid(),
  quote_id uuid not null unique references public.quotes(id) on delete restrict,
  sale_number text not null unique,
  recipient_name text not null,
  phone text not null default '', customer_document text not null default '', email text not null default '',
  event_name text not null default '', event_date date not null, city text not null default '',
  reserved_from date not null, reserved_until date not null,
  comments text not null default '', items jsonb not null check (jsonb_typeof(items) = 'array'),
  subtotal bigint not null check (subtotal >= 0), discount_percent numeric(5,2) not null default 0,
  discount_amount bigint not null default 0, iva_percent numeric(5,2) not null default 0, iva_amount bigint not null default 0,
  tax_type text not null default '', tax_percent numeric(5,2) not null default 0, tax_amount bigint not null default 0,
  total bigint not null check (total >= 0), payment_method text not null default '', deposit text not null default '',
  status text not null default 'active' check (status in ('active','annulled')),
  created_by text not null, created_at timestamptz not null default now(),
  annulled_at timestamptz, annulled_by text, annulment_reason text not null default '',
  check (reserved_until >= reserved_from)
);

create table if not exists public.sales_document_attachments (
  id uuid primary key default gen_random_uuid(),
  sales_document_id uuid not null references public.sales_documents(id) on delete restrict,
  object_path text not null unique, file_name text not null, content_type text not null,
  created_by text not null, created_at timestamptz not null default now()
);

alter table public.sales_documents enable row level security;
alter table public.sales_document_attachments enable row level security;
revoke all on public.sales_documents, public.sales_document_attachments from anon, authenticated;
grant all on public.sales_documents, public.sales_document_attachments to service_role;

create or replace function public.protect_sales_document() returns trigger
language plpgsql set search_path = public as $$
begin
  if tg_op = 'DELETE' then raise exception 'Los documentos de venta no se eliminan.'; end if;
  if old.status = 'annulled' then raise exception 'El documento anulado es inmutable.'; end if;
  if new.status <> 'annulled'
     or (to_jsonb(new) - array['status','annulled_at','annulled_by','annulment_reason'])
        <> (to_jsonb(old) - array['status','annulled_at','annulled_by','annulment_reason'])
     or new.annulled_at is null or new.annulled_by is null or length(trim(new.annulment_reason)) = 0 then
    raise exception 'Solo se permite anular un documento con motivo.';
  end if;
  return new;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'sales_documents_immutable' and tgrelid = 'public.sales_documents'::regclass) then
    create trigger sales_documents_immutable before update or delete on public.sales_documents for each row execute function public.protect_sales_document();
  end if;
end $$;

create or replace function public.protect_linked_quote_delete() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.sales_documents where quote_id = old.id) then
    raise exception 'La cotización tiene un documento de venta asociado y no se puede eliminar.';
  end if;
  return old;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'quotes_sales_document_delete_guard' and tgrelid = 'public.quotes'::regclass) then
    create trigger quotes_sales_document_delete_guard before delete on public.quotes for each row execute function public.protect_linked_quote_delete();
  end if;
end $$;

create or replace function public.protect_linked_quote_update() returns trigger
language plpgsql set search_path = public as $$
begin
  if exists (select 1 from public.sales_documents where quote_id = old.id) then
    raise exception 'La cotización tiene un documento de venta asociado y no se puede editar.';
  end if;
  return new;
end;
$$;
do $$ begin
  if not exists (select 1 from pg_trigger where tgname = 'quotes_sales_document_update_guard' and tgrelid = 'public.quotes'::regclass) then
    create trigger quotes_sales_document_update_guard before update on public.quotes for each row execute function public.protect_linked_quote_update();
  end if;
end $$;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('sales-doc-attachments', 'sales-doc-attachments', false, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

-- Libro de movimientos asociados a los documentos internos de venta.
create table if not exists public.sales_document_movements (
  id uuid primary key default gen_random_uuid(),
  sales_document_id uuid not null references public.sales_documents(id) on delete restrict,
  movement_type text not null check (movement_type in ('installment','full_payment','refund','additional_charge')),
  amount bigint not null check (amount > 0),
  movement_date date not null,
  note text not null default '',
  created_by text not null,
  created_at timestamptz not null default now()
);
create index if not exists sales_document_movements_sale_date_idx
  on public.sales_document_movements (sales_document_id, movement_date desc, created_at desc);
alter table public.sales_document_movements enable row level security;
revoke all on public.sales_document_movements from anon, authenticated;
grant all on public.sales_document_movements to service_role;

create or replace function public.admin_add_sales_document_movement(
  p_sales_document_id uuid,
  p_movement_type text,
  p_amount bigint,
  p_movement_date date,
  p_note text,
  p_created_by text
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  target_sale public.sales_documents;
  paid_amount bigint;
  refund_amount bigint;
  charge_amount bigint;
  current_balance bigint;
  net_paid bigint;
  saved_movement public.sales_document_movements;
begin
  if p_movement_type not in ('installment','full_payment','refund','additional_charge') or p_amount is null or p_amount <= 0 then
    raise exception 'Tipo o valor del movimiento no válido.';
  end if;
  select * into target_sale from public.sales_documents where id = p_sales_document_id for update;
  if not found then raise exception 'No se encontró el documento de venta.'; end if;
  if target_sale.status <> 'active' then raise exception 'No se pueden registrar movimientos en un documento anulado.'; end if;

  select coalesce(sum(amount) filter (where movement_type in ('installment','full_payment')),0),
         coalesce(sum(amount) filter (where movement_type = 'refund'),0),
         coalesce(sum(amount) filter (where movement_type = 'additional_charge'),0)
    into paid_amount, refund_amount, charge_amount
    from public.sales_document_movements where sales_document_id = p_sales_document_id;
  current_balance := target_sale.total + charge_amount + refund_amount - paid_amount;
  net_paid := paid_amount - refund_amount;

  if p_movement_type = 'installment' and p_amount > current_balance then
    raise exception 'El abono supera el saldo pendiente de % COP.', to_char(current_balance,'FM999G999G999G990');
  end if;
  if p_movement_type = 'full_payment' and current_balance <= 0 then
    raise exception 'Esta factura no tiene saldo pendiente para registrar un pago total.';
  end if;
  if p_movement_type = 'full_payment' and p_amount <> current_balance then
    raise exception 'El pago total debe ser exactamente el saldo actual: % COP.', to_char(current_balance,'FM999G999G999G990');
  end if;
  if p_movement_type = 'refund' and p_amount > net_paid then
    raise exception 'La devolución supera el valor recibido neto de % COP.', to_char(net_paid,'FM999G999G999G990');
  end if;

  insert into public.sales_document_movements(sales_document_id,movement_type,amount,movement_date,note,created_by)
    values(p_sales_document_id,p_movement_type,p_amount,p_movement_date,coalesce(p_note,''),p_created_by)
    returning * into saved_movement;
  return to_jsonb(saved_movement);
end;
$$;
revoke all on function public.admin_add_sales_document_movement(uuid,text,bigint,date,text,text) from public, anon, authenticated;
grant execute on function public.admin_add_sales_document_movement(uuid,text,bigint,date,text,text) to service_role;
