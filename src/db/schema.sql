-- ============================================================
-- ELITE SOCCER
-- BASE DE DATOS COMPLETA
-- PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;


-- ============================================================
-- 1. USUARIOS
-- ============================================================

CREATE TABLE users (
    id SERIAL PRIMARY KEY,

    name VARCHAR(120) NOT NULL,

    email VARCHAR(180) NOT NULL UNIQUE,

    password_hash TEXT NOT NULL,

    role VARCHAR(20) NOT NULL DEFAULT 'player'
        CHECK (
            role IN (
                'admin',
                'coach',
                'player',
                'guardian'
            )
        ),

    active BOOLEAN NOT NULL DEFAULT TRUE,

    /*
     * IMPORTANTE:
     *
     * Los jugadores y acudientes pueden necesitar aprobación.
     *
     * Los entrenadores NO necesitan aprobación.
     * El administrador/entrenador autorizado puede crear
     * directamente su cuenta.
     */
    approved BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 2. CATEGORÍAS
-- ============================================================

CREATE TABLE categories (
    id SERIAL PRIMARY KEY,

    name VARCHAR(80) UNIQUE NOT NULL,

    min_age INTEGER NOT NULL,

    max_age INTEGER NOT NULL,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    CHECK (min_age >= 0),

    CHECK (max_age >= min_age)
);


INSERT INTO categories (
    name,
    min_age,
    max_age
)
VALUES
    ('Sub-12', 12, 12),
    ('Sub-13', 13, 13),
    ('Sub-14', 14, 14),
    ('Sub-15', 15, 15),
    ('Sub-16', 16, 16),
    ('Sub-17', 17, 17),
    ('Sub-18', 18, 18);


-- ============================================================
-- 3. PERFIL DE ENTRENADORES
-- ============================================================

CREATE TABLE coaches (
    id SERIAL PRIMARY KEY,

    user_id INTEGER NOT NULL UNIQUE
        REFERENCES users(id)
        ON DELETE CASCADE,

    full_name VARCHAR(160) NOT NULL,

    birth_date DATE,

    phone VARCHAR(40),

    photo_url TEXT,

    bio TEXT,

    experience TEXT,

    specialty VARCHAR(160),

    preferred_formation VARCHAR(80),

    public_contact BOOLEAN NOT NULL DEFAULT TRUE,

    public_phone BOOLEAN NOT NULL DEFAULT TRUE,

    public_email BOOLEAN NOT NULL DEFAULT TRUE,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        birth_date IS NULL
        OR birth_date <= CURRENT_DATE
    )
);


-- ============================================================
-- 4. JUGADORES
-- ============================================================

CREATE TABLE players (
    id SERIAL PRIMARY KEY,

    user_id INTEGER UNIQUE
        REFERENCES users(id)
        ON DELETE SET NULL,

    guardian_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    category_id INTEGER
        REFERENCES categories(id)
        ON DELETE SET NULL,

    full_name VARCHAR(160) NOT NULL,

    dorsal INTEGER,

    position VARCHAR(60),

    dominant_foot VARCHAR(20),

    birth_date DATE NOT NULL,

    height_cm NUMERIC(5,2),

    weight_kg NUMERIC(5,2),

    photo_url TEXT,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    approved BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (
        dorsal IS NULL
        OR dorsal BETWEEN 1 AND 99
    ),

    CHECK (
        height_cm IS NULL
        OR height_cm BETWEEN 50 AND 250
    ),

    CHECK (
        weight_kg IS NULL
        OR weight_kg BETWEEN 20 AND 250
    ),

    CHECK (
        dominant_foot IS NULL
        OR dominant_foot IN (
            'right',
            'left',
            'ambidextrous'
        )
    ),

    CHECK (
        position IS NULL
        OR position IN (
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
        )
    ),

    CHECK (
        birth_date <= CURRENT_DATE
    )
);


-- ============================================================
-- 5. FUNCIÓN updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


-- ============================================================
-- 6. TRIGGERS updated_at
-- ============================================================

CREATE TRIGGER trg_users_updated_at
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_players_updated_at
BEFORE UPDATE ON players
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


CREATE TRIGGER trg_coaches_updated_at
BEFORE UPDATE ON coaches
FOR EACH ROW
EXECUTE FUNCTION update_updated_at();


