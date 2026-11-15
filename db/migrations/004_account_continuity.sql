alter table hanlog.users add column session_version integer not null default 0 check (session_version >= 0);
alter table hanlog.users add column recovery_key_hash text;
alter table hanlog.users add column recovery_updated_at timestamptz;
create unique index users_recovery_key_hash on hanlog.users (recovery_key_hash) where recovery_key_hash is not null;

create table hanlog.recovery_attempt_limits (
  ip_hash text primary key,
  window_start timestamptz not null default now(),
  attempts integer not null default 0 check (attempts >= 0)
);
alter table hanlog.recovery_attempt_limits enable row level security;
create index recovery_attempt_limits_window on hanlog.recovery_attempt_limits (window_start);

create table hanlog.saved_missions (
  user_id uuid not null references hanlog.users(id) on delete cascade,
  mission_id text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, mission_id)
);
alter table hanlog.saved_missions enable row level security;
create index attempts_user_created on hanlog.attempts (user_id, created_at desc, id desc);
