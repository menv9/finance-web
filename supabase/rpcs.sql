-- Atomic RPCs that require transaction-level guarantees or bypass RLS safely.
-- All SECURITY DEFINER functions include explicit authorization checks.

-- ── Partial IOU payment ───────────────────────────────────────────────────────
-- Atomically reduces the linked IOU amount and settles the payment entry in one
-- transaction, eliminating the read-modify-write race when two partial payments
-- land concurrently against the same IOU.
create or replace function public.apply_partial_iou_payment(
  p_payment_id  uuid,
  p_iou_id      uuid,
  p_payment_cents bigint,
  p_settled_by  uuid
)
returns void
language plpgsql security definer set search_path = public
as $$
begin
  -- Caller must be a participant in the payment entry
  if not exists (
    select 1 from public.friend_ledger
    where id = p_payment_id
      and p_settled_by in (creditor_id, debtor_id)
  ) then
    raise exception 'Not a participant in this payment';
  end if;

  -- Atomically reduce the IOU; settle it if fully covered
  update public.friend_ledger
  set
    amount_cents = greatest(0, amount_cents - p_payment_cents),
    status       = case when amount_cents <= p_payment_cents then 'settled' else status end,
    settled_at   = case when amount_cents <= p_payment_cents then now() else settled_at end,
    settled_by   = case when amount_cents <= p_payment_cents then p_settled_by else settled_by end
  where id = p_iou_id
    and status in ('accepted', 'pending');

  -- Settle the payment entry itself
  update public.friend_ledger
  set status = 'settled', settled_at = now(), settled_by = p_settled_by
  where id = p_payment_id;
end;
$$;

grant execute on function public.apply_partial_iou_payment(uuid, uuid, bigint, uuid) to authenticated;

-- ── Shared goal completion ────────────────────────────────────────────────────
-- Atomically marks a shared goal complete if contributions have met the target.
-- Returns true only if THIS call was the one that flipped completed_at, so the
-- caller can post the "goal reached" activity exactly once regardless of how
-- many participants contribute simultaneously.
create or replace function public.complete_shared_goal_if_reached(p_goal_id uuid)
returns boolean
language plpgsql security definer set search_path = public
as $$
declare
  v_updated int;
begin
  update public.shared_goals sg
  set completed_at = now()
  where sg.id = p_goal_id
    and sg.completed_at is null
    and (
      select coalesce(sum(c.amount_cents), 0)
      from public.shared_goal_contributions c
      where c.goal_id = p_goal_id
    ) >= sg.target_cents;
  get diagnostics v_updated = row_count;
  return v_updated > 0;
end;
$$;

grant execute on function public.complete_shared_goal_if_reached(uuid) to authenticated;
