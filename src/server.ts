import express, { Request, Response } from 'express';
import session from 'express-session';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import pgSession from 'connect-pg-simple';
import crypto from 'node:crypto';
import bcrypt from 'bcryptjs';
import helmet from 'helmet';
import morgan from 'morgan';
import 'dotenv/config';

import { pool } from './db/pool';
import { requireAuth, requireRole } from './middleware/auth';
import { q, one, audit } from './utils/db';

const app = express();
const PORT = Number(process.env.PORT || 3000);
const ROOT = path.join(__dirname, '..');

// ============================================================
// UPLOADS
// ============================================================

const uploadDir = path.join(ROOT, 'uploads');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: uploadDir,
  filename: (_req, file, cb) => {
    cb(
      null,
      `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${path
        .extname(file.originalname)
        .toLowerCase()}`
    );
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    cb(null, /\.(png|jpe?g|webp|gif)$/i.test(path.extname(file.originalname)));
  }
});

// ============================================================
// SESSION
// ============================================================

// ============================================================
// SUBIDA DE FOTOS DE PERFIL
// ============================================================

const profileUploadDir = path.join(process.cwd(), 'public', 'uploads', 'profiles');

if (!fs.existsSync(profileUploadDir)) {
  fs.mkdirSync(profileUploadDir, { recursive: true });
}

const profileStorage = multer.diskStorage({
    destination: (_req, _file, cb) => {
    cb(null, profileUploadDir);
    },

    filename: (_req, file, cb) => {
        const extension = path.extname(file.originalname).toLowerCase();

        const filename =
            `profile-${Date.now()}-${Math.round(Math.random() * 1e9)}${extension}`;

        cb(null, filename);
    }
});

const uploadProfile = multer({
  storage: profileStorage,

    limits: {
        fileSize: 5 * 1024 * 1024
    },

    fileFilter: (_req, file, cb) => {

        const allowed = [
            'image/jpeg',
            'image/png',
            'image/webp'
        ];

        if (!allowed.includes(file.mimetype)) {
            return cb(
                new Error('Solo se permiten imágenes JPG, PNG o WEBP.')
            );
        }

        cb(null, true);
    }
});

const PgStore = pgSession(session);
const SESSION_MAX_AGE = 1000 * 60 * 60 * 24 * 30;

app.set('view engine', 'ejs');
app.set('views', path.join(ROOT, 'views'));

app.use(helmet({ contentSecurityPolicy: false }));
app.use(morgan('dev'));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));
app.use('/uploads', express.static(uploadDir));
app.set('trust proxy', process.env.NODE_ENV === 'production' ? 1 : 0);

app.use(
  session({
    store: new PgStore({
      pool,
      tableName: 'sessions',
      ttl: 30 * 24 * 60 * 60
    }),
    secret: process.env.SESSION_SECRET || 'dev-secret-change-me',
    resave: false,
    saveUninitialized: false,
    rolling: true,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      maxAge: SESSION_MAX_AGE
    }
  })
);

// ============================================================
// HELPERS
// ============================================================

