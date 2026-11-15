create table hanlog.pending_media_deletions (
  path text primary key,
  created_at timestamptz not null default now()
);
create index pending_media_deletions_created on hanlog.pending_media_deletions (created_at);
alter table hanlog.pending_media_deletions enable row level security;
