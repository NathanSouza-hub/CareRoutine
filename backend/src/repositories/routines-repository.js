const pool = require("../config/database");

async function getAll(patientId, userId) {
  const result = await pool.query(`
    SELECT id, title, category, to_char(scheduled_time, 'HH24:MI') AS time,
      notes, to_char(start_date, 'YYYY-MM-DD') AS "startDate",
      is_active AS "isActive"
    FROM routines
    WHERE patient_id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2)
    ORDER BY is_active DESC, scheduled_time, title`,
    [patientId, userId]);
  return result.rows;
}

async function patientBelongsToUser(patientId, userId) {
  const result = await pool.query("SELECT 1 FROM patients WHERE id = $1 AND user_id = $2", [patientId, userId]);
  return result.rowCount > 0;
}

async function create(routine) {
  const result = await pool.query(
    `INSERT INTO routines (title, category, scheduled_time, notes, start_date, patient_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [routine.title, routine.category, routine.time, routine.notes, routine.startDate, routine.patientId],
  );
  return result.rows[0].id;
}

async function update(id, routine, userId) {
  const result = await pool.query(
    `UPDATE routines SET title = $1, category = $2, scheduled_time = $3, notes = $4,
      start_date = $5, is_active = $6, updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 AND patient_id IN (SELECT id FROM patients WHERE user_id = $8) RETURNING id`,
    [routine.title, routine.category, routine.time, routine.notes, routine.startDate, routine.isActive, id, userId],
  );
  return result.rowCount > 0;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM routines WHERE id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2) RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

async function getDaily(date, patientId, userId) {
  const result = await pool.query(
    `SELECT r.id, r.title, r.category, to_char(r.scheduled_time, 'HH24:MI') AS time,
      r.notes, COALESCE(c.status, 'pending') AS status, c.completed_at AS "completedAt"
     FROM routines r
     LEFT JOIN routine_completions c ON c.routine_id = r.id AND c.scheduled_date = $1
     WHERE r.is_active = TRUE AND r.start_date <= $1
       AND r.patient_id = $2
       AND r.patient_id IN (SELECT id FROM patients WHERE user_id = $3)
     ORDER BY r.scheduled_time, r.title`,
    [date, patientId, userId],
  );
  return result.rows;
}

async function existsOnDate(id, date, userId) {
  const result = await pool.query(
    `SELECT 1 FROM routines WHERE id = $1 AND is_active = TRUE AND start_date <= $2
       AND patient_id IN (SELECT id FROM patients WHERE user_id = $3)`,
    [id, date, userId],
  );
  return result.rowCount > 0;
}

async function setCompletion(data) {
  const result = await pool.query(
    `INSERT INTO routine_completions (routine_id, scheduled_date, status, completed_at)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (routine_id, scheduled_date) DO UPDATE SET status = EXCLUDED.status,
       completed_at = EXCLUDED.completed_at, updated_at = CURRENT_TIMESTAMP
     RETURNING id, status, completed_at AS "completedAt"`,
    [data.routineId, data.date, data.status, data.completedAt],
  );
  return result.rows[0];
}

module.exports = Object.freeze({
  create, existsOnDate, getAll, getDaily, patientBelongsToUser, remove, setCompletion, update,
});
