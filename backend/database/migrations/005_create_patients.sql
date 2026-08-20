SET client_encoding TO 'UTF8';

BEGIN;

CREATE TABLE patients (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  full_name VARCHAR(150) NOT NULL,
  birth_date DATE NOT NULL,
  sex VARCHAR(20),
  cpf VARCHAR(20),
  health_card_number VARCHAR(40),
  health_insurance VARCHAR(120),
  phone VARCHAR(30),
  address VARCHAR(255),
  emergency_contact_name VARCHAR(120),
  emergency_contact_relationship VARCHAR(60),
  emergency_contact_phone VARCHAR(30),
  responsible_name VARCHAR(120),
  responsible_phone VARCHAR(30),
  blood_type VARCHAR(5),
  allergies VARCHAR(500),
  chronic_conditions VARCHAR(1000),
  surgical_history VARCHAR(1000),
  mobility VARCHAR(30),
  dietary_restrictions VARCHAR(500),
  current_medications_notes VARCHAR(1000),
  doctor_name VARCHAR(120),
  doctor_specialty VARCHAR(120),
  doctor_phone VARCHAR(30),
  care_plan_notes VARCHAR(1000),
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

COMMIT;
