alter table hanlog.pending_media_deletions add column owner_id uuid;
alter table hanlog.pending_media_deletions add column challenge_id uuid;
alter table hanlog.pending_media_deletions add column challenge_author_id uuid;
-- Deliberately no cascading FKs: recovery must survive deletion of its parent rows.
create index pending_media_owner on hanlog.pending_media_deletions (owner_id);
create index pending_media_challenge_author on hanlog.pending_media_deletions (challenge_author_id);
-- Recover associations that can be identified from existing metadata/first-upload paths.
update hanlog.pending_media_deletions p set owner_id = c.author_id, challenge_id = c.id, challenge_author_id = c.author_id
from hanlog.challenges c where p.path = c.reference_path or p.path like 'references/' || c.id::text || '.%';
update hanlog.pending_media_deletions p set owner_id = r.responder_id, challenge_id = c.id, challenge_author_id = c.author_id
from hanlog.challenge_responses r join hanlog.challenges c on c.id = r.challenge_id
where p.path = r.media_path or p.path like 'responses/' || r.id::text || '.%';
