const pool = require("../config/database");

const PUBLIC_FIELDS = `id, name, email, phone, avatar_data AS "avatarData"`;

async function findByEmail(email) {
  const result = await pool.query(
    `SELECT id, name, email, password_hash AS "passwordHash" FROM users WHERE LOWER(email) = LOWER($1)`,
    [email],
  );
  return result.rows[0] ?? null;
}

async function create(user) {
  const result = await pool.query(
    `INSERT INTO users (name, email, password_hash) VALUES ($1, $2, $3) RETURNING ${PUBLIC_FIELDS}`,
    [user.name, user.email, user.passwordHash],
  );
  return result.rows[0];
}

async function getById(id) {
  const result = await pool.query(`SELECT ${PUBLIC_FIELDS} FROM users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

async function getPasswordHash(id) {
  const result = await pool.query(`SELECT password_hash AS "passwordHash" FROM users WHERE id = $1`, [id]);
  return result.rows[0] ?? null;
}

async function updateProfile(id, profile) {
  const result = await pool.query(
    `UPDATE users SET name = $1, email = $2, phone = $3, updated_at = CURRENT_TIMESTAMP
     WHERE id = $4 RETURNING ${PUBLIC_FIELDS}`,
    [profile.name, profile.email, profile.phone, id],
  );
  return result.rows[0] ?? null;
}

async function updatePassword(id, passwordHash) {
  await pool.query(
    `UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2`,
    [passwordHash, id],
  );
}

async function updateAvatar(id, avatarData) {
  const result = await pool.query(
    `UPDATE users SET avatar_data = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 RETURNING ${PUBLIC_FIELDS}`,
    [avatarData, id],
  );
  return result.rows[0] ?? null;
}

module.exports = Object.freeze({
  create, findByEmail, getById, getPasswordHash, updateAvatar, updatePassword, updateProfile,
});
