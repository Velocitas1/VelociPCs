-- Add unified PassMark scoring columns to public.cpus and public.gpus (zero RLS changes)
-- Legacy cpus.rank, gpus.rank, and computers.overall_rank are preserved non-destructively while migrating.

alter table public.cpus
  add column if not exists passmark_score integer,
  add column if not exists score_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'cpus_passmark_score_positive_check'
      and conrelid = 'public.cpus'::regclass
  ) then
    alter table public.cpus
      add constraint cpus_passmark_score_positive_check
      check (passmark_score is null or passmark_score > 0);
  end if;
end;
$$;

alter table public.gpus
  add column if not exists passmark_score integer,
  add column if not exists score_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'gpus_passmark_score_positive_check'
      and conrelid = 'public.gpus'::regclass
  ) then
    alter table public.gpus
      add constraint gpus_passmark_score_positive_check
      check (passmark_score is null or passmark_score > 0);
  end if;
end;
$$;
