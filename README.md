# Elite Soccer — Plataforma completa

Plataforma de academia/club de fútbol con identidad visual basada en el escudo y banner oficiales de Elite Soccer.

## Stack
- Node.js 20+
- TypeScript
- Express 5
- EJS
- PostgreSQL / Neon
- express-session + connect-pg-simple
- bcryptjs
- Multer para imágenes
- Helmet + Morgan
- PWA (manifest + service worker)

## Funcionalidades incluidas
- Página pública, equipo, partidos, calendario, noticias, galería, tienda y formulario de pruebas.
- Autenticación y roles: admin, coach, player, guardian.
- Dashboard por usuario.
- Gestión de jugadores y fotografías.
- Entrenamientos y control de asistencia.
- Partidos, resultados, eventos y convocatorias.
- Respuesta del jugador a convocatorias.
- Pizarra táctica base y tácticas guardadas.
- Evaluaciones 1–10 y evolución histórica.
- Torneos.
- Notificaciones y comunicados.
- Reglamento y aceptación de versiones.
- Tienda, pedidos y estados de producción.
- Pagos y seguimiento.
- Usuarios/roles.
- Reportes de asistencia y rendimiento.
- Configuración del club.
- Auditoría de acciones.
- Carga de imágenes.
- PWA responsive.

## Instalación desde cero

### 1. Requisitos
Instala Node.js 20 o superior y PostgreSQL local, o crea una base PostgreSQL en Neon.

Comprobar:

```bash
node -v
npm -v
```

### 2. Instalar dependencias
Desde la carpeta del proyecto:

```bash
npm install
```

Las dependencias principales son:

```bash
npm install express ejs pg express-session connect-pg-simple bcryptjs dotenv helmet morgan multer
npm install -D typescript tsx @types/node @types/express @types/ejs @types/pg @types/express-session @types/connect-pg-simple @types/multer @types/morgan
```

### 3. Configurar entorno
Copia `.env.example` como `.env`.

```bash
copy .env.example .env
```

En PowerShell también puedes usar:

```powershell
Copy-Item .env.example .env
```

Pon tu conexión de Neon/PostgreSQL en `DATABASE_URL` y un `SESSION_SECRET` largo.

Ejemplo:

```env
PORT=3000
NODE_ENV=development
DATABASE_URL=postgresql://usuario:password@host/neondb?sslmode=require
SESSION_SECRET=pon-aqui-un-secreto-largo
CLUB_NAME=Elite Soccer
```

### 4. Inicializar la base de datos

```bash
npm run build
npm run db:init
npm run db:seed
```

El seed crea:

- admin@elitesoccer.local / Admin123!
- coach@elitesoccer.local / Admin123!
- Categorías Sub-12, Sub-14, Sub-16, Sub-18
- Producto inicial de tienda
- Configuración inicial del club

**Cambia estas contraseñas después del primer inicio.**

### 5. Ejecutar
Desarrollo:

```bash
npm run dev
```

Producción local:

```bash
npm run build
npm start
```

Abre:

`http://localhost:3000`

## Comandos rápidos

```bash
npm install
npm run dev
npm run build
npm start
npm run db:init
npm run db:seed
```

## Estructura

- `src/server.ts` servidor y rutas.
- `src/db/schema.sql` base de datos.
- `src/db/init.ts` inicialización.
- `src/db/seed.ts` datos iniciales.
- `src/middleware` autenticación/permisos.
- `src/utils` consultas y auditoría.
- `views/pages` pantallas.
- `views/partials` navegación/footer.
- `public/css/app.css` identidad visual.
- `public/images` logo y banner.
- `public/manifest.json` PWA.
- `public/sw.js` service worker.
- `uploads` fotografías y productos subidos.

## Rutas principales

Públicas: `/`, `/equipo`, `/partidos`, `/calendario`, `/noticias`, `/galeria`, `/tienda`, `/unete`.

CMS: `/noticias/admin`, `/galeria/admin`.

Privadas: `/dashboard`, `/jugadores`, `/entrenamientos`, `/partidos`, `/tacticas`, `/pizarra`, `/evaluaciones`, `/torneos`, `/notificaciones`, `/anuncios`, `/reglamento`, `/pedidos`, `/pagos`, `/reportes`.

Admin: `/usuarios`, `/pedidos/admin`, `/tienda/admin`, `/configuracion`, `/auditoria`.

## Nota de producción
Antes de publicar en Internet conviene añadir CSRF, recuperación de contraseña por correo, verificación de correo, rate limiting, almacenamiento de imágenes externo y un proveedor de pagos. La base incluida es funcional para desarrollo/MVP y está preparada para esas ampliaciones.