function calculateAge(birthDate: string): number {
  const birth = new Date(`${birthDate}T00:00:00`);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const month = today.getMonth() - birth.getMonth();
  if (month < 0 || (month === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
}

/**
 * Obtiene la categoría automática según la edad usando la tabla categories
 * con min_age y max_age (más flexible que Sub-12 exacto)
 */
async function getCategoryByAge(age: number) {
  if (age < 12 || age > 18) return null;

  return await one<any>(
    `
    SELECT id, name
    FROM categories
    WHERE min_age <= $1
      AND max_age >= $1
      AND active = true
    LIMIT 1
    `,
    [age]
  );
}

const render = (view: string, data: any = {}) => (req: Request, res: Response) =>
  res.render(view, data);

// ============================================================
// GLOBAL VARIABLES
// ============================================================

app.use(async (req, res, next) => {
  try {
    res.locals.user = req.session.user || null;
    res.locals.clubName = process.env.CLUB_NAME || 'Elite Soccer';
    res.locals.path = req.path;

    res.locals.unread = req.session.user
      ? Number(
          (
            await one<{ count: number }>(
              `
              SELECT COUNT(*)::int AS count
              FROM notifications
              WHERE user_id = $1 AND read = false
              `,
              [req.session.user.id]
            )
          )?.count || 0
        )
      : 0;

    next();
  } catch (error) {
    next(error);
  }
});

// ============================================================
// HOME
// ============================================================

app.get('/', async (req, res) => {
  const [matches, news, players] = await Promise.all([
    q(`
      SELECT m.*, c.name AS category_name
      FROM matches m
      LEFT JOIN categories c ON c.id = m.category_id
      WHERE m.status = 'scheduled'
      ORDER BY match_date, match_time
      LIMIT 3
    `),
    q(`
      SELECT *
      FROM news
      WHERE published = true
      ORDER BY published_at DESC NULLS LAST, created_at DESC
      LIMIT 3
    `),
    q(`
      SELECT id, full_name, dorsal, position, photo_url
      FROM players
      WHERE active = true
      ORDER BY full_name
      LIMIT 8
    `)
  ]);

  res.render('pages/home', { matches, news, players });
});

// ============================================================
// EQUIPO (PÚBLICO)
// ============================================================

app.get('/equipo', async (req, res) => {
  const players = await q(`
    SELECT p.*, c.name AS category_name
    FROM players p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = true
    ORDER BY c.name, p.dorsal NULLS LAST, p.full_name
  `);

  res.render('pages/team', { players });
});

// ============================================================
// NOTICIAS
// ============================================================

app.get('/noticias', async (req, res) => {
  const news = await q(`
    SELECT n.*, u.name AS author_name
    FROM news n
    LEFT JOIN users u ON u.id = n.author_id
    WHERE n.published = true
    ORDER BY n.published_at DESC NULLS LAST, n.created_at DESC
  `);

  res.render('pages/news', { news });
});

app.get('/noticias/:slug', async (req, res) => {
  const item = await one(
    `
    SELECT n.*, u.name AS author_name
    FROM news n
    LEFT JOIN users u ON u.id = n.author_id
    WHERE slug = $1 AND published = true
    `,
    [req.params.slug]
  );

  if (!item) {
    return res.status(404).render('pages/error', {
      title: 'Noticia no encontrada',
      message: 'La noticia no existe.'
    });
  }

  res.render('pages/news-detail', { item });
});

// ============================================================
// GALERÍA
// ============================================================

app.get('/galeria', async (req, res) => {
  const albums = await q(`
    SELECT *
    FROM gallery_albums
    ORDER BY event_date DESC NULLS LAST, created_at DESC
  `);

  res.render('pages/gallery', { albums });
});

app.get('/galeria/admin', requireRole('admin', 'coach'), async (req, res) => {
  const albums = await q(`
    SELECT *
    FROM gallery_albums
    ORDER BY created_at DESC
  `);

  res.render('pages/gallery-admin', { albums });
});

app.post(
  '/galeria/admin',
  requireRole('admin', 'coach'),
  upload.single('cover'),
  async (req, res) => {
    const b = req.body;
    const cover = req.file ? `/uploads/${req.file.filename}` : b.cover_url || null;

    const album = await one<any>(
      `
      INSERT INTO gallery_albums (name, description, event_date, cover_url)
      VALUES ($1, $2, $3, $4)
      RETURNING id
      `,
      [b.name, b.description || null, b.event_date || null, cover]
    );

    await audit(req.session.user!.id, 'Crear álbum', 'gallery_album', album?.id);
    res.redirect('/galeria/admin');
  }
);

// ============================================================
// CALENDARIO
// ============================================================

app.get('/calendario', async (req, res) => {
  const [trainings, matches] = await Promise.all([
    q(`
      SELECT id, title, date, start_time, location, 'training' AS kind
      FROM trainings
    `),
    q(`
      SELECT id, opponent AS match_title, match_date AS date, match_time AS start_time, location, 'match' AS kind
      FROM matches
    `)
  ]);

  res.render('pages/calendar', { events: [...trainings, ...matches] });
});

// ============================================================
// TIENDA
// ============================================================

app.get('/tienda', async (req, res) => {
  const products = await q(`
    SELECT *
    FROM products
    WHERE active = true
    ORDER BY created_at DESC
  `);

  res.render('pages/shop', { products });
});

// ============================================================
// ÚNETE (Solicitud de prueba)
// ============================================================

app.get('/unete', render('pages/join'));

app.post('/unete', async (req, res) => {
  await q(
    `
    INSERT INTO announcements (title, message, priority, audience)
    VALUES ($1, $2, 'high', 'admin')
    `,
    ['Solicitud de prueba', JSON.stringify(req.body)]
  );

  res.render('pages/success', {
    title: 'Solicitud enviada',
    message: 'Recibimos tu solicitud. Elite Soccer se pondrá en contacto contigo.'
  });
});

// ============================================================
// LOGIN
// ============================================================

app.get('/login', (req, res) => {

  if (req.session.user) {
    return res.redirect('/dashboard');
  }

  let success: string | null = null;

  if (req.query.registered === 'coach') {

    success =
      'Cuenta de entrenador creada correctamente. Ya puedes iniciar sesión.';

  }

  if (req.query.registered === 'pending') {

    success =
      'Cuenta creada correctamente. Tu registro está pendiente de aprobación por parte de Elite Soccer.';

  }

  res.render('pages/login', {
    error: null,
    success
  });

});

// ============================================================
// REGISTRO
// ============================================================

app.get('/registro', (req, res) => {
  res.render('pages/register', {
    title: 'Crear cuenta',
    error: null,
    success: null,
    form: {}
  });
});

app.post(
  '/registro',
  uploadProfile.single('profile_photo'),
  async (req, res) => {

    try {

      // ==========================================================
      // DATOS BÁSICOS
      // ==========================================================

      const name = String(req.body.name || '').trim();

      const email = String(req.body.email || '')
        .trim()
        .toLowerCase();

      const password = String(req.body.password || '');

      const confirm = String(req.body.confirm_password || '');

      const role = [
        'player',
        'guardian',
        'coach'
      ].includes(req.body.role)
        ? req.body.role
        : 'player';


      // ==========================================================
      // DATOS DEL JUGADOR
      // ==========================================================

      const dorsalRaw =
        String(req.body.dorsal || '').trim();

      const position =
        String(req.body.position || '').trim();

      const dominantFoot =
        String(req.body.dominant_foot || '').trim();

      const birthDate =
        String(req.body.birth_date || '').trim();

      const heightRaw =
        String(req.body.height_cm || '').trim();

      const weightRaw =
        String(req.body.weight_kg || '').trim();


      // ==========================================================
      // DATOS DEL ACUDIENTE
      // ==========================================================

      const guardianName =
        String(req.body.guardian_name || '').trim();

      const guardianEmail =
        String(req.body.guardian_email || '')
          .trim()
          .toLowerCase();

      const guardianPhone =
        String(req.body.guardian_phone || '').trim();

      const guardianRelationship =
        String(req.body.guardian_relationship || '').trim();


      // ==========================================================
      // CÓDIGO DE ENTRENADOR
      // ==========================================================

      const coachCode =
        String(req.body.coach_code || '').trim();


      // ==========================================================
      // FOTO
      // ==========================================================

      const profilePhoto =
        req.file
          ? `/uploads/profiles/${req.file.filename}`
          : null;


      // ==========================================================
      // FORMULARIO PARA CONSERVAR DATOS
      // ==========================================================

      const form = {
        name,
        email,
        role,
        dorsal: dorsalRaw,
        position,
        dominant_foot: dominantFoot,
        birth_date: birthDate,
        height_cm: heightRaw,
        weight_kg: weightRaw,

        guardian_name: guardianName,
        guardian_email: guardianEmail,
        guardian_phone: guardianPhone,
        guardian_relationship: guardianRelationship
      };


      // ==========================================================
      // VALIDAR NOMBRE
      // ==========================================================

      if (name.length < 3 || name.length > 120) {

        return res.status(400).render(
          'pages/register',
          {
            title: 'Crear cuenta',
            error:
              'El nombre debe tener entre 3 y 120 caracteres.',
            success: null,
            form
          }
        );

      }


      // ==========================================================
      // VALIDAR EMAIL
      // ==========================================================

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {

        return res.status(400).render(
          'pages/register',
          {
            title: 'Crear cuenta',
            error:
              'Introduce un correo electrónico válido.',
            success: null,
            form
          }
        );

      }


      // ==========================================================
      // VALIDAR CONTRASEÑA
      // ==========================================================

      if (password.length < 8) {

        return res.status(400).render(
          'pages/register',
          {
            title: 'Crear cuenta',
            error:
              'La contraseña debe tener al menos 8 caracteres.',
            success: null,
            form
          }
        );

      }


      if (password !== confirm) {

        return res.status(400).render(
          'pages/register',
          {
            title: 'Crear cuenta',
            error:
              'Las contraseñas no coinciden.',
            success: null,
            form
          }
        );

      }


      // ==========================================================
      // COMPROBAR EMAIL
      // ==========================================================

      const exists = await one<any>(
        `
        SELECT id
        FROM users
        WHERE lower(email) = lower($1)
        LIMIT 1
        `,
        [email]
      );


      if (exists) {

        return res.status(409).render(
          'pages/register',
          {
            title: 'Crear cuenta',
            error:
              'Ya existe una cuenta con ese correo.',
            success: null,
            form
          }
        );

      }


      // ==========================================================
      // VARIABLES
      // ==========================================================

      let dorsal: number | null = null;

      let height: number | null = null;

      let weight: number | null = null;

      let age: number | null = null;

      let category: any = null;


      // ==========================================================
      // REGISTRO DE JUGADOR
      // ==========================================================

      if (role === 'player') {

        // --------------------------------------------------------
        // DORSAL
        // --------------------------------------------------------

        if (!dorsalRaw) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error: 'Debes indicar tu dorsal.',
              success: null,
              form
            }
          );

        }


        dorsal = Number(dorsalRaw);


        if (
          !Number.isInteger(dorsal) ||
          dorsal < 1 ||
          dorsal > 99
        ) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'El dorsal debe estar entre 1 y 99.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // POSICIÓN
        // --------------------------------------------------------

        const validPositions = [
          'goalkeeper',
          'defender',
          'right_back',
          'left_back',
          'central_midfielder',
          'attacking_midfielder',
          'defensive_midfielder',
          'right_midfielder',
          'left_midfielder',
          'right_winger',
          'left_winger',
          'striker',
          'false_nine'
        ];


        if (!validPositions.includes(position)) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes seleccionar una posición válida.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // PIERNA
        // --------------------------------------------------------

        const validFeet = [
          'right',
          'left',
          'ambidextrous'
        ];


        if (!validFeet.includes(dominantFoot)) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes seleccionar tu pierna dominante.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // FECHA
        // --------------------------------------------------------

        if (!birthDate) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar tu fecha de nacimiento.',
              success: null,
              form
            }
          );

        }


        const parsedBirth =
          new Date(`${birthDate}T00:00:00`);


        if (Number.isNaN(parsedBirth.getTime())) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'La fecha de nacimiento no es válida.',
              success: null,
              form
            }
          );

        }


        age = calculateAge(birthDate);


        if (age < 12 || age > 18) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Elite Soccer actualmente registra jugadores entre 12 y 18 años.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // ALTURA
        // --------------------------------------------------------

        if (!heightRaw) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error: 'Debes indicar tu altura.',
              success: null,
              form
            }
          );

        }


        height = Number(heightRaw);


        if (
          !Number.isFinite(height) ||
          height < 100 ||
          height > 230
        ) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'La altura debe estar entre 100 y 230 cm.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // PESO
        // --------------------------------------------------------

        if (!weightRaw) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error: 'Debes indicar tu peso.',
              success: null,
              form
            }
          );

        }


        weight = Number(weightRaw);


        if (
          !Number.isFinite(weight) ||
          weight < 20 ||
          weight > 180
        ) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'El peso debe estar entre 20 y 180 kg.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // CATEGORÍA
        // --------------------------------------------------------

        category =
          await getCategoryByAge(age);


        if (!category) {

          return res.status(500).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                `No existe una categoría activa para la edad ${age}.`,
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // ACUDIENTE
        // --------------------------------------------------------

        if (!guardianName) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar el nombre del padre, madre o tutor.',
              success: null,
              form
            }
          );

        }


        if (!guardianRelationship) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar el parentesco del acudiente.',
              success: null,
              form
            }
          );

        }


        if (!guardianPhone) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar el teléfono del acudiente.',
              success: null,
              form
            }
          );

        }


        if (!guardianEmail) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar el correo del acudiente.',
              success: null,
              form
            }
          );

        }


        if (
          !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
            guardianEmail
          )
        ) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'El correo del acudiente no es válido.',
              success: null,
              form
            }
          );

        }


        // --------------------------------------------------------
        // DORSAL ÚNICO
        // --------------------------------------------------------

        const dorsalExists =
          await one<any>(
            `
            SELECT id
            FROM players
            WHERE dorsal = $1
              AND active = true
            LIMIT 1
            `,
            [dorsal]
          );


        if (dorsalExists) {

          return res.status(409).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Ese dorsal ya está siendo utilizado por otro jugador.',
              success: null,
              form
            }
          );

        }

      }


      // ==========================================================
      // REGISTRO DE ACUDIENTE
      // ==========================================================

      if (role === 'guardian') {

        if (!guardianPhone) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar el teléfono del acudiente.',
              success: null,
              form
            }
          );

        }


        if (!guardianRelationship) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes indicar el parentesco.',
              success: null,
              form
            }
          );

        }

      }


      // ==========================================================
      // REGISTRO DE ENTRENADOR
      // ==========================================================

      if (role === 'coach') {

        if (!coachCode) {

          return res.status(400).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'Debes introducir el código secreto de entrenador.',
              success: null,
              form
            }
          );

        }


        const storedCode =
          await one<{ value: string }>(
            `
            SELECT value
            FROM club_settings
            WHERE key = 'coach_invitation_code'
            LIMIT 1
            `
          );


        if (
          !storedCode ||
          storedCode.value !== coachCode
        ) {

          return res.status(403).render(
            'pages/register',
            {
              title: 'Crear cuenta',
              error:
                'El código secreto de entrenador es incorrecto.',
              success: null,
              form
            }
          );

        }

      }


      // ==========================================================
      // CREAR HASH
      // ==========================================================

      const hash =
        await bcrypt.hash(password, 12);


      // ==========================================================
      // APROBACIÓN
      // ==========================================================

      const approved =
        role === 'coach';


      // ==========================================================
      // CREAR USUARIO
      // ==========================================================

      const u =
        await one<any>(
          `
          INSERT INTO users
          (
            name,
            email,
            password_hash,
            role,
            approved,
            active
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            true
          )
          RETURNING id
          `,
          [
            name,
            email,
            hash,
            role,
            approved
          ]
        );


      if (!u) {
        throw new Error(
          'No se pudo crear el usuario.'
        );
      }


      // ==========================================================
      // CREAR ENTRENADOR
      // ==========================================================

      if (role === 'coach') {

        await q(
          `
          INSERT INTO coaches
          (
            user_id,
            full_name,
            photo_url,
            active
          )
          VALUES
          (
            $1,
            $2,
            $3,
            true
          )
          `,
          [
            u.id,
            name,
            profilePhoto
          ]
        );

      }


      // ==========================================================
      // CREAR ACUDIENTE
      // ==========================================================

      if (role === 'guardian') {

        await q(
          `
          INSERT INTO guardians
          (
            user_id,
            full_name,
            relationship,
            phone
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4
          )
          `,
          [
            u.id,
            name,
            guardianRelationship,
            guardianPhone
          ]
        );

      }


      // ==========================================================
      // CREAR JUGADOR
      // ==========================================================

      if (role === 'player') {

        // --------------------------------------------------------
        // BUSCAR O CREAR ACUDIENTE
        // --------------------------------------------------------

        let guardianUser =
          await one<any>(
            `
            SELECT id
            FROM users
            WHERE lower(email) = lower($1)
              AND role = 'guardian'
            LIMIT 1
            `,
            [guardianEmail]
          );


        // --------------------------------------------------------
        // SI EL ACUDIENTE NO EXISTE,
        // CREAR CUENTA AUTOMÁTICAMENTE
        // --------------------------------------------------------

        if (!guardianUser) {

          const guardianPassword =
            crypto.randomBytes(18).toString('hex');


          const guardianHash =
            await bcrypt.hash(
              guardianPassword,
              12
            );


          guardianUser =
            await one<any>(
              `
              INSERT INTO users
              (
                name,
                email,
                password_hash,
                role,
                approved,
                active
              )
              VALUES
              (
                $1,
                $2,
                $3,
                'guardian',
                false,
                true
              )
              RETURNING id
              `,
              [
                guardianName,
                guardianEmail,
                guardianHash
              ]
            );


          if (!guardianUser) {
            throw new Error(
              'No se pudo crear la cuenta del acudiente.'
            );
          }


          await q(
            `
            INSERT INTO guardians
            (
              user_id,
              full_name,
              relationship,
              phone
            )
            VALUES
            (
              $1,
              $2,
              $3,
              $4
            )
            `,
            [
              guardianUser.id,
              guardianName,
              guardianRelationship,
              guardianPhone
            ]
          );

        }


        // --------------------------------------------------------
        // CREAR JUGADOR
        // --------------------------------------------------------

        await q(
          `
          INSERT INTO players
          (
            user_id,
            guardian_id,
            full_name,
            dorsal,
            position,
            dominant_foot,
            birth_date,
            height_cm,
            weight_kg,
            category_id,
            photo_url,
            active,
            approved
          )
          VALUES
          (
            $1,
            $2,
            $3,
            $4,
            $5,
            $6,
            $7,
            $8,
            $9,
            $10,
            $11,
            true,
            false
          )
          `,
          [
            u.id,
            guardianUser.id,
            name,
            dorsal,
            position,
            dominantFoot,
            birthDate,
            height,
            weight,
            category.id,
            profilePhoto
          ]
        );

      }


      // ==========================================================
      // AUDITORÍA
      // ==========================================================

      await audit(
        u.id,
        'Crear cuenta',
        'user',
        u.id,
        {
          role,
          age,
          category: category?.name || null,
          profile_photo: profilePhoto || null
        }
      );


      // ==========================================================
      // REDIRECCIÓN
      // ==========================================================

      if (role === 'coach') {

        return res.redirect(
          '/login?registered=coach'
        );

      }


      return res.redirect(
        '/login?registered=pending'
      );


    } catch (error) {

      console.error(
        'Error en registro:',
        error
      );


      // ----------------------------------------------------------
      // BORRAR FOTO SI FALLÓ EL REGISTRO
      // ----------------------------------------------------------

      if (req.file) {

        try {
          fs.unlinkSync(req.file.path);
        } catch {}

      }


      return res.status(500).render(
        'pages/register',
        {
          title: 'Crear cuenta',

          error:
            'No se pudo crear la cuenta. Inténtalo nuevamente.',

          success: null,

          form: {
            name:
              String(req.body.name || '').trim(),

            email:
              String(req.body.email || '')
                .trim()
                .toLowerCase(),

            role:
              req.body.role || 'player',

            dorsal:
              String(req.body.dorsal || '').trim(),

            position:
              String(req.body.position || '').trim(),

            dominant_foot:
              String(req.body.dominant_foot || '').trim(),

            birth_date:
              String(req.body.birth_date || '').trim(),

            height_cm:
              String(req.body.height_cm || '').trim(),

            weight_kg:
              String(req.body.weight_kg || '').trim(),

            guardian_name:
              String(req.body.guardian_name || '').trim(),

            guardian_email:
              String(req.body.guardian_email || '')
                .trim()
                .toLowerCase(),

            guardian_phone:
              String(req.body.guardian_phone || '').trim(),

            guardian_relationship:
              String(
                req.body.guardian_relationship || ''
              ).trim()
          }
        }
      );

    }

  }
);
// ============================================================
// LOGIN (POST)
// ============================================================

