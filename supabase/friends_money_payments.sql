-- Migration: add 'payment' kind to friend_ledger.
-- Run after friends_money.sql.

alter table public.friend_ledger drop constraint if exists friend_ledger_kind_check;
alter table public.friend_ledger add constraint friend_ledger_kind_check
  check (kind in ('split', 'request', 'manual', 'payment'));
