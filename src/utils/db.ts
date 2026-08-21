import { pool } from '../db/pool';

export async function q<T = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const r = await pool.query(text, params);

  return r.rows as T[];
}

export async function one<T = any>(
  text: string,
  params: any[] = []
): Promise<T | undefined> {
  const r = await pool.query(text, params);

  return r.rows[0] as T | undefined;
}

export async function audit(
  userId: number | undefined,
  action: string,
  entity?: string,
  entityId?: number,
  details?: any
) {
  await pool
    .query(
      `
      INSERT INTO audit_logs
      (
        user_id,
        action,
        entity,
        entity_id,
        details
      )
      VALUES
      ($1,$2,$3,$4,$5)
      `,
      [
        userId || null,
        action,
        entity || null,
        entityId || null,
        details
          ? JSON.stringify(details)
          : null
      ]
    )
    .catch(() => {});
}