-- Ejecutar una vez en Supabase SQL Editor.
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
  event_date date,
  city text not null default '',
  comments text not null default '',
  items jsonb not null check (jsonb_typeof(items) = 'array'),
  total bigint not null check (total >= 0),
  created_by text not null,
  created_at timestamptz not null default now()
);

alter table public.quote_requests enable row level security;
alter table public.quotes enable row level security;

revoke all on public.quote_requests from anon, authenticated;
revoke all on public.quotes from anon, authenticated;
grant all on public.quote_requests to service_role;
grant all on public.quotes to service_role;

create or replace function public.admin_create_quote(
  p_request_id uuid,
  p_quote_number text,
  p_recipient_name text,
  p_phone text,
  p_event_date date,
  p_city text,
  p_comments text,
  p_items jsonb,
  p_total bigint,
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
    request_id, quote_number, recipient_name, phone, event_date,
    city, comments, items, total, created_by
  ) values (
    p_request_id, p_quote_number, p_recipient_name, coalesce(p_phone, ''),
    p_event_date, coalesce(p_city, ''), coalesce(p_comments, ''),
    p_items, p_total, p_created_by
  ) returning * into saved_quote;

  if p_request_id is not null then
    update public.quote_requests
      set status = 'quoted', updated_at = now()
      where id = p_request_id;
  end if;

  return to_jsonb(saved_quote);
end;
$$;

revoke all on function public.admin_create_quote(uuid, text, text, text, date, text, text, jsonb, bigint, text) from public, anon, authenticated;
grant execute on function public.admin_create_quote(uuid, text, text, text, date, text, text, jsonb, bigint, text) to service_role;
