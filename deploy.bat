@echo off
echo.
echo ========================================
echo    ASCENDER - Deploy
echo ========================================
echo.

echo [1/3] Buildando frontend...
call npm run build:client
if errorlevel 1 (
    echo ERRO no build! Verifique os erros acima.
    pause
    exit /b 1
)

echo.
echo [2/3] Commitando alteracoes...
git add .
set /p msg="Descricao da atualizacao: "
git commit -m "%msg%"

echo.
echo [3/3] Enviando para o GitHub...
git push origin main

echo.
echo ========================================
echo    Deploy concluido! 
echo    Railway vai atualizar em instantes.
echo ========================================
echo.
pause
