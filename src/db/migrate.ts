import { pool } from './pool';

(async () => {
  try {
    await pool.query(`
      /*
       * ============================================================
       * MIGRACIÓN DE REGISTRO - ELITE SOCCER
       * ============================================================
       *
       * El entrenador (coach) es el administrador de Elite Soccer.
       *
       * Los jugadores y acudientes pueden registrarse y quedar
       * pendientes de aprobación.
       *
       * El entrenador será una cuenta especial.
       * ============================================================
       */

      /*
       * Asegurar columna de aprobación.
       */
      ALTER TABLE users
      ADD COLUMN IF NOT EXISTS approved
      BOOLEAN NOT NULL DEFAULT FALSE;


      /*
       * Índice para solicitudes pendientes.
       */
      CREATE INDEX IF NOT EXISTS
      idx_users_approval
      ON users(
        approved,
        role,
        created_at
      );


      /*
       * Índice para buscar rápidamente entrenadores.
       */
      CREATE INDEX IF NOT EXISTS
      idx_users_coach
      ON users(role)
      WHERE role = 'coach';
    `);

    console.log(
      'Migración de registro de Elite Soccer lista.'
    );
  } catch (error) {
    console.error(
      'Error en la migración:',
      error
    );

    process.exit(1);
  } finally {
    await pool.end();
  }
})();