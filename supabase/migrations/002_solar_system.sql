-- Add role and parent_id to skill_nodes for solar system hierarchy
alter table skill_nodes add column if not exists role text not null default 'planet' check (role in ('stellar', 'planet', 'satellite'));
alter table skill_nodes add column if not exists parent_id text;
