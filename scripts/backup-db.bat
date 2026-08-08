@echo off

echo ===================================
echo PostgreSQL Database Backup
echo ===================================

set /p DB_HOST=Host:
set /p DB_PORT=Port:
set /p DB_NAME=Database:
set /p DB_USER=Username:

set /p PGPASSWORD=Password:

if not exist backups mkdir backups

pg_dump ^
-h %DB_HOST% ^
-p %DB_PORT% ^
-U %DB_USER% ^
-F c ^
-d %DB_NAME% ^
-f backups\makersflow.backup

echo.
echo Backup completed successfully.
pause