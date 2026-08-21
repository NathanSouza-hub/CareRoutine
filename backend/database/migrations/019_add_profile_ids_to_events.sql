SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE events ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;
ALTER TABLE events ADD COLUMN completed_by_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;

COMMIT;
