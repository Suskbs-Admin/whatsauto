# Quick Start (Windows)

## 1. Install
Double-click `run.ps1` OR in PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass -Force
npm.cmd install
```

## 2. Add your data
Edit `data/contacts.csv` (Excel -> Save as CSV):
```
phone,name,session,meet_link
919876543210,Rahul Sharma,Session 1,https://meet.google.com/abc-xyz
```

Edit `data/message_template.txt` with your message using {{name}}, {{session}}, {{meet_link}}

## 3. Preview
```powershell
node src/testTemplate.js
```

## 4. Run
```powershell
node app.js
```
Scan QR -> Choose 1/2/3 -> Type YES

Logs go to `logs/` folder.
Group invite link prints in terminal - share it!

## Troubleshooting: npm.ps1 not allowed
Use `npm.cmd` not `npm` in PowerShell, or run `run.ps1` which auto-bypasses policy.
