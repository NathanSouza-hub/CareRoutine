const pool = require("../config/database");

const RETURNING_FIELDS = `
  id,
  measured_at AS "measuredAt",
  shift,
  systolic_pressure AS "systolicPressure",
  diastolic_pressure AS "diastolicPressure",
  heart_rate AS "heartRate",
  oxygen_saturation AS "oxygenSaturation",
  temperature::FLOAT AS temperature,
  blood_glucose AS "bloodGlucose",
  notes,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function getAll(patientId, userId) {
  const result = await pool.query(`
    SELECT ${RETURNING_FIELDS}
    FROM vital_signs
    WHERE patient_id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2)
    ORDER BY measured_at DESC
  `, [patientId, userId]);

  return result.rows;
}

async function patientBelongsToUser(patientId, userId) {
  const result = await pool.query("SELECT 1 FROM patients WHERE id = $1 AND user_id = $2", [patientId, userId]);
  return result.rowCount > 0;
}

async function create(vitalSigns) {
  const query = `
    INSERT INTO vital_signs (
      measured_at,
      shift,
      systolic_pressure,
      diastolic_pressure,
      heart_rate,
      oxygen_saturation,
      temperature,
      blood_glucose,
      notes,
      patient_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING ${RETURNING_FIELDS}
  `;
  const values = [
    vitalSigns.measuredAt,
    vitalSigns.shift,
    vitalSigns.systolicPressure,
    vitalSigns.diastolicPressure,
    vitalSigns.heartRate,
    vitalSigns.oxygenSaturation,
    vitalSigns.temperature,
    vitalSigns.bloodGlucose,
    vitalSigns.notes,
    vitalSigns.patientId,
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function update(id, vitalSigns, userId) {
  const query = `
    UPDATE vital_signs
    SET
      measured_at = $1,
      shift = $2,
      systolic_pressure = $3,
      diastolic_pressure = $4,
      heart_rate = $5,
      oxygen_saturation = $6,
      temperature = $7,
      blood_glucose = $8,
      notes = $9,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = $10 AND patient_id IN (SELECT id FROM patients WHERE user_id = $11)
    RETURNING ${RETURNING_FIELDS}
  `;
  const values = [
    vitalSigns.measuredAt,
    vitalSigns.shift,
    vitalSigns.systolicPressure,
    vitalSigns.diastolicPressure,
    vitalSigns.heartRate,
    vitalSigns.oxygenSaturation,
    vitalSigns.temperature,
    vitalSigns.bloodGlucose,
    vitalSigns.notes,
    id,
    userId,
  ];
  const result = await pool.query(query, values);

  return result.rows[0] ?? null;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM vital_signs WHERE id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2) RETURNING id",
    [id, userId],
  );

  return result.rowCount > 0;
}

module.exports = Object.freeze({ create, getAll, patientBelongsToUser, remove, update });
