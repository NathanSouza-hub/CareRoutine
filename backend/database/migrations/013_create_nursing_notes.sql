SET client_encoding TO 'UTF8';

BEGIN;

CREATE TABLE nursing_notes (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  patient_id BIGINT NOT NULL REFERENCES patients(id) ON DELETE CASCADE,
  note_date DATE NOT NULL,
  note_time TIME NOT NULL,
  shift VARCHAR(10) NOT NULL CHECK (
    shift IN ('Manhã', 'Tarde', 'Noite', 'Madrugada')
  ),
  author_name VARCHAR(120) NOT NULL,
  note_text VARCHAR(2000) NOT NULL,
  is_highlighted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_nursing_notes_patient_id ON nursing_notes (patient_id);
CREATE INDEX idx_nursing_notes_note_date ON nursing_notes (note_date DESC);

COMMIT;
