alter table public.dataset_records
  add column if not exists feature_vector jsonb;

comment on column public.dataset_records.feature_vector is
  'Normalized image feature vector used for cosine-similarity dataset matching.';
