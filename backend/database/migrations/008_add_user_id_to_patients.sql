BEGIN;

-- Pacientes cadastrados antes de existir login são apenas dados de teste
-- desta fase de desenvolvimento; não há usuário para atribuí-los, então são
-- removidos (o CASCADE das tabelas de rotinas/medicamentos/sinais vitais
-- limpa os registros dependentes junto).
DELETE FROM patients;

ALTER TABLE patients ADD COLUMN user_id BIGINT REFERENCES users(id) ON DELETE CASCADE;
ALTER TABLE patients ALTER COLUMN user_id SET NOT NULL;
CREATE INDEX idx_patients_user_id ON patients (user_id);

COMMIT;
