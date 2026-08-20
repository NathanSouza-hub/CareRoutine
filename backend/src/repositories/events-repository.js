const pool = require("../config/database");

async function getAll(patientId, userId, { start, end } = {}) {
  const result = await pool.query(`
    SELECT id, title, category, to_char(event_date, 'YYYY-MM-DD') AS "eventDate",
      to_char(event_time, 'HH24:MI') AS "eventTime", notes, status,
      completed_at AS "completedAt"
    FROM events
    WHERE patient_id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2)
      AND ($3::date IS NULL OR event_date >= $3)
      AND ($4::date IS NULL OR event_date <= $4)
    ORDER BY event_date, event_time, title`,
    [patientId, userId, start || null, end || null]);
  return result.rows;
}

async function patientBelongsToUser(patientId, userId) {
  const result = await pool.query("SELECT 1 FROM patients WHERE id = $1 AND user_id = $2", [patientId, userId]);
  return result.rowCount > 0;
}

async function create(event) {
  const result = await pool.query(
    `INSERT INTO events (title, category, event_date, event_time, notes, patient_id)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [event.title, event.category, event.eventDate, event.eventTime, event.notes, event.patientId],
  );
  return result.rows[0].id;
}

async function update(id, event, userId) {
  const result = await pool.query(
    `UPDATE events SET title = $1, category = $2, event_date = $3, event_time = $4, notes = $5,
      updated_at = CURRENT_TIMESTAMP
     WHERE id = $6 AND patient_id IN (SELECT id FROM patients WHERE user_id = $7) RETURNING id`,
    [event.title, event.category, event.eventDate, event.eventTime, event.notes, id, userId],
  );
  return result.rowCount > 0;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM events WHERE id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2) RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

async function getDaily(date, patientId, userId) {
  const result = await pool.query(
    `SELECT id, title, category, to_char(event_time, 'HH24:MI') AS time, notes, status
     FROM events
     WHERE event_date = $1 AND patient_id = $2
       AND patient_id IN (SELECT id FROM patients WHERE user_id = $3)
     ORDER BY event_time, title`,
    [date, patientId, userId],
  );
  return result.rows;
}

async function getUpcoming(patientId, userId, days) {
  const result = await pool.query(
    `SELECT id, title, category, to_char(event_date, 'YYYY-MM-DD') AS "eventDate",
      to_char(event_time, 'HH24:MI') AS "eventTime"
     FROM events
     WHERE status = 'pending' AND patient_id = $1
       AND patient_id IN (SELECT id FROM patients WHERE user_id = $2)
       AND event_date BETWEEN CURRENT_DATE AND CURRENT_DATE + $3::integer
     ORDER BY event_date, event_time`,
    [patientId, userId, days],
  );
  return result.rows;
}

async function setStatus(id, status, userId) {
  const result = await pool.query(
    `UPDATE events SET status = $1, completed_at = $2, updated_at = CURRENT_TIMESTAMP
     WHERE id = $3 AND patient_id IN (SELECT id FROM patients WHERE user_id = $4)
     RETURNING id, status, completed_at AS "completedAt"`,
    [status, status === "completed" ? new Date() : null, id, userId],
  );
  return result.rows[0];
}

module.exports = Object.freeze({
  create, getAll, getDaily, getUpcoming, patientBelongsToUser, remove, setStatus, update,
});
