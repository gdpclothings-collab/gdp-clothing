create index if not exists finance_journal_entries_reversed_by_entry_idx on public.finance_journal_entries(reversed_by_entry_id) where reversed_by_entry_id is not null;
create index if not exists finance_journal_entries_reversed_by_actor_idx on public.finance_journal_entries(reversed_by) where reversed_by is not null;
