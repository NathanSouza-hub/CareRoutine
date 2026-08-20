const pool = require("../config/database");

const PUBLIC_FIELDS = `id, name, email`;

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

module.exports = Object.freeze({ create, findByEmail, getById });
