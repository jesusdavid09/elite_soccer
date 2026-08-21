import { pool } from './pool';

(async () => {

  try {

    await pool.query(`

      /* ============================================================
         APROBACIÓN DE USUARIOS
      ============================================================ */

      ALTER TABLE users

      ADD COLUMN IF NOT EXISTS approved
      BOOLEAN NOT NULL DEFAULT FALSE;


      CREATE INDEX IF NOT EXISTS
      idx_users_approval

      ON users(
        approved,
        role,
        created_at
      );


      CREATE INDEX IF NOT EXISTS
      idx_users_coach

      ON users(role)

      WHERE role = 'coach';


      /* ============================================================
         CÓDIGO DE INVITACIÓN PARA ENTRENADORES
      ============================================================ */

      CREATE TABLE IF NOT EXISTS club_settings (

        key VARCHAR(100) PRIMARY KEY,

        value TEXT NOT NULL,

        updated_at TIMESTAMPTZ NOT NULL
          DEFAULT NOW()

      );


      INSERT INTO club_settings (
        key,
        value
      )

      VALUES (
        'coach_invitation_code',
        'ELITECOACH2026'
      )

      ON CONFLICT (key)
      DO NOTHING;


      /* ============================================================
         UBICACIÓN DE PARTIDOS
      ============================================================ */

      ALTER TABLE matches

      ADD COLUMN IF NOT EXISTS latitude
      NUMERIC(10,7);


      ALTER TABLE matches

      ADD COLUMN IF NOT EXISTS longitude
      NUMERIC(10,7);


      /* ============================================================
         ÍNDICES
      ============================================================ */

      CREATE INDEX IF NOT EXISTS
      idx_matches_location

      ON matches(
        latitude,
        longitude
      );

    `);


    console.log(
      'Migración de Elite Soccer completada correctamente.'
    );

    console.log(
      'Código inicial de entrenador: ELITECOACH2026'
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