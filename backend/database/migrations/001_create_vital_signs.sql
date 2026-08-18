SET client_encoding TO 'UTF8';

BEGIN;

CREATE TABLE vital_signs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  measured_at TIMESTAMP WITH TIME ZONE NOT NULL,
  shift VARCHAR(10) NOT NULL CHECK (
    shift IN ('Manhã', 'Tarde', 'Noite', 'Madrugada')
  ),
  systolic_pressure SMALLINT NOT NULL CHECK (systolic_pressure > 0),
  diastolic_pressure SMALLINT NOT NULL CHECK (diastolic_pressure > 0),
  heart_rate SMALLINT NOT NULL CHECK (heart_rate > 0),
  oxygen_saturation SMALLINT NOT NULL CHECK (
    oxygen_saturation BETWEEN 1 AND 100
  ),
  temperature NUMERIC(4, 1) NOT NULL CHECK (
    temperature BETWEEN 30 AND 45
  ),
  blood_glucose SMALLINT CHECK (blood_glucose > 0),
  notes VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_vital_signs_measured_at
  ON vital_signs (measured_at DESC);

COMMIT;
