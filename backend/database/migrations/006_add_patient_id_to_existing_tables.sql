BEGIN;

INSERT INTO patients (full_name, birth_date)
SELECT 'Paciente sem nome', CURRENT_DATE
WHERE NOT EXISTS (SELECT 1 FROM patients);

ALTER TABLE routines ADD COLUMN patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE;
UPDATE routines SET patient_id = (SELECT id FROM patients ORDER BY id LIMIT 1) WHERE patient_id IS NULL;
ALTER TABLE routines ALTER COLUMN patient_id SET NOT NULL;
CREATE INDEX idx_routines_patient_id ON routines (patient_id);

ALTER TABLE medications ADD COLUMN patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE;
UPDATE medications SET patient_id = (SELECT id FROM patients ORDER BY id LIMIT 1) WHERE patient_id IS NULL;
ALTER TABLE medications ALTER COLUMN patient_id SET NOT NULL;
CREATE INDEX idx_medications_patient_id ON medications (patient_id);

ALTER TABLE vital_signs ADD COLUMN patient_id BIGINT REFERENCES patients(id) ON DELETE CASCADE;
UPDATE vital_signs SET patient_id = (SELECT id FROM patients ORDER BY id LIMIT 1) WHERE patient_id IS NULL;
ALTER TABLE vital_signs ALTER COLUMN patient_id SET NOT NULL;
CREATE INDEX idx_vital_signs_patient_id ON vital_signs (patient_id);

COMMIT;
