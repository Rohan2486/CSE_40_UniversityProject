create policy "public read classifications"
  on public.classifications
  for select
  using (true);
