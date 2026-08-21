import { pool } from './pool';

(async () => {
  await pool.query(`
    ALTER TABLE users
    ADD COLUMN IF NOT EXISTS approved BOOLEAN NOT NULL DEFAULT TRUE;

    CREATE INDEX IF NOT EXISTS idx_users_approval ON users(approved, role, created_at);
  `);

  console.log('Migración de registro lista.');
  await pool.end();
})().catch((error) => {
  console.error('Error en la migración:', error);
  process.exit(1);
});
