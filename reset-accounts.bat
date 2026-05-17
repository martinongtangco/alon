@echo off
cd /d %~dp0backend
node scripts/reset-accounts.js
pause
