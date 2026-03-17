@echo off
cd src
powershell -Command "(Get-Content components\RiskDashboardClean.tsx) -replace 'http://localhost:8000', 'http://192.168.43.131:8000' | Set-Content components\RiskDashboardClean.tsx"
powershell -Command "(Get-Content components\AddAccount.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content components\AddAccount.tsx"
powershell -Command "(Get-Content components\AnalyticsView.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content components\AnalyticsView.tsx"
powershell -Command "(Get-Content components\AppShell.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content components\AppShell.tsx"
powershell -Command "(Get-Content components\HistoryView.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content components\HistoryView.tsx"
powershell -Command "(Get-Content components\TerminalView.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content components\TerminalView.tsx"
powershell -Command "(Get-Content contexts\AccountContext.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content contexts\AccountContext.tsx"
powershell -Command "(Get-Content hooks\useLiveTrades.tsx) -replace 'ws://127.0.0.1:8000', 'ws://192.168.43.131:8000' | Set-Content hooks\useLiveTrades.tsx"
powershell -Command "(Get-Content pages\Analytics.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content pages\Analytics.tsx"
powershell -Command "(Get-Content pages\JournalView.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content pages\JournalView.tsx"
powershell -Command "(Get-Content pages\Login.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content pages\Login.tsx"
powershell -Command "(Get-Content pages\Register.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content pages\Register.tsx"
powershell -Command "(Get-Content pages\Settings.tsx) -replace 'http://localhost:8000', 'http://192.168.43.131:8000' | Set-Content pages\Settings.tsx"
powershell -Command "(Get-Content pages\SetupWizard.tsx) -replace 'http://localhost:8000', 'http://192.168.43.131:8000' | Set-Content pages\SetupWizard.tsx"
powershell -Command "(Get-Content config\api.tsx) -replace 'http://localhost:8000', 'http://192.168.43.131:8000' | Set-Content config\api.tsx"
powershell -Command "(Get-Content services\api.ts) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content services\api.ts"
powershell -Command "(Get-Content services\apiClient.tsx) -replace 'http://127.0.0.1:8000', 'http://192.168.43.131:8000' | Set-Content services\apiClient.tsx"
cd ..
echo Done! All URLs updated
pause
