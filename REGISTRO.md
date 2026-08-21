# Registro de usuarios - Elite Soccer

## Flujo
1. El visitante entra a `/registro`.
2. Puede crear cuenta como **Jugador** o **Acudiente**.
3. La cuenta se guarda con `approved = false`.
4. El usuario no puede iniciar sesión hasta ser aprobado.
5. El administrador entra a `/usuarios` y aprueba o rechaza.
6. Si se aprueba un jugador, se crea automáticamente su registro base en `players`; después el entrenador/admin completa posición, dorsal, categoría, foto, etc.
7. Los roles `admin` y `coach` no se pueden crear desde el registro público.

## Base de datos existente
Como tu Neon ya tenía las tablas creadas antes de añadir el registro, ejecuta una sola vez:

```bash
npm run db:migrate
```

Esto agrega `users.approved` e índice de solicitudes pendientes sin borrar datos.

Luego:

```bash
npm run build
npm run dev
```

## URLs
- Registro: `http://localhost:3000/registro`
- Login: `http://localhost:3000/login`
- Usuarios/admin: `http://localhost:3000/usuarios`
