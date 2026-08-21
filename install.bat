@echo off
cd /d %~dp0
echo === ELITE SOCCER ===
echo Instalando dependencias...
npm install
if errorlevel 1 goto error
if not exist .env copy .env.example .env
echo Dependencias instaladas.
echo Ahora configura DATABASE_URL y SESSION_SECRET en .env
echo Luego ejecuta: npm run build ^&^& npm run db:init ^&^& npm run db:seed ^&^& npm run dev
pause
exit /b 0
:error
echo No se pudieron instalar las dependencias. Comprueba Node.js y tu conexion a Internet.
pause
exit /b 1
