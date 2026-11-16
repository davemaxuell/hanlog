-- Demo-day social layer: public leaderboards, Korean photo moments, and comparison groups.
alter table hanlog.users add column show_on_leaderboard boolean not null default true;

alter table hanlog.point_events drop constraint point_events_reason_check;
alter table hanlog.point_events add constraint point_events_reason_check
  check (reason in ('mission','peer_response','peer_rating','peer_feedback','post'));
create index point_events_created on hanlog.point_events (created_at);

create table hanlog.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references hanlog.users(id) on delete cascade,
  korean text not null,
  meaning_en text not null,
  note text not null default '',
  image_path text,
  width int not null check (width > 0),
  height int not null check (height > 0),
  status text not null default 'visible' check (status in ('visible','hidden')),
  created_at timestamptz not null default now()
);
create index posts_feed on hanlog.posts (created_at desc, id desc);
create index posts_author on hanlog.posts (author_id, created_at desc);

create table hanlog.post_likes (
  post_id uuid not null references hanlog.posts(id) on delete cascade,
  user_id uuid not null references hanlog.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);
create index post_likes_user on hanlog.post_likes (user_id);

create table hanlog.post_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references hanlog.users(id) on delete cascade,
  post_id uuid not null references hanlog.posts(id) on delete cascade,
  reason text not null check (reason in ('harassment','inappropriate','spam','privacy','other')),
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique (reporter_id, post_id)
);
create index post_reports_post on hanlog.post_reports (post_id);
create index post_reports_reporter_created on hanlog.post_reports (reporter_id, created_at);

create table hanlog.groups (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  owner_id uuid not null references hanlog.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index groups_owner_created on hanlog.groups (owner_id, created_at);

create table hanlog.group_members (
  group_id uuid not null references hanlog.groups(id) on delete cascade,
  user_id uuid not null references hanlog.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index group_members_user on hanlog.group_members (user_id);

alter table hanlog.posts enable row level security;
alter table hanlog.post_likes enable row level security;
alter table hanlog.post_reports enable row level security;
alter table hanlog.groups enable row level security;
alter table hanlog.group_members enable row level security;