-- ============================================================
-- 7. CATEGORÍA AUTOMÁTICA DE JUGADORES
-- ============================================================

CREATE OR REPLACE FUNCTION assign_player_category()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
    player_age INTEGER;
    selected_category_id INTEGER;
BEGIN

    player_age :=
        EXTRACT(
            YEAR FROM AGE(CURRENT_DATE, NEW.birth_date)
        )::INTEGER;

    IF player_age < 12 OR player_age > 18 THEN
        RAISE EXCEPTION
            'El jugador debe tener entre 12 y 18 años. Edad actual: %',
            player_age;
    END IF;

    SELECT id
    INTO selected_category_id
    FROM categories
    WHERE min_age <= player_age
      AND max_age >= player_age
      AND active = TRUE
    LIMIT 1;

    IF selected_category_id IS NULL THEN
        RAISE EXCEPTION
            'No existe una categoría para la edad %.',
            player_age;
    END IF;

    NEW.category_id := selected_category_id;

    RETURN NEW;
END;
$$;


CREATE TRIGGER trg_player_category
BEFORE INSERT OR UPDATE OF birth_date
ON players
FOR EACH ROW
EXECUTE FUNCTION assign_player_category();


-- ============================================================
-- 8. FUNCIÓN PARA OBTENER EDAD
-- ============================================================

CREATE OR REPLACE FUNCTION player_age(
    birth_date DATE
)
RETURNS INTEGER
LANGUAGE SQL
STABLE
AS $$
    SELECT EXTRACT(
        YEAR FROM AGE(CURRENT_DATE, birth_date)
    )::INTEGER;
$$;


-- ============================================================
-- 9. ENTRENAMIENTOS
-- ============================================================

CREATE TABLE trainings (
    id SERIAL PRIMARY KEY,

    title VARCHAR(160) NOT NULL,

    training_type VARCHAR(50) NOT NULL,

    date DATE NOT NULL,

    start_time TIME NOT NULL,

    location VARCHAR(160),

    duration_minutes INTEGER,

    objective TEXT,

    notes TEXT,

    category_id INTEGER
        REFERENCES categories(id)
        ON DELETE SET NULL,

    created_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 10. EJERCICIOS
-- ============================================================

CREATE TABLE training_exercises (
    id SERIAL PRIMARY KEY,

    training_id INTEGER NOT NULL
        REFERENCES trainings(id)
        ON DELETE CASCADE,

    name VARCHAR(160) NOT NULL,

    duration_minutes INTEGER,

    repetitions INTEGER,

    objective TEXT,

    instructions TEXT,

    media_url TEXT,

    sort_order INTEGER NOT NULL DEFAULT 0
);


-- ============================================================
-- 11. ASISTENCIAS
-- ============================================================

CREATE TABLE attendance (
    id SERIAL PRIMARY KEY,

    training_id INTEGER NOT NULL
        REFERENCES trainings(id)
        ON DELETE CASCADE,

    player_id INTEGER NOT NULL
        REFERENCES players(id)
        ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'present',
                'absent',
                'justified',
                'late'
            )
        ),

    note TEXT,

    UNIQUE (
        training_id,
        player_id
    )
);


-- ============================================================
-- 12. PARTIDOS
-- ============================================================

CREATE TABLE matches (
    id SERIAL PRIMARY KEY,

    opponent VARCHAR(160) NOT NULL,

    match_date DATE NOT NULL,

    match_time TIME,

    location VARCHAR(160),

    competition VARCHAR(120),

    category_id INTEGER
        REFERENCES categories(id)
        ON DELETE SET NULL,

    home_away VARCHAR(10)
        CHECK (
            home_away IN (
                'home',
                'away'
            )
        ),

    elite_goals INTEGER,

    opponent_goals INTEGER,

    status VARCHAR(20) NOT NULL DEFAULT 'scheduled'
        CHECK (
            status IN (
                'scheduled',
                'played',
                'cancelled'
            )
        ),

    notes TEXT,

    created_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 13. CONVOCATORIAS
-- ============================================================

CREATE TABLE callups (
    id SERIAL PRIMARY KEY,

    match_id INTEGER NOT NULL
        REFERENCES matches(id)
        ON DELETE CASCADE,

    player_id INTEGER NOT NULL
        REFERENCES players(id)
        ON DELETE CASCADE,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'declined',
                'reserve',
                'not_selected'
            )
        ),

    note TEXT,

    UNIQUE (
        match_id,
        player_id
    )
);


