const pool = require("../config/database");

async function getAll(patientId, userId) {
  const result = await pool.query(`
    SELECT
      m.id,
      m.name,
      m.dosage,
      m.instructions,
      to_char(m.start_date, 'YYYY-MM-DD') AS "startDate",
      CASE
        WHEN m.end_date IS NULL THEN NULL
        ELSE to_char(m.end_date, 'YYYY-MM-DD')
      END AS "endDate",
      m.is_active AS "isActive",
      m.created_at AS "createdAt",
      m.updated_at AS "updatedAt",
      COALESCE(
        json_agg(
          json_build_object(
            'id', s.id,
            'time', to_char(s.scheduled_time, 'HH24:MI')
          ) ORDER BY s.scheduled_time
        ) FILTER (WHERE s.id IS NOT NULL),
        '[]'::json
      ) AS schedules
    FROM medications m
    LEFT JOIN medication_schedules s ON s.medication_id = m.id AND s.is_active = TRUE
    WHERE m.patient_id = $1 AND m.patient_id IN (SELECT id FROM patients WHERE user_id = $2)
    GROUP BY m.id
    ORDER BY m.is_active DESC, m.name
  `, [patientId, userId]);
  return result.rows;
}

async function patientBelongsToUser(patientId, userId) {
  const result = await pool.query("SELECT 1 FROM patients WHERE id = $1 AND user_id = $2", [patientId, userId]);
  return result.rowCount > 0;
}

async function create(medication) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `INSERT INTO medications (name, dosage, instructions, start_date, end_date, patient_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id`,
      [
        medication.name,
        medication.dosage,
        medication.instructions,
        medication.startDate,
        medication.endDate,
        medication.patientId,
      ],
    );
    const id = result.rows[0].id;
    for (const time of medication.times) {
      await client.query(
        "INSERT INTO medication_schedules (medication_id, scheduled_time) VALUES ($1, $2)",
        [id, time],
      );
    }
    await client.query("COMMIT");
    return id;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function update(id, medication, userId) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      `UPDATE medications
       SET name = $1, dosage = $2, instructions = $3, start_date = $4,
           end_date = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
       WHERE id = $7 AND patient_id IN (SELECT id FROM patients WHERE user_id = $8) RETURNING id`,
      [
        medication.name,
        medication.dosage,
        medication.instructions,
        medication.startDate,
        medication.endDate,
        medication.isActive,
        id,
        userId,
      ],
    );
    if (!result.rowCount) {
      await client.query("ROLLBACK");
      return false;
    }
    await client.query(
      "UPDATE medication_schedules SET is_active = FALSE WHERE medication_id = $1",
      [id],
    );
    for (const time of medication.times) {
      await client.query(
        `INSERT INTO medication_schedules (medication_id, scheduled_time)
         VALUES ($1, $2)
         ON CONFLICT (medication_id, scheduled_time)
         DO UPDATE SET is_active = TRUE`,
        [id, time],
      );
    }
    await client.query("COMMIT");
    return true;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM medications WHERE id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2) RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

async function getDaily(date, patientId, userId) {
  const result = await pool.query(
    `SELECT
       m.id AS "medicationId", m.name, m.dosage, m.instructions,
       s.id AS "scheduleId", to_char(s.scheduled_time, 'HH24:MI') AS time,
       COALESCE(a.status, 'pending') AS status,
       a.administered_at AS "administeredAt", a.notes
     FROM medications m
     JOIN medication_schedules s ON s.medication_id = m.id AND s.is_active = TRUE
     LEFT JOIN medication_administrations a
       ON a.schedule_id = s.id AND a.scheduled_date = $1
     WHERE m.is_active = TRUE
       AND m.start_date <= $1
       AND (m.end_date IS NULL OR m.end_date >= $1)
       AND m.patient_id = $2
       AND m.patient_id IN (SELECT id FROM patients WHERE user_id = $3)
     ORDER BY s.scheduled_time, m.name`,
    [date, patientId, userId],
  );
  return result.rows;
}

async function scheduleBelongsToMedication(medicationId, scheduleId, userId) {
  const result = await pool.query(
    `SELECT 1 FROM medication_schedules s
     JOIN medications m ON m.id = s.medication_id
     WHERE s.id = $1 AND s.medication_id = $2 AND s.is_active = TRUE
       AND m.patient_id IN (SELECT id FROM patients WHERE user_id = $3)`,
    [scheduleId, medicationId, userId],
  );
  return result.rowCount > 0;
}

async function setAdministration(data) {
  const result = await pool.query(
    `INSERT INTO medication_administrations
       (schedule_id, scheduled_date, status, administered_at, notes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (schedule_id, scheduled_date) DO UPDATE SET
       status = EXCLUDED.status,
       administered_at = EXCLUDED.administered_at,
       notes = EXCLUDED.notes,
       updated_at = CURRENT_TIMESTAMP
     RETURNING id, status, administered_at AS "administeredAt", notes`,
    [data.scheduleId, data.date, data.status, data.administeredAt, data.notes],
  );
  return result.rows[0];
}

module.exports = Object.freeze({
  create,
  getAll,
  getDaily,
  patientBelongsToUser,
  remove,
  scheduleBelongsToMedication,
  setAdministration,
  update,
});
