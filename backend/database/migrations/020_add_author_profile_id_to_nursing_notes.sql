SET client_encoding TO 'UTF8';

BEGIN;

ALTER TABLE nursing_notes ADD COLUMN author_profile_id BIGINT REFERENCES caregiver_profiles(id) ON DELETE SET NULL;
ALTER TABLE nursing_notes ALTER COLUMN author_name DROP NOT NULL;

COMMIT;