app.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    const u = await one<any>(
      `
      SELECT id, name, email, password_hash, role, status, approved, active
      FROM users
      WHERE lower(email) = lower($1)
      LIMIT 1
      `,
      [email]
    );

    if (!u || !u.active || !(await bcrypt.compare(password, u.password_hash))) {
      return res.status(401).render('pages/login', {
        error: 'Correo o contraseña incorrectos.'
      });
    }

    if (!u.approved) {
      return res.status(403).render('pages/login', {
        error: 'Tu cuenta está pendiente de aprobación por parte de Elite Soccer.'
      });
    }

    req.session.regenerate(async err => {
      if (err) {
        console.error('Error creando sesión:', err);
        return res.status(500).render('pages/login', {
          error: 'No se pudo iniciar sesión. Inténtalo nuevamente.'
        });
      }

      req.session.user = {
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        status: u.status
      };
      req.session.cookie.maxAge = SESSION_MAX_AGE;

      await audit(u.id, 'Inicio de sesión', 'user', u.id);

      req.session.save(saveErr => {
        if (saveErr) {
          console.error('Error guardando sesión:', saveErr);
          return res.status(500).render('pages/login', {
            error: 'No se pudo guardar la sesión. Inténtalo nuevamente.'
          });
        }
        res.redirect('/dashboard');
      });
    });
  } catch (error) {
    console.error('Error en login:', error);
    return res.status(500).render('pages/login', {
      error: 'Ocurrió un error al iniciar sesión.'
    });
  }
});

