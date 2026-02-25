insert into storage.buckets (id, name, public)
values ('classification-images', 'classification-images', true)
on conflict (id) do nothing;

create policy "public read classification images"
  on storage.objects
  for select
  using (bucket_id = 'classification-images');
