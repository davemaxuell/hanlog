create schema if not exists hanlog;

create table hanlog.users (
  id uuid primary key default gen_random_uuid(),
  nickname text not null,
  role text not null check (role in ('learner','korean')),
  ip_hash text not null,
  created_at timestamptz not null default now()
);

create table hanlog.attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hanlog.users(id) on delete cascade,
  mission_id text not null,
  overall int not null, pronunciation int not null, accuracy int not null, usage int not null,
  heard text not null,
  feedback jsonb not null,               -- { issues, praise, nextTip }
  scored_by text not null check (scored_by in ('ai','mock')),
  points_awarded int not null default 0,
  created_at timestamptz not null default now()
);
create index attempts_user_mission on hanlog.attempts (user_id, mission_id);

create table hanlog.scoring_calls (
  id bigint generated always as identity primary key,
  user_id uuid not null,
  ip_hash text not null,
  outcome text not null default 'pending' check (outcome in ('pending','scored','no_speech','failed')),
  created_at timestamptz not null default now()
);
create index scoring_calls_created on hanlog.scoring_calls (created_at);

create table hanlog.point_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references hanlog.users(id) on delete cascade,
  delta int not null,
  reason text not null check (reason in ('mission','peer_response','peer_rating','peer_feedback')),
  ref_id text not null,
  label text not null,
  created_at timestamptz not null default now()
);
create index point_events_user on hanlog.point_events (user_id, created_at desc);

create table hanlog.challenges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  author_id uuid not null references hanlog.users(id) on delete cascade,
  korean text not null,
  meaning_en text not null,
  situation_en text not null default '',
  reference_path text,
  reference_mime text,
  is_sample boolean not null default false,
  status text not null default 'open' check (status in ('open','hidden')),
  created_at timestamptz not null default now()
);

create table hanlog.challenge_responses (
  id uuid primary key default gen_random_uuid(),
  challenge_id uuid not null references hanlog.challenges(id) on delete cascade,
  responder_id uuid not null references hanlog.users(id) on delete cascade,
  media_path text,
  media_kind text not null check (media_kind in ('audio','video')),
  media_mime text not null,
  duration_ms int not null,
  status text not null default 'pending' check (status in ('pending','rated')),
  flagged boolean not null default false,
  rater_id uuid references hanlog.users(id) on delete set null,
  rating_pronunciation int check (rating_pronunciation between 1 and 5),
  rating_naturalness int check (rating_naturalness between 1 and 5),
  rating_comment text,
  rated_at timestamptz,
  feedback_helpfulness int check (feedback_helpfulness between 1 and 5),
  feedback_comment text,
  feedback_at timestamptz,
  created_at timestamptz not null default now(),
  unique (challenge_id, responder_id)
);

alter table hanlog.users enable row level security;
alter table hanlog.attempts enable row level security;
alter table hanlog.scoring_calls enable row level security;
alter table hanlog.point_events enable row level security;
alter table hanlog.challenges enable row level security;
alter table hanlog.challenge_responses enable row level security;
