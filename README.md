# WhatsApp Bulk Automation

```
 ██╗    ██╗██╗  ██╗ █████╗ ████████╗███████╗ █████╗ ██╗   ██╗████████╗  ██████╗
 ██║    ██║██║  ██║██╔══██╗╚══██╔══╝██╔════╝██╔══██╗██║   ██║╚══██╔══╝██╔═══██╗
 ██║ █╗ ██║███████║███████║   ██║   ███████╗███████║██║   ██║   ██║   ██║   ██║
 ██║███╗██║██╔══██║██╔══██║   ██║   ╚════██║██╔══██║██║   ██║   ██║   ██║   ██║
 ╚███╔███╔╝██║  ██║██║  ██║   ██║   ███████║██║  ██║╚██████╔╝   ██║   ╚██████╔╝
  ╚══╝╚══╝ ╚═╝  ╚═╝╚═╝  ╚═╝   ╚═╝   ╚══════╝╚═╝  ╚═╝ ╚═════╝    ╚═╝    ╚═════╝
 WhatsAuto Bulk Automation  v1.0.0  | Bulk Meet & Form | Groups
```

**WhatsAuto** — NPM library + CLI to send detailed personalized WhatsApp messages and create/update groups from a CSV. All inputs are mapped via flags: **file location, group name, Google Meet link, Google Form link**.

Built on `whatsapp-web.js` (WhatsApp Web, session persists after QR). Validates and normalizes Google Meet / Form links.

## Features

- CSV: `phone,name,session,meet_link,form_link`
- Template placeholders: `{{name}} {{phone}} {{session}} {{meet_link}} {{form_link}} {{group_name}}`
- Flags override CSV for all contacts
- Validates WhatsApp numbers, random delay anti-ban, logs to `logs/`
- Group: creates if not exists, else adds new members (skips existing), always mentions group name
- Works as CLI `wa-bulk` and as library `require('whatsauto')`
- Dry-run preview without login

## Flags Mapping

| Input | Flags | Library Option |
| File (CSV location) | `--csv`, `--file`, `--input`, `--contacts` | `contactsCsv` |
| Group name | `--group`, `--group-name`, `--name` | `groupName` |
| Meet link | `--meet`, `--meet-link`, `--meeting`, `--link`, `--url` | `meetLink` |
| Form link | `--form`, `--form-link`, `--google-form`, `--gform` | `formLink` |

## Prerequisites

- Node.js 18+ (`node -v`)
- WhatsApp account for QR scan

## Installation

```powershell
# As a consumer of the published package
npm i whatsauto

# Dev install inside the repo
cd D:\Suskbs\whatsapp
npm.cmd install
```

If you get `npm.ps1 cannot be loaded`, use `npm.cmd` or:
```powershell
powershell -ExecutionPolicy Bypass -File .\run.ps1
```

## Setup Data

1. **Contacts** `data/contacts.csv`:
```csv
phone,name,session,meet_link,form_link
919876543210,Rahul Sharma,Session 1,https://meet.google.com/abc-defg-hij,https://forms.gle/xyz123
919876543211,Priya Verma,Session 1,https://meet.google.com/abc-defg-hij,https://forms.gle/xyz123
```

2. **Template** `data/message_template_detailed.txt` (default):
```
Hello {{name}},
Session: {{session}}
Group: {{group_name}}
Meet: {{meet_link}}
Form: {{form_link}}
```

3. **Config** `config.json` (optional): default group, delays, `countryCodeDefault`.

## Commands to Run

All commands support flags for file, group, meet, form. Use PowerShell with `npm.cmd`.

### 1. Preview (dry-run, no login) — Recommended First

```powershell
# Default (uses data/contacts.csv + config group + CSV links)
node src/testTemplate.js
node bin/cli.js preview

# With all flags
node bin/cli.js preview --file ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123

# Aliases also work
node src/testTemplate.js --csv ./data/contacts.csv --group-name "Batch 2" --meet-link https://meet.google.com/xyz --form-link https://docs.google.com/forms/d/xxx/viewform
```

