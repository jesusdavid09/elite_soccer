# Dependencias de Elite Soccer

## Requisitos del sistema

- Node.js 20 o superior.
- npm 10+ recomendado.
- PostgreSQL 14+ o una base PostgreSQL en Neon.

## Dependencias de producción

```bash
npm install express ejs pg express-session connect-pg-simple bcryptjs dotenv helmet morgan multer
```

- `express`: servidor HTTP y rutas.
- `ejs`: vistas HTML dinámicas.
- `pg`: conexión PostgreSQL/Neon.
- `express-session`: sesiones de usuario.
- `connect-pg-simple`: guarda sesiones en PostgreSQL.
- `bcryptjs`: hash/verificación de contraseñas.
- `dotenv`: variables de entorno desde `.env`.
- `helmet`: cabeceras de seguridad.
- `morgan`: logs HTTP.
- `multer`: subida de imágenes.

## Dependencias de desarrollo

```bash
npm install -D typescript tsx @types/node @types/express @types/ejs @types/pg @types/express-session @types/connect-pg-simple @types/multer @types/morgan
```

- `typescript`: compilador TypeScript.
- `tsx`: ejecutar TypeScript directamente en desarrollo y watch mode.
- `@types/*`: tipos para TypeScript.

## Instalar todo de una vez

```bash
npm install
```

El `package.json` ya contiene todas las versiones y `npm install` instalará producción + desarrollo.

## Comandos

```bash
npm install
npm run dev
npm run build
npm start
npm run db:init
npm run db:seed
```

## Windows PowerShell

```powershell
npm install
Copy-Item .env.example .env
npm run build
npm run db:init
npm run db:seed
npm run dev
```

## Windows CMD

```cmd
npm install
copy .env.example .env
npm run build
npm run db:init
npm run db:seed
npm run dev
```

## Neon

1. Crea una base PostgreSQL en Neon.
2. Copia la cadena de conexión.
3. Pégala en `DATABASE_URL` del `.env`.
4. Ejecuta `npm run build`.
5. Ejecuta `npm run db:init`.
6. Ejecuta `npm run db:seed`.

## Credenciales iniciales del seed

```text
Admin:
admin@elitesoccer.local
Admin123!

Entrenador:
coach@elitesoccer.local
Admin123!
```

Cambia estas credenciales inmediatamente después de la primera instalación.
