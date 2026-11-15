create table hanlog.community_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references hanlog.users(id) on delete cascade,
  challenge_id uuid not null references hanlog.challenges(id) on delete cascade,
  response_id uuid references hanlog.challenge_responses(id) on delete cascade,
  reason text not null check (reason in ('harassment','inappropriate','spam','privacy','other')),
  status text not null default 'open' check (status in ('open','dismissed','actioned')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);
create unique index community_reports_response_unique on hanlog.community_reports(reporter_id,response_id) where response_id is not null;
create unique index community_reports_challenge_unique on hanlog.community_reports(reporter_id,challenge_id) where response_id is null;
create index community_reports_open on hanlog.community_reports(status,created_at,id);
create index community_reports_reporter_created on hanlog.community_reports(reporter_id,created_at);
create index challenges_created_id on hanlog.challenges(created_at desc,id desc);
create index responses_challenge_created_id on hanlog.challenge_responses(challenge_id,created_at desc,id desc);
create index responses_responder_rating on hanlog.challenge_responses(responder_id,rated_at desc,id desc) where rated_at is not null;
create index responses_rater_feedback on hanlog.challenge_responses(rater_id,feedback_at desc,id desc) where feedback_at is not null;
alter table hanlog.community_reports enable row level security;