### 2. Interactive Menu (prompts for group/meet/form, or use flags)

```powershell
node app.js
# With flags (skips prompts for those values)
node app.js --file ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
```

Menu:
```
1) Send BULK personalized messages
2) Create WhatsApp GROUP from CSV
3) Do BOTH (send + create group)
4) Preview all messages (dry run)
5) Exit
```
First run shows QR: scan with **WhatsApp > Linked Devices > Link a device**. Session saved to `.wwebjs_auth/`.

### 3. Direct CLI (whatsauto / wa-bulk)

```powershell
# INTERACTIVE — type whatsauto, then enter:
#   file location, group name, Google Meet link, Google Form link
whatsauto

# Or with npx (before install/publish for local testing)
npx whatsauto

# Flags (skip prompts):
whatsauto preview --file ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
whatsauto send --file ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
whatsauto both --file ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
wa-bulk group --file ./data/contacts.csv --group "SUSKBS Batch 1"

# Installed as dependency (npx after publish)
npx wa-bulk preview --file ./data/contacts.csv --group "G1" --meet <link> --form <link>
```

The interactive `whatsauto` prompt asks you for each input (press Enter to keep the default):

```
[INTERACTIVE] WhatsApp bulk automation. Press Enter to accept the [default].

  File location (CSV or XLSX) [./data/contacts.csv]:   <-- type your file (or Enter)
  Group name [SUSKBS Session Group]:                    <-- type the group name
  Google Meet link (Enter to use links from CSV):       <-- type a Meet link for everyone
  Google Form link (Enter to use links from CSV):       <-- type a Form link for everyone
```

It then previews one message, asks you to confirm with `YES`, and runs send + create/update group.

### 4. Standalone Scripts

```powershell
node src/bulkSender.js --file ./data/contacts.csv --group "G1" --meet https://meet.google.com/x --form https://forms.gle/y
node src/groupCreator.js --file ./data/contacts.csv --group "G1"
```

### 5. As NPM Library

```js
const { WhatsappBulk } = require('whatsauto');

const wa = new WhatsappBulk({
  contactsCsv: './data/contacts.csv', // --file
  groupName: 'SUSKBS Batch 1',         // --group
  meetLink: 'https://meet.google.com/abc-defg-hij', // --meet
  formLink: 'https://forms.gle/xyz123'             // --form
});

wa.previewMessages().forEach(({contact, message}) => console.log(message));

await wa.init(); // QR first time
await wa.sendBulk();
await wa.createOrUpdateGroup();
await wa.destroy();
```

See `examples/usage.js:1` for full library examples.

## Project Structure

```
whatsapp/
├── lib/index.js          # Library entry (WhatsappBulk)
├── lib/meet.js           # Meet/Form validation & normalization
├── lib/formatter.js      # Detailed message builder
├── bin/cli.js            # CLI wa-bulk
├── src/client.js         # WhatsApp client + QR
├── src/utils.js          # CSV + template ({{group_name}}, {{form_link}})
├── src/bulkSender.js     # Bulk send (all flags)
├── src/groupCreator.js   # createOrUpdateGroup
├── data/contacts.csv
├── data/message_template_detailed.txt
├── app.js                # Interactive menu
└── config.json
```

## Logs

After send: `logs/send_results_<timestamp>.json` and `logs/failed_<timestamp>.csv` for retries.

## Troubleshooting

| Issue | Fix |
| Contacts CSV not found | Check `--file` path, ensure file exists |
| Number not registered | Number not on WhatsApp, will be skipped and logged |
| QR not showing | Ensure `qrcode-terminal` installed, terminal supports UTF-8 |
| Timeout waiting for ready | Scan QR within 20s, ensure phone has internet |
| Group creation fails | Need at least 1 valid participant, check numbers |
| Re-login needed | Delete `.wwebjs_auth/` folder |

## Quick One-Liner to Run

```powershell
npm.cmd install; node bin/cli.js preview --file ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
```
"# whatsauto" 
