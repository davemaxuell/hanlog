-- Creation quotas survive profile deletion without retaining profile identifiers.
create table hanlog.session_creation_limits (
  ip_hash text not null,
  day date not null,
  sessions integer not null check (sessions > 0),
  primary key (ip_hash, day)
);
alter table hanlog.session_creation_limits enable row level security;
create index session_creation_limits_day on hanlog.session_creation_limits (day);

-- Preserve the active quota when upgrading an existing database. Earlier
-- deletions cannot be reconstructed; subsequent creations are durable.
insert into hanlog.session_creation_limits (ip_hash, day, sessions)
select ip_hash, (created_at at time zone 'Asia/Seoul')::date, count(*)::int
from hanlog.users
where ip_hash <> 'unknown'
  and (created_at at time zone 'Asia/Seoul')::date = (now() at time zone 'Asia/Seoul')::date
group by ip_hash, (created_at at time zone 'Asia/Seoul')::date;
