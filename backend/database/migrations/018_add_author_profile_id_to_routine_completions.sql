SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE routine_completions ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;

COMMIT;
