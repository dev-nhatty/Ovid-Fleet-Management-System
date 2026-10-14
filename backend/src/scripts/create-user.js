// Creates a user that can sign in. There is no public signup, so this is
// how the first accounts exist. After the first System Administrator
// exists, you'll create everyone else from the Users page instead.
//
//   node src/scripts/create-user.js <username> <password> "<full name>" <role>
//
// role is "Manager" or "System Administrator". Quote it if it has a space.
//
//   node src/scripts/create-user.js admin "ChangeMe123!" "Ovid IT Admin" "System Administrator"
//   node src/scripts/create-user.js abel  "ChangeMe123!" "Abel Tesfaye" Manager

require('dotenv').config();
const bcrypt = require('bcrypt');
const pool = require('../db/pool');
const { LOGIN_ROLES } = require('../config/roles');

const SALT_ROUNDS = 12;

async function main() {
  const [username, password, name, role] = process.argv.slice(2);

  if (!username || !password || !name || !role) {
    console.error('Usage: node create-user.js <username> <password> "<full name>" <role>');
    process.exit(1);
  }
  if (!LOGIN_ROLES.includes(role)) {
    console.error(`Role must be one of: ${LOGIN_ROLES.join(', ')}`);
    process.exit(1);
  }
  if (password.length < 8) {
    console.error('Password must be at least 8 characters.');
    process.exit(1);
  }

  try {
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);
    const { rows } = await pool.query(
      `INSERT INTO users (name, username, password_hash, role, status)
       VALUES ($1, $2, $3, $4, 'Active')
       RETURNING id, name, username, role`,
      [name, username, passwordHash, role]
    );
    console.log('Created user:', rows[0]);
  } catch (err) {
    if (err.code === '23505') {
      console.error(`Username "${username}" already exists.`);
    } else {
      console.error('Failed to create user:', err.message);
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
