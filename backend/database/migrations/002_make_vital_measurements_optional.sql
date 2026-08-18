BEGIN;

ALTER TABLE vital_signs
  ALTER COLUMN systolic_pressure DROP NOT NULL,
  ALTER COLUMN diastolic_pressure DROP NOT NULL,
  ALTER COLUMN heart_rate DROP NOT NULL,
  ALTER COLUMN oxygen_saturation DROP NOT NULL,
  ALTER COLUMN temperature DROP NOT NULL;

COMMIT;
