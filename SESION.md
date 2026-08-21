# Sesión persistente de Elite Soccer

La sesión de usuario ahora se guarda en PostgreSQL mediante `connect-pg-simple` y la cookie dura 30 días.

- `rolling: true`: cada visita autenticada renueva el plazo de 30 días.
- La cookie es `httpOnly` y `sameSite=lax`.
- En producción se activa `secure` para usar HTTPS.
- Al iniciar sesión se regenera el ID de sesión para evitar session fixation.
- La sesión se guarda explícitamente antes de redirigir al dashboard.

Esto significa que cerrar el navegador o entrar a otra página no debería cerrar la sesión. Solo se pierde al cerrar sesión, al dejar pasar el plazo de 30 días sin actividad, o al eliminar las cookies/datos del navegador.
