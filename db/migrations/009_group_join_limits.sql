-- Wrong group codes per profile per hour, so six-character codes cannot be guessed.
create table hanlog.group_join_failures (
  user_id uuid not null references hanlog.users(id) on delete cascade,
  window_start timestamptz not null,
  attempts int not null default 0,
  primary key (user_id, window_start)
);
alter table hanlog.group_join_failures enable row level security;
