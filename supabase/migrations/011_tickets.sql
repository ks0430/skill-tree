-- Tickets table for tracking project work items
create table if not exists public.tickets (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,           -- e.g. "T1", "T2"
  title text not null,
  description text,
  complexity integer default 1,
  status text not null default 'todo' check (status in ('todo', 'in_progress', 'done')),
  files text[] default '{}',          -- affected file paths
  dependencies text[] default '{}',   -- keys of dependent tickets
  acceptance_criteria text[] default '{}',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Auto-update updated_at
create or replace function update_tickets_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tickets_updated_at
  before update on public.tickets
  for each row execute function update_tickets_updated_at();

-- Enable RLS (open read for now, restrict write later if needed)
alter table public.tickets enable row level security;

create policy "Tickets are viewable by everyone"
  on public.tickets for select
  using (true);

create policy "Tickets are editable by authenticated users"
  on public.tickets for all
  using (auth.role() = 'authenticated');
