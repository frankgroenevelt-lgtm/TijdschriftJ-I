-- =============================================================
--  Tabel voor inzendingen huwelijkstijdschrift Jonathan & Iris
-- =============================================================
create table if not exists public.submissions (
  id            uuid primary key default gen_random_uuid(),
  name          text        not null,
  email         text        not null,
  category      text        not null,
  filename      text        not null,
  drive_file_id text,
  created_at    timestamptz not null default now()
);

create index if not exists submissions_created_at_idx
  on public.submissions (created_at desc);

-- Row Level Security aanzetten. We staan GEEN toegang toe via de
-- publieke anon-key: alle lees/schrijfacties lopen via Edge Functions
-- die de service-role key gebruiken (die RLS omzeilt).
alter table public.submissions enable row level security;

-- (Expres geen policies: anon/authenticated krijgen dus geen toegang.
--  De Edge Functions gebruiken de service-role key en hebben die niet nodig.)
