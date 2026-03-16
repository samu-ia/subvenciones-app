@echo off
echo ========================================
echo   EJECUTAR MIGRACION DE BASE DE DATOS
echo ========================================
echo.
echo Para ejecutar la migracion de limpieza:
echo.
echo 1. Abre tu navegador en:
echo    https://supabase.com/dashboard/project/whvmobuyydpxdpuffiuw/sql/new
echo.
echo 2. Copia el contenido del archivo:
echo    supabase\migrations\20260316000000_cleanup_database.sql
echo.
echo 3. Pegalo en el SQL Editor y haz clic en RUN
echo.
echo ========================================
echo   O usa este comando directo:
echo ========================================
echo.

type supabase\migrations\20260316000000_cleanup_database.sql

echo.
echo ========================================
pause
