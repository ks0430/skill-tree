-- Skill Trees
create table skill_trees (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  theme text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table skill_trees enable row level security;
create policy "Users can CRUD own trees" on skill_trees
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Skill Nodes
create table skill_nodes (
  id text not null,
  tree_id uuid not null references skill_trees(id) on delete cascade,
  label text not null,
  description text,
  status text not null default 'locked' check (status in ('locked', 'in_progress', 'completed')),
  priority integer not null default 3,
  position_x double precision not null default 0,
  position_y double precision not null default 0,
  icon text,
  metadata jsonb,
  primary key (id, tree_id)
);

alter table skill_nodes enable row level security;
create policy "Users can CRUD own nodes" on skill_nodes
  for all using (
    tree_id in (select id from skill_trees where user_id = auth.uid())
  ) with check (
    tree_id in (select id from skill_trees where user_id = auth.uid())
  );

-- Skill Edges
create table skill_edges (
  id text not null,
  tree_id uuid not null references skill_trees(id) on delete cascade,
  source_id text not null,
  target_id text not null,
  label text,
  metadata jsonb,
  primary key (id, tree_id)
);

alter table skill_edges enable row level security;
create policy "Users can CRUD own edges" on skill_edges
  for all using (
    tree_id in (select id from skill_trees where user_id = auth.uid())
  ) with check (
    tree_id in (select id from skill_trees where user_id = auth.uid())
  );

-- Chat Messages
create table chat_messages (
  id uuid primary key default gen_random_uuid(),
  tree_id uuid not null references skill_trees(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null default '',
  tool_calls jsonb,
  created_at timestamptz not null default now()
);

alter table chat_messages enable row level security;
create policy "Users can CRUD own messages" on chat_messages
  for all using (
    tree_id in (select id from skill_trees where user_id = auth.uid())
  ) with check (
    tree_id in (select id from skill_trees where user_id = auth.uid())
  );

-- Auto-update updated_at
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger skill_trees_updated_at
  before update on skill_trees
  for each row execute function update_updated_at();
