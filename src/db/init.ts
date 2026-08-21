import fs from 'node:fs';
import path from 'node:path';

import { pool } from './pool';

(async () => {
    const candidates = [
        process.env.SCHEMA_PATH,
        path.join(
            process.cwd(),
            'src/db/schema.sql'
        ),
        path.join(
            __dirname,
            'schema.sql'
        )
    ].filter(Boolean) as string[];

    const file = candidates.find(
        fs.existsSync
    );

    if (!file) {
        throw new Error(
            'No se encontró src/db/schema.sql'
        );
    }

    const sql = fs.readFileSync(
        file,
        'utf8'
    );

    await pool.query(sql);

    console.log(
        'Base de datos inicializada.'
    );

    await pool.end();
})().catch(e => {
    console.error(e);
    process.exit(1);
});