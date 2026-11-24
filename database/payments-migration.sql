-- Migration idempotente para activar el panel de pagos.
-- Solo crea el libro de movimientos y su operación transaccional; no borra datos.
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
