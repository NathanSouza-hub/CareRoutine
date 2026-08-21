const pool = require("../config/database");

const RETURNING_FIELDS = `
  id,
  to_char(note_date, 'YYYY-MM-DD') AS "noteDate",
  to_char(note_time, 'HH24:MI') AS "noteTime",
  shift,
  author_name AS "authorName",
  note_text AS "noteText",
  is_highlighted AS "isHighlighted",
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function getAll(patientId, userId, { date, shift } = {}) {
  const result = await pool.query(`
    SELECT ${RETURNING_FIELDS}
    FROM nursing_notes
    WHERE patient_id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2)
      AND ($3::date IS NULL OR note_date = $3)
      AND ($4::varchar IS NULL OR shift = $4)
    ORDER BY note_date DESC, note_time DESC`,
    [patientId, userId, date, shift]);
  return result.rows;
}

async function patientBelongsToUser(patientId, userId) {
  const result = await pool.query("SELECT 1 FROM patients WHERE id = $1 AND user_id = $2", [patientId, userId]);
  return result.rowCount > 0;
}

async function create(note) {
  const result = await pool.query(
    `INSERT INTO nursing_notes (note_date, note_time, shift, author_name, note_text, is_highlighted, patient_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
    [note.noteDate, note.noteTime, note.shift, note.authorName, note.noteText, note.isHighlighted, note.patientId],
  );
  return result.rows[0].id;
}

async function update(id, note, userId) {
  const result = await pool.query(
    `UPDATE nursing_notes SET note_date = $1, note_time = $2, shift = $3, author_name = $4,
      note_text = $5, is_highlighted = $6, updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 AND patient_id IN (SELECT id FROM patients WHERE user_id = $8) RETURNING id`,
    [note.noteDate, note.noteTime, note.shift, note.authorName, note.noteText, note.isHighlighted, id, userId],
  );
  return result.rowCount > 0;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM nursing_notes WHERE id = $1 AND patient_id IN (SELECT id FROM patients WHERE user_id = $2) RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

module.exports = Object.freeze({ create, getAll, patientBelongsToUser, remove, update });
