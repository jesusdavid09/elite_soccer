import bcrypt from 'bcryptjs';
import { pool } from './pool';
(async()=>{
 const hash=await bcrypt.hash('Admin123!',12);
 await pool.query(`INSERT INTO users(name,email,password_hash,role,approved) VALUES('Administrador Elite','admin@elitesoccer.local',$1,'admin',true) ON CONFLICT(email) DO NOTHING`,[hash]);
 await pool.query(`INSERT INTO users(name,email,password_hash,role,approved) VALUES('Entrenador Elite','coach@elitesoccer.local',$1,'coach',true) ON CONFLICT(email) DO NOTHING`,[hash]);
 await pool.query(`UPDATE users SET approved=true WHERE role IN ('admin','coach')`);
 for (const n of ['Sub-12','Sub-14','Sub-16','Sub-18']) await pool.query('INSERT INTO categories(name) VALUES($1) ON CONFLICT(name) DO NOTHING',[n]);
 await pool.query(`INSERT INTO club_settings(key,value) VALUES ('club_name','Elite Soccer'),('tagline','Talento. Disciplina. Corazón.'),('primary_color','#145CFF') ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value`);
 await pool.query(`INSERT INTO products(name,description,price,stock) SELECT 'Kit Oficial Elite Soccer','Uniforme oficial personalizado',150000,50 WHERE NOT EXISTS(SELECT 1 FROM products WHERE name='Kit Oficial Elite Soccer')`);
 console.log('Seed listo. Admin: admin@elitesoccer.local / Admin123!'); await pool.end();
})().catch(e=>{console.error(e);process.exit(1)});