// ============================================================
// LOGOUT
// ============================================================

app.post('/logout', requireAuth, (req, res) => {
  req.session.destroy(() => {
    res.redirect('/');
  });
});

// ============================================================
// DASHBOARD
// ============================================================

app.get('/dashboard', requireAuth, async (req, res) => {
  const [players, trainings, matches, orders, payments] = await Promise.all([
    q<any>(`SELECT COUNT(*)::int count FROM players WHERE active = true`),
    q(`
      SELECT * FROM trainings
      WHERE date >= CURRENT_DATE
      ORDER BY date, start_time
      LIMIT 5
    `),
    q(`
      SELECT * FROM matches
      WHERE match_date >= CURRENT_DATE
      ORDER BY match_date, match_time
      LIMIT 5
    `),
    q<any>(`
      SELECT COUNT(*)::int count
      FROM orders
      WHERE status IN ('pending', 'confirmed', 'production')
    `),
    q<any>(`
      SELECT COUNT(*)::int count
      FROM payments
      WHERE status IN ('pending', 'overdue')
    `)
  ]);

  res.render('pages/dashboard', {
    stats: {
      players: players[0]?.count || 0,
      orders: orders[0]?.count || 0,
      payments: payments[0]?.count || 0
    },
    trainings,
    matches
  });
});

// ============================================================
// JUGADORES (Administración)
// ============================================================

app.get('/jugadores', requireAuth, async (req, res) => {
  const players = await q(`
    SELECT p.*, c.name AS category_name
    FROM players p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.active = true
    ORDER BY p.full_name
  `);

  res.render('pages/players', { players });
});

app.get('/jugadores/nuevo', requireRole('admin', 'coach'), async (req, res) => {
  res.render('pages/player-form', { player: null });
});

app.post(
  '/jugadores',
  requireRole('admin', 'coach'),
  upload.single('photo'),
  async (req, res) => {
    try {
      const b = req.body;
      const photo = req.file ? `/uploads/${req.file.filename}` : b.photo_url || null;
      const birthDate = String(b.birth_date || '').trim();

      if (!birthDate) {
        return res.status(400).send('La fecha de nacimiento es obligatoria.');
      }

      const age = calculateAge(birthDate);
      const category = await getCategoryByAge(age);

      if (!category) {
        return res.status(400).send('No existe una categoría para la edad del jugador.');
      }

      const dorsal = b.dorsal ? Number(b.dorsal) : null;
      if (dorsal !== null && (!Number.isInteger(dorsal) || dorsal < 1 || dorsal > 99)) {
        return res.status(400).send('Dorsal inválido.');
      }

      const p = await one<any>(
        `
        INSERT INTO players (
          full_name, dorsal, position, dominant_foot, birth_date,
          height_cm, weight_kg, category_id, photo_url
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
        `,
        [b.full_name, dorsal, b.position || null, b.dominant_foot || null, birthDate, b.height_cm || null, b.weight_kg || null, category.id, photo]
      );

      await audit(req.session.user!.id, 'Crear jugador', 'player', p?.id);
      res.redirect('/jugadores');
    } catch (error) {
      console.error('Error creando jugador:', error);
      res.status(500).send('No se pudo crear el jugador.');
    }
  }
);

app.post('/jugadores/:id/desactivar', requireRole('admin', 'coach'), async (req, res) => {
  await q(`UPDATE players SET active = false WHERE id = $1`, [req.params.id]);
  await audit(req.session.user!.id, 'Desactivar jugador', 'player', Number(req.params.id));
  res.redirect('/jugadores');
});

app.get('/jugadores/:id', requireAuth, async (req, res) => {
  const player = await one<any>(
    `
    SELECT p.*, c.name AS category_name
    FROM players p
    LEFT JOIN categories c ON c.id = p.category_id
    WHERE p.id = $1
    `,
    [req.params.id]
  );

  if (!player) {
    return res.status(404).render('pages/error', {
      title: 'Jugador no encontrado',
      message: ''
    });
  }

  const [evaluations, stats] = await Promise.all([
    q(
      `
      SELECT e.*, u.name evaluator_name
      FROM player_evaluations e
      LEFT JOIN users u ON u.id = e.evaluator_id
      WHERE player_id = $1
      ORDER BY evaluated_at DESC
      `,
      [req.params.id]
    ),
    one<any>(
      `
      SELECT
        COUNT(DISTINCT ce.match_id)::int matches,
        COUNT(*) FILTER (WHERE ce.event_type = 'goal')::int goals,
        COUNT(*) FILTER (WHERE ce.event_type = 'assist')::int assists,
        COUNT(*) FILTER (WHERE ce.event_type = 'mvp')::int mvps
      FROM match_events ce
      WHERE ce.player_id = $1
      `,
      [req.params.id]
    )
  ]);

  res.render('pages/player-detail', {
    player,
    evaluations,
    stats: stats || { matches: 0, goals: 0, assists: 0, mvps: 0 }
  });
});

// ============================================================
// CONFIGURACIÓN - CÓDIGO DE INVITACIÓN PARA ENTRENADORES
// ============================================================

app.get('/configuracion/entrenadores', requireRole('admin'), async (req, res) => {
  const code = await one<{ value: string }>(`
    SELECT value FROM club_settings WHERE key = 'coach_invitation_code'
  `);

  res.render('pages/coach-config', {
    code: code?.value || 'No configurado',
    message: null
  });
});

app.post('/configuracion/entrenadores', requireRole('admin'), async (req, res) => {
  const newCode = String(req.body.code || '').trim();

  if (newCode.length < 4) {
    const code = await one<{ value: string }>(`
      SELECT value FROM club_settings WHERE key = 'coach_invitation_code'
    `);

    return res.render('pages/coach-config', {
      code: code?.value || 'No configurado',
      message: 'El código debe tener al menos 4 caracteres.'
    });
  }

  await q(
    `
    INSERT INTO club_settings (key, value)
    VALUES ('coach_invitation_code', $1)
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `,
    [newCode]
  );

  res.render('pages/coach-config', {
    code: newCode,
    message: '✅ Código de invitación actualizado correctamente.'
  });
});

// ============================================================
// USUARIOS / APROBACIONES
// ============================================================

app.get('/usuarios', requireRole('admin'), async (req, res) => {
  const users = await q(`
    SELECT id, name, email, role, active, approved, created_at
    FROM users
    ORDER BY approved ASC, created_at DESC
  `);

  res.render('pages/users', { users });
});

app.post('/usuarios', requireRole('admin'), async (req, res) => {
  const b = req.body;
  const hash = await bcrypt.hash(b.password, 12);

  await q(
    `
    INSERT INTO users (name, email, password_hash, role, approved)
    VALUES ($1, $2, $3, $4, true)
    `,
    [b.name, b.email, hash, b.role || 'player']
  );

  res.redirect('/usuarios');
});

// Aprobar registro
app.post('/usuarios/:id/aprobar', requireRole('admin'), async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const userResult = await client.query(
      `
      SELECT id, name, role
      FROM users
      WHERE id = $1 AND approved = false
      `,
      [req.params.id]
    );

    if (!userResult.rows.length) {
      await client.query('ROLLBACK');
      return res.redirect('/usuarios');
    }

    const user = userResult.rows[0];

    await client.query(`UPDATE users SET approved = true WHERE id = $1`, [req.params.id]);

    if (user.role === 'player') {
      await client.query(`UPDATE players SET approved = true WHERE user_id = $1`, [req.params.id]);
    }

    await client.query('COMMIT');

    await audit(req.session.user!.id, 'Aprobar registro', 'user', Number(req.params.id));
    res.redirect('/usuarios');
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error aprobando registro:', error);
    res.redirect('/usuarios');
  } finally {
    client.release();
  }
});

// Rechazar registro
app.post('/usuarios/:id/rechazar', requireRole('admin'), async (req, res) => {
  const id = Number(req.params.id);

  if (id === req.session.user!.id) {
    return res.redirect('/usuarios');
  }

  await q(`DELETE FROM users WHERE id = $1 AND approved = false`, [id]);
  await audit(req.session.user!.id, 'Rechazar registro', 'user', id);
  res.redirect('/usuarios');
});

