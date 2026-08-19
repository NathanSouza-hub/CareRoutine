BEGIN;

CREATE TABLE medications (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  dosage VARCHAR(80) NOT NULL,
  instructions VARCHAR(500),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE medication_schedules (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  medication_id BIGINT NOT NULL REFERENCES medications(id) ON DELETE CASCADE,
  scheduled_time TIME NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  UNIQUE (medication_id, scheduled_time)
);

CREATE TABLE medication_administrations (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  schedule_id BIGINT NOT NULL REFERENCES medication_schedules(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status VARCHAR(10) NOT NULL CHECK (status IN ('taken', 'skipped')),
  administered_at TIMESTAMP WITH TIME ZONE,
  notes VARCHAR(500),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (schedule_id, scheduled_date)
);

CREATE INDEX idx_medication_administrations_date
  ON medication_administrations (scheduled_date);

COMMIT;