-- ============================================================
-- 14. EVENTOS DE PARTIDO
-- ============================================================

CREATE TABLE match_events (
    id SERIAL PRIMARY KEY,

    match_id INTEGER NOT NULL
        REFERENCES matches(id)
        ON DELETE CASCADE,

    player_id INTEGER
        REFERENCES players(id)
        ON DELETE SET NULL,

    event_type VARCHAR(30) NOT NULL
        CHECK (
            event_type IN (
                'goal',
                'assist',
                'yellow',
                'red',
                'sub_in',
                'sub_out',
                'mvp'
            )
        ),

    minute INTEGER,

    note TEXT
);


-- ============================================================
-- 15. EVALUACIONES
-- ============================================================

CREATE TABLE player_evaluations (
    id SERIAL PRIMARY KEY,

    player_id INTEGER NOT NULL
        REFERENCES players(id)
        ON DELETE CASCADE,

    evaluator_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    evaluated_at DATE NOT NULL DEFAULT CURRENT_DATE,

    passing INTEGER CHECK (passing BETWEEN 1 AND 10),

    control INTEGER CHECK (control BETWEEN 1 AND 10),

    dribbling INTEGER CHECK (dribbling BETWEEN 1 AND 10),

    shooting INTEGER CHECK (shooting BETWEEN 1 AND 10),

    defense INTEGER CHECK (defense BETWEEN 1 AND 10),

    speed INTEGER CHECK (speed BETWEEN 1 AND 10),

    endurance INTEGER CHECK (endurance BETWEEN 1 AND 10),

    tactics INTEGER CHECK (tactics BETWEEN 1 AND 10),

    decision_making INTEGER CHECK (decision_making BETWEEN 1 AND 10),

    discipline INTEGER CHECK (discipline BETWEEN 1 AND 10),

    strengths TEXT,

    improvements TEXT,

    notes TEXT
);


-- ============================================================
-- 16. TÁCTICAS
-- ============================================================

