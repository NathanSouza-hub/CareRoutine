const pool = require("../config/database");

const RETURNING_FIELDS = `
  id,
  full_name AS "fullName",
  to_char(birth_date, 'YYYY-MM-DD') AS "birthDate",
  sex,
  cpf,
  health_card_number AS "healthCardNumber",
  health_insurance AS "healthInsurance",
  phone,
  address,
  emergency_contact_name AS "emergencyContactName",
  emergency_contact_relationship AS "emergencyContactRelationship",
  emergency_contact_phone AS "emergencyContactPhone",
  responsible_name AS "responsibleName",
  responsible_phone AS "responsiblePhone",
  blood_type AS "bloodType",
  allergies,
  chronic_conditions AS "chronicConditions",
  surgical_history AS "surgicalHistory",
  mobility,
  dietary_restrictions AS "dietaryRestrictions",
  current_medications_notes AS "currentMedicationsNotes",
  doctor_name AS "doctorName",
  doctor_specialty AS "doctorSpecialty",
  doctor_phone AS "doctorPhone",
  care_plan_notes AS "carePlanNotes",
  is_active AS "isActive"
`;

const FIELDS = [
  "fullName", "birthDate", "sex", "cpf", "healthCardNumber", "healthInsurance", "phone", "address",
  "emergencyContactName", "emergencyContactRelationship", "emergencyContactPhone",
  "responsibleName", "responsiblePhone",
  "bloodType", "allergies", "chronicConditions", "surgicalHistory", "mobility",
  "dietaryRestrictions", "currentMedicationsNotes",
  "doctorName", "doctorSpecialty", "doctorPhone", "carePlanNotes",
];

const COLUMNS = [
  "full_name", "birth_date", "sex", "cpf", "health_card_number", "health_insurance", "phone", "address",
  "emergency_contact_name", "emergency_contact_relationship", "emergency_contact_phone",
  "responsible_name", "responsible_phone",
  "blood_type", "allergies", "chronic_conditions", "surgical_history", "mobility",
  "dietary_restrictions", "current_medications_notes",
  "doctor_name", "doctor_specialty", "doctor_phone", "care_plan_notes",
];

async function getAll(userId) {
  const result = await pool.query(`
    SELECT ${RETURNING_FIELDS}
    FROM patients
    WHERE user_id = $1
    ORDER BY is_active DESC, full_name`,
    [userId]);
  return result.rows;
}

async function getById(id, userId) {
  const result = await pool.query(
    `SELECT ${RETURNING_FIELDS} FROM patients WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return result.rows[0] ?? null;
}

async function create(patient, userId) {
  const values = FIELDS.map((field) => patient[field]);
  const placeholders = COLUMNS.map((_, index) => `$${index + 1}`).join(", ");
  const result = await pool.query(
    `INSERT INTO patients (${COLUMNS.join(", ")}, user_id) VALUES (${placeholders}, $${COLUMNS.length + 1}) RETURNING id`,
    [...values, userId],
  );
  return result.rows[0].id;
}

async function update(id, patient, userId) {
  const assignments = COLUMNS.map((column, index) => `${column} = $${index + 1}`).join(", ");
  const values = FIELDS.map((field) => patient[field]);
  const result = await pool.query(
    `UPDATE patients SET ${assignments}, is_active = $${COLUMNS.length + 1}, updated_at = CURRENT_TIMESTAMP
     WHERE id = $${COLUMNS.length + 2} AND user_id = $${COLUMNS.length + 3} RETURNING id`,
    [...values, patient.isActive, id, userId],
  );
  return result.rowCount > 0;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM patients WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

module.exports = Object.freeze({ create, getAll, getById, remove, update });
