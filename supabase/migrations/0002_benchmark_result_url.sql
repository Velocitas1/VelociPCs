-- Add nullable 3DMark result_url column to public.benchmarks (zero RLS changes)
alter table public.benchmarks
  add column if not exists result_url text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'benchmarks_result_url_3dmark_check'
      and conrelid = 'public.benchmarks'::regclass
  ) then
    alter table public.benchmarks
      add constraint benchmarks_result_url_3dmark_check
      check (
        result_url is null
        or result_url ~* '^https?://(www\.)?3dmark\.com/[^[:space:]]+$'
      );
  end if;
end;
$$;