CREATE TABLE tactics (
    id SERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL,

    formation VARCHAR(40),

    category_id INTEGER
        REFERENCES categories(id)
        ON DELETE SET NULL,

    data JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 17. TORNEOS
-- ============================================================

CREATE TABLE tournaments (
    id SERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL,

    start_date DATE,

    end_date DATE,

    location VARCHAR(160),

    category_id INTEGER
        REFERENCES categories(id)
        ON DELETE SET NULL,

    format VARCHAR(80),

    notes TEXT,

    active BOOLEAN NOT NULL DEFAULT TRUE
);


-- ============================================================
-- 18. NOTICIAS
-- ============================================================

CREATE TABLE news (
    id SERIAL PRIMARY KEY,

    title VARCHAR(200) NOT NULL,

    slug VARCHAR(220) UNIQUE NOT NULL,

    excerpt TEXT,

    content TEXT NOT NULL,

    image_url TEXT,

    published BOOLEAN NOT NULL DEFAULT FALSE,

    published_at TIMESTAMPTZ,

    author_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 19. GALERÍA
-- ============================================================

CREATE TABLE gallery_albums (
    id SERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL,

    description TEXT,

    event_date DATE,

    cover_url TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE gallery_items (
    id SERIAL PRIMARY KEY,

    album_id INTEGER
        REFERENCES gallery_albums(id)
        ON DELETE CASCADE,

    media_url TEXT NOT NULL,

    media_type VARCHAR(20) NOT NULL DEFAULT 'image',

    caption TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 20. PRODUCTOS
-- ============================================================

CREATE TABLE products (
    id SERIAL PRIMARY KEY,

    name VARCHAR(160) NOT NULL,

    description TEXT,

    price NUMERIC(12,2) NOT NULL DEFAULT 0,

    stock INTEGER NOT NULL DEFAULT 0,

    image_url TEXT,

    active BOOLEAN NOT NULL DEFAULT TRUE,

    approved BOOLEAN NOT NULL DEFAULT TRUE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (price >= 0),

    CHECK (stock >= 0)
);


-- ============================================================
-- 21. PEDIDOS
-- ============================================================

CREATE TABLE orders (
    id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    status VARCHAR(30) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'confirmed',
                'production',
                'ready',
                'delivered',
                'cancelled'
            )
        ),

    total NUMERIC(12,2) NOT NULL DEFAULT 0,

    name VARCHAR(160),

    dorsal INTEGER,

    size VARCHAR(10),

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (total >= 0)
);


CREATE TABLE order_items (
    id SERIAL PRIMARY KEY,

    order_id INTEGER NOT NULL
        REFERENCES orders(id)
        ON DELETE CASCADE,

    product_id INTEGER
        REFERENCES products(id)
        ON DELETE SET NULL,

    quantity INTEGER NOT NULL DEFAULT 1,

    unit_price NUMERIC(12,2) NOT NULL DEFAULT 0,

    CHECK (quantity > 0),

    CHECK (unit_price >= 0)
);


-- ============================================================
-- 22. PAGOS
-- ============================================================

CREATE TABLE payments (
    id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    player_id INTEGER
        REFERENCES players(id)
        ON DELETE SET NULL,

    concept VARCHAR(160) NOT NULL,

    amount NUMERIC(12,2) NOT NULL,

    status VARCHAR(20) NOT NULL DEFAULT 'pending'
        CHECK (
            status IN (
                'pending',
                'paid',
                'overdue',
                'cancelled'
            )
        ),

    due_date DATE,

    paid_at TIMESTAMPTZ,

    notes TEXT,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CHECK (amount >= 0)
);


-- ============================================================
-- 23. NOTIFICACIONES
-- ============================================================

CREATE TABLE notifications (
    id SERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id)
        ON DELETE CASCADE,

    title VARCHAR(160) NOT NULL,

    message TEXT NOT NULL,

    type VARCHAR(40) NOT NULL DEFAULT 'info',

    read BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 24. ANUNCIOS
-- ============================================================

CREATE TABLE announcements (
    id SERIAL PRIMARY KEY,

    title VARCHAR(180) NOT NULL,

    message TEXT NOT NULL,

    priority VARCHAR(20) NOT NULL DEFAULT 'normal',

    audience VARCHAR(30) NOT NULL DEFAULT 'all',

    created_by INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 25. REGLAMENTO
-- ============================================================

CREATE TABLE rule_versions (
    id SERIAL PRIMARY KEY,

    title VARCHAR(180) NOT NULL,

    content TEXT NOT NULL,

    version VARCHAR(30) NOT NULL,

    published BOOLEAN NOT NULL DEFAULT FALSE,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


CREATE TABLE rule_acceptances (
    id SERIAL PRIMARY KEY,

    rule_version_id INTEGER NOT NULL
        REFERENCES rule_versions(id)
        ON DELETE CASCADE,

    user_id INTEGER NOT NULL
        REFERENCES users(id)
        ON DELETE CASCADE,

    accepted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (
        rule_version_id,
        user_id
    )
);


-- ============================================================
-- 26. AUDITORÍA
-- ============================================================

CREATE TABLE audit_logs (
    id BIGSERIAL PRIMARY KEY,

    user_id INTEGER
        REFERENCES users(id)
        ON DELETE SET NULL,

    action VARCHAR(160) NOT NULL,

    entity VARCHAR(80),

    entity_id INTEGER,

    details JSONB,

    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);


-- ============================================================
-- 27. CONFIGURACIÓN DEL CLUB
-- ============================================================

CREATE TABLE club_settings (
    key VARCHAR(80) PRIMARY KEY,

    value TEXT NOT NULL
);


-- ============================================================
-- 28. SESIONES
-- ============================================================

CREATE TABLE sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,

    sess JSON NOT NULL,

    expire TIMESTAMP(6) NOT NULL
);


-- ============================================================
-- 29. CONFIGURACIÓN INICIAL
-- ============================================================

INSERT INTO club_settings (
    key,
    value
)
VALUES
    (
        'club_name',
        'Elite Soccer'
    ),
    (
        'club_slogan',
        'Talento, disciplina y corazón. Jugamos como equipo, vivimos como familia.'
    ),
    (
        'registration_min_age',
        '12'
    ),
    (
        'registration_max_age',
        '18'
    ),
    (
        'registration_requires_approval',
        'true'
    ),
    (
        'registration_category_automatic',
        'true'
    ),
    (
        'coach_registration_enabled',
        'true'
    );


-- ============================================================
-- 30. ÍNDICES
-- ============================================================

CREATE INDEX idx_users_role
    ON users(role);

CREATE INDEX idx_users_approved
    ON users(approved);

CREATE INDEX idx_users_active
    ON users(active);


CREATE INDEX idx_coaches_user_id
    ON coaches(user_id);

CREATE INDEX idx_coaches_active
    ON coaches(active);


CREATE INDEX idx_players_user_id
    ON players(user_id);

CREATE INDEX idx_players_guardian_id
    ON players(guardian_id);

CREATE INDEX idx_players_category_id
    ON players(category_id);

CREATE INDEX idx_players_position
    ON players(position);

CREATE INDEX idx_players_birth_date
    ON players(birth_date);

CREATE INDEX idx_players_approved
    ON players(approved);

CREATE INDEX idx_players_active
    ON players(active);


CREATE INDEX idx_trainings_date
    ON trainings(date);

CREATE INDEX idx_trainings_category
    ON trainings(category_id);

CREATE INDEX idx_training_exercises_training
    ON training_exercises(training_id);


CREATE INDEX idx_attendance_training
    ON attendance(training_id);

CREATE INDEX idx_attendance_player
    ON attendance(player_id);


CREATE INDEX idx_matches_date
    ON matches(match_date);

CREATE INDEX idx_matches_category
    ON matches(category_id);

CREATE INDEX idx_matches_status
    ON matches(status);


CREATE INDEX idx_callups_match
    ON callups(match_id);

CREATE INDEX idx_callups_player
    ON callups(player_id);

CREATE INDEX idx_callups_status
    ON callups(status);


CREATE INDEX idx_match_events_match
    ON match_events(match_id);

CREATE INDEX idx_match_events_player
    ON match_events(player_id);


CREATE INDEX idx_evaluations_player
    ON player_evaluations(player_id);

CREATE INDEX idx_evaluations_date
    ON player_evaluations(evaluated_at);


CREATE INDEX idx_tactics_category
    ON tactics(category_id);


CREATE INDEX idx_tournaments_category
    ON tournaments(category_id);

CREATE INDEX idx_tournaments_active
    ON tournaments(active);


CREATE INDEX idx_news_published
    ON news(published);

CREATE INDEX idx_news_published_at
    ON news(published_at);


CREATE INDEX idx_gallery_items_album
    ON gallery_items(album_id);


CREATE INDEX idx_orders_user
    ON orders(user_id);

CREATE INDEX idx_orders_status
    ON orders(status);


CREATE INDEX idx_order_items_order
    ON order_items(order_id);


CREATE INDEX idx_payments_user
    ON payments(user_id);

CREATE INDEX idx_payments_player
    ON payments(player_id);

CREATE INDEX idx_payments_status
    ON payments(status);


CREATE INDEX idx_notifications_user
    ON notifications(user_id);

CREATE INDEX idx_notifications_unread
    ON notifications(user_id, read);


CREATE INDEX idx_announcements_created_by
    ON announcements(created_by);


CREATE INDEX idx_rule_acceptances_user
    ON rule_acceptances(user_id);


CREATE INDEX idx_audit_logs_user
    ON audit_logs(user_id);

CREATE INDEX idx_audit_logs_entity
    ON audit_logs(entity, entity_id);

CREATE INDEX idx_audit_logs_created
    ON audit_logs(created_at);


CREATE INDEX idx_sessions_expire
    ON sessions(expire);


-- ============================================================
-- 31. DORSALES ÚNICOS
-- ============================================================

CREATE UNIQUE INDEX idx_players_active_dorsal
ON players(dorsal)
WHERE active = TRUE
AND dorsal IS NOT NULL;


-- ============================================================
-- 32. VISTA DE JUGADORES
-- ============================================================

CREATE VIEW player_details AS

SELECT

    p.id AS player_id,

    p.user_id,

    u.name AS account_name,

    u.email,

    p.full_name,

    p.dorsal,

    p.position,

    p.dominant_foot,

    p.birth_date,

    player_age(p.birth_date) AS age,

    c.id AS category_id,

    c.name AS category,

    p.height_cm,

    p.weight_kg,

    p.photo_url,

    p.active,

    p.approved,

    p.created_at

FROM players p

LEFT JOIN users u
    ON u.id = p.user_id

LEFT JOIN categories c
    ON c.id = p.category_id;


-- ============================================================
-- 33. VISTA PÚBLICA DE ENTRENADORES
-- ============================================================

CREATE VIEW coach_public_profiles AS

SELECT

    c.id AS coach_id,

    c.user_id,

    c.full_name,

    c.photo_url,

    c.bio,

    c.experience,

    c.specialty,

    c.preferred_formation,

    CASE
        WHEN c.public_phone = TRUE
        AND c.public_contact = TRUE
        THEN c.phone
        ELSE NULL
    END AS phone,

    CASE
        WHEN c.public_email = TRUE
        AND c.public_contact = TRUE
        THEN u.email
        ELSE NULL
    END AS email

FROM coaches c

INNER JOIN users u
    ON u.id = c.user_id

WHERE c.active = TRUE
  AND u.active = TRUE
  AND u.role = 'coach';


-- ============================================================
-- 34. ACTUALIZAR CATEGORÍAS
-- ============================================================

CREATE OR REPLACE FUNCTION refresh_player_categories()
RETURNS INTEGER
LANGUAGE plpgsql
AS $$
DECLARE
    affected_rows INTEGER;
BEGIN

    UPDATE players p
    SET category_id = c.id

    FROM categories c

    WHERE
        player_age(p.birth_date)
        BETWEEN c.min_age AND c.max_age
        AND c.active = TRUE;

    GET DIAGNOSTICS affected_rows = ROW_COUNT;

    RETURN affected_rows;

END;
$$;


-- ============================================================
-- 35. APROBAR JUGADOR
-- ============================================================

CREATE OR REPLACE FUNCTION approve_player(
    p_player_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    selected_user_id INTEGER;
BEGIN

    SELECT user_id
    INTO selected_user_id
    FROM players
    WHERE id = p_player_id;

    IF selected_user_id IS NULL THEN
        RAISE EXCEPTION
            'Jugador no encontrado.';
    END IF;

    UPDATE players
    SET
        approved = TRUE,
        active = TRUE
    WHERE id = p_player_id;

    UPDATE users
    SET
        approved = TRUE,
        active = TRUE
    WHERE id = selected_user_id;

END;
$$;


-- ============================================================
-- 36. DESACTIVAR JUGADOR
-- ============================================================

CREATE OR REPLACE FUNCTION deactivate_player(
    p_player_id INTEGER
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
DECLARE
    selected_user_id INTEGER;
BEGIN

    SELECT user_id
    INTO selected_user_id
    FROM players
    WHERE id = p_player_id;

    IF selected_user_id IS NULL THEN
        RAISE EXCEPTION
            'Jugador no encontrado.';
    END IF;

    UPDATE players
    SET active = FALSE
    WHERE id = p_player_id;

    UPDATE users
    SET active = FALSE
    WHERE id = selected_user_id;

END;
$$;


-- ============================================================
-- 37. REGLA DE APROBACIÓN
-- ============================================================

/*
 * Los entrenadores y administradores son cuentas de confianza.
 *
 * Cuando exista un usuario coach:
 *
 *     approved = TRUE
 *
 * Nunca debe aparecer como "pendiente de aprobación".
 *
 * Los jugadores y acudientes sí pueden quedar pendientes.
 */

CREATE OR REPLACE FUNCTION enforce_staff_approval()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN

    IF NEW.role IN ('admin', 'coach') THEN
        NEW.approved := TRUE;
    END IF;

    RETURN NEW;

END;
$$;


CREATE TRIGGER trg_staff_always_approved
BEFORE INSERT OR UPDATE OF role, approved
ON users
FOR EACH ROW
EXECUTE FUNCTION enforce_staff_approval();


-- ============================================================
-- 38. FINAL
-- ============================================================

SELECT
    'Elite Soccer database creada correctamente' AS status;