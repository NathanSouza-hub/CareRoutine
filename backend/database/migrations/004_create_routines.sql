BEGIN;

CREATE TABLE routines (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title VARCHAR(120) NOT NULL,
  category VARCHAR(40) NOT NULL,
  scheduled_time TIME NOT NULL,
  notes VARCHAR(500),
  start_date DATE NOT NULL,
  end_date DATE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (end_date IS NULL OR end_date >= start_date)
);

CREATE TABLE routine_completions (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  routine_id BIGINT NOT NULL REFERENCES routines(id) ON DELETE CASCADE,
  scheduled_date DATE NOT NULL,
  status VARCHAR(12) NOT NULL CHECK (status IN ('completed', 'skipped')),
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (routine_id, scheduled_date)
);

CREATE INDEX idx_routine_completions_date ON routine_completions (scheduled_date);

COMMIT;
