@echo off

echo ===================================
echo PostgreSQL Restore
echo ===================================

set /p DB_HOST=Host:
set /p DB_PORT=Port:
set /p DB_NAME=Database:
set /p DB_USER=Username:

set /p PGPASSWORD=Password:

pg_restore ^
-h %DB_HOST% ^
-p %DB_PORT% ^
-U %DB_USER% ^
-d %DB_NAME% ^
backups\makersflow.backup

echo.
echo Restore completed.
pause