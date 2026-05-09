@echo off
start "vibr8me — Backend API" cmd /k "cd /d %~dp0backend && npm run dev"
start "vibr8me — Admin Dashboard" cmd /k "cd /d %~dp0admin && npm run dev"
