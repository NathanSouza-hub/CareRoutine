const pool = require("../config/database");

async function getAll() {
  const result = await pool.query(`
    SELECT id, title, category, to_char(scheduled_time, 'HH24:MI') AS time,
      notes, to_char(start_date, 'YYYY-MM-DD') AS "startDate",
      CASE WHEN end_date IS NULL THEN NULL ELSE to_char(end_date, 'YYYY-MM-DD') END AS "endDate",
      is_active AS "isActive"
    FROM routines
    ORDER BY is_active DESC, scheduled_time, title`);
  return result.rows;
}

async function create(routine) {
  const result = await pool.query(
    `INSERT INTO routines (title, category, scheduled_time, notes, start_date, end_date)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
    [routine.title, routine.category, routine.time, routine.notes, routine.startDate, routine.endDate],
  );
  return result.rows[0].id;
}

async function update(id, routine) {
  const result = await pool.query(
    `UPDATE routines SET title = $1, category = $2, scheduled_time = $3, notes = $4,
      start_date = $5, end_date = $6, is_active = $7, updated_at = CURRENT_TIMESTAMP
     WHERE id = $8 RETURNING id`,
    [routine.title, routine.category, routine.time, routine.notes, routine.startDate, routine.endDate, routine.isActive, id],
  );
  return result.rowCount > 0;
}

async function remove(id) {
  const result = await pool.query("DELETE FROM routines WHERE id = $1 RETURNING id", [id]);
  return result.rowCount > 0;
}

async function getDaily(date) {
  const result = await pool.query(
    `SELECT r.id, r.title, r.category, to_char(r.scheduled_time, 'HH24:MI') AS time,
      r.notes, COALESCE(c.status, 'pending') AS status, c.completed_at AS "completedAt"
     FROM routines r
     LEFT JOIN routine_completions c ON c.routine_id = r.id AND c.scheduled_date = $1
     WHERE r.is_active = TRUE AND r.start_date <= $1
       AND (r.end_date IS NULL OR r.end_date >= $1)
     ORDER BY r.scheduled_time, r.title`,
    [date],
  );
  return result.rows;
}

async function existsOnDate(id, date) {
  const result = await pool.query(
    `SELECT 1 FROM routines WHERE id = $1 AND is_active = TRUE AND start_date <= $2
       AND (end_date IS NULL OR end_date >= $2)`,
    [id, date],
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

module.exports = Object.freeze({ create, existsOnDate, getAll, getDaily, remove, setCompletion, update });
