const pool = require("../config/database");

const PUBLIC_FIELDS = `id, name, avatar_color AS "avatarColor", is_active AS "isActive"`;

async function getAll(userId) {
  const result = await pool.query(
    `SELECT ${PUBLIC_FIELDS} FROM caregiver_profiles
     WHERE user_id = $1 ORDER BY is_active DESC, name`,
    [userId],
  );
  return result.rows;
}

async function create(profile) {
  const result = await pool.query(
    `INSERT INTO caregiver_profiles (name, avatar_color, user_id)
     VALUES ($1, $2, $3) RETURNING ${PUBLIC_FIELDS}`,
    [profile.name, profile.avatarColor, profile.userId],
  );
  return result.rows[0];
}

async function update(id, profile, userId) {
  const result = await pool.query(
    `UPDATE caregiver_profiles SET name = $1, avatar_color = $2, is_active = $3,
       updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 AND user_id = $5 RETURNING ${PUBLIC_FIELDS}`,
    [profile.name, profile.avatarColor, profile.isActive, id, userId],
  );
  return result.rows[0] ?? null;
}

async function remove(id, userId) {
  const result = await pool.query(
    "DELETE FROM caregiver_profiles WHERE id = $1 AND user_id = $2 RETURNING id",
    [id, userId],
  );
  return result.rowCount > 0;
}

async function belongsToUser(profileId, userId) {
  const result = await pool.query(
    "SELECT 1 FROM caregiver_profiles WHERE id = $1 AND user_id = $2",
    [profileId, userId],
  );
  return result.rowCount > 0;
}

module.exports = Object.freeze({ belongsToUser, create, getAll, remove, update });
