@echo off
title Atelier Mode - Boutique
cd /d "%~dp0"

echo ==========================================
echo    Atelier Mode - Gestion de Boutique
echo ==========================================
echo.

if not exist "node_modules" (
  echo Premiere utilisation : installation des dependances...
  echo.
  call npm install
  echo.
)

echo Demarrage de l'application...
echo Le navigateur va s'ouvrir automatiquement sur http://localhost:5177
echo.
echo   IMPORTANT : laissez cette fenetre ouverte pendant l'utilisation.
echo   Fermez-la pour arreter l'application.
echo.

call npm run dev
