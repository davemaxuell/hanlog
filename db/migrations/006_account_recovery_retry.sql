-- Retry proofs retain hashes only. The replacement key is derived by the server
-- from the supplied old key and nonce; it is never persisted as plaintext.
alter table hanlog.users add column recovery_previous_hash text;
alter table hanlog.users add column recovery_request_hash text;
alter table hanlog.users add column recovery_retry_expires_at timestamptz;
alter table hanlog.users add column recovery_retry_version integer;
create index users_recovery_retry_expiry on hanlog.users (recovery_retry_expires_at) where recovery_retry_expires_at is not null;
create index users_recovery_previous_key on hanlog.users (recovery_previous_hash,recovery_request_hash) where recovery_previous_hash is not null;
