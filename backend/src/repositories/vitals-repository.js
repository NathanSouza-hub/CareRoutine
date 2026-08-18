const pool = require("../config/database");

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
      notes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING
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
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

module.exports = Object.freeze({ create });
