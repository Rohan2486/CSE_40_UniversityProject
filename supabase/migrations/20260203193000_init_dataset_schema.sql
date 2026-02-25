create extension if not exists "pgcrypto";

create table if not exists public.breeds (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('cattle', 'buffalo')),
  name text not null unique,
  origin text,
  notes text,
  created_at timestamptz not null default now()
);

create table if not exists public.breed_traits (
  id uuid primary key default gen_random_uuid(),
  breed_id uuid not null references public.breeds(id) on delete cascade,
  trait_name text not null,
  expected_range text,
  created_at timestamptz not null default now()
);

create table if not exists public.datasets (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  source text,
  records_count integer not null default 0,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.dataset_records (
  id uuid primary key default gen_random_uuid(),
  dataset_id uuid not null references public.datasets(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table if not exists public.classifications (
  id uuid primary key default gen_random_uuid(),
  image_url text,
  type text,
  breed text,
  confidence numeric,
  traits jsonb,
  recommendations text,
  created_at timestamptz not null default now()
);

create index if not exists idx_breeds_type on public.breeds(type);
create index if not exists idx_dataset_records_dataset_id on public.dataset_records(dataset_id);
create index if not exists idx_classifications_created_at on public.classifications(created_at);

alter table public.breeds enable row level security;
alter table public.breed_traits enable row level security;
alter table public.datasets enable row level security;
alter table public.dataset_records enable row level security;
alter table public.classifications enable row level security;

create policy "public read breeds"
  on public.breeds
  for select
  using (true);

create policy "public read datasets"
  on public.datasets
  for select
  using (true);

create policy "public read dataset records"
  on public.dataset_records
  for select
  using (true);