// Toggle activo
app.post('/usuarios/:id/toggle', requireRole('admin'), async (req, res) => {
  await q(`UPDATE users SET active = NOT active WHERE id = $1`, [req.params.id]);
  res.redirect('/usuarios');
});

// ============================================================
// ENTRENAMIENTOS
// ============================================================

app.get('/entrenamientos', requireAuth, async (req, res) => {
  const trainings = await q(`
    SELECT t.*, c.name category_name
    FROM trainings t
    LEFT JOIN categories c ON c.id = t.category_id
    ORDER BY t.date DESC, t.start_time DESC
  `);

  res.render('pages/trainings', { trainings });
});

app.get('/entrenamientos/nuevo', requireRole('admin', 'coach'), async (req, res) => {
  const categories = await q(`SELECT * FROM categories WHERE active = true ORDER BY name`);
  res.render('pages/training-form', { categories });
});

app.post('/entrenamientos', requireRole('admin', 'coach'), async (req, res) => {
  const b = req.body;

  const t = await one<any>(
    `
    INSERT INTO trainings (
      title, training_type, date, start_time, location,
      duration_minutes, objective, notes, category_id, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    RETURNING id
    `,
    [
      b.title,
      b.training_type,
      b.date,
      b.start_time,
      b.location || null,
      b.duration_minutes || null,
      b.objective || null,
      b.notes || null,
      b.category_id || null,
      req.session.user!.id
    ]
  );

  // Crear asistencias para todos los jugadores de la categoría
  const players = await q<any>(
    `
    SELECT id FROM players
    WHERE active = true
    ${b.category_id ? 'AND category_id = $1' : ''}
    `,
    b.category_id ? [b.category_id] : []
  );

  for (const p of players) {
    await q(
      `
      INSERT INTO attendance (training_id, player_id)
      VALUES ($1, $2)
      ON CONFLICT DO NOTHING
      `,
      [t?.id, p.id]
    );
  }

  await audit(req.session.user!.id, 'Crear entrenamiento', 'training', t?.id);
  res.redirect('/entrenamientos');
});

// ============================================================
// PARTIDOS
// ============================================================

app.get('/partidos', requireAuth, async (req, res) => {
  const matches = await q(`
    SELECT m.*, c.name category_name
    FROM matches m
    LEFT JOIN categories c ON c.id = m.category_id
    ORDER BY m.match_date DESC, m.match_time DESC
  `);

  res.render('pages/matches', { matches });
});

app.get('/partidos/nuevo', requireRole('admin', 'coach'), async (req, res) => {
  const categories = await q(`SELECT * FROM categories WHERE active = true ORDER BY name`);
  res.render('pages/match-form', { categories });
});

app.post('/partidos', requireRole('admin', 'coach'), async (req, res) => {
  const b = req.body;

  const m = await one<any>(
    `
    INSERT INTO matches (
      opponent, match_date, match_time, location, competition,
      category_id, home_away, status, notes, created_by
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9)
    RETURNING id
    `,
    [
      b.opponent,
      b.match_date,
      b.match_time || null,
      b.location || null,
      b.competition || null,
      b.category_id || null,
      b.home_away || 'home',
      b.notes || null,
      req.session.user!.id
    ]
  );

  await audit(req.session.user!.id, 'Crear partido', 'match', m?.id);
  res.redirect('/partidos');
});

// ============================================================
// NOTIFICACIONES
// ============================================================

app.get('/notificaciones', requireAuth, async (req, res) => {
  const notifications = await q(
    `
    SELECT * FROM notifications
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [req.session.user!.id]
  );

  await q(`UPDATE notifications SET read = true WHERE user_id = $1`, [req.session.user!.id]);

  res.render('pages/notifications', { notifications });
});

// ============================================================
// HEALTH CHECK
// ============================================================

app.get('/api/health', (_req, res) =>
  res.json({
    ok: true,
    service: 'Elite Soccer',
    version: '2.1.0'
  })
);

app.get('/manifest.json', (_req, res) =>
  res.sendFile(path.join(ROOT, 'public', 'manifest.json'))
);

// ============================================================
// 404
// ============================================================

app.use((_req, res) =>
  res.status(404).render('pages/error', {
    title: 'Página no encontrada',
    message: 'La ruta que buscas no existe.'
  })
);

// ============================================================
// ERROR HANDLER
// ============================================================

app.use((err: any, _req: Request, res: Response, _next: any) => {
  console.error(err);

  res.status(500).render('pages/error', {
    title: 'Error del servidor',
    message:
      process.env.NODE_ENV === 'production'
        ? 'Ha ocurrido un error.'
        : 'Revisa la consola para más detalles.'
  });
});

// ============================================================
// START SERVER
// ============================================================

app.listen(PORT, () => console.log(`Elite Soccer: http://localhost:${PORT}`));