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

**WhatsAuto** sends personalized WhatsApp messages to everyone in a CSV file and
creates/updates a WhatsApp group — automatically filling in each person's name,
session, Google Meet link, and Google Form link.

The easiest way to use it: run `whatsauto` and answer a few simple questions.

---

## Quick Start (2 minutes)

### 1. Install

```powershell
npm install -g whatsauto
```

> Windows PowerShell blocks `npm` sometimes. If you see `npm.ps1 cannot be loaded`,
> use `npm.cmd` instead:
> ```powershell
> npm.cmd install -g whatsauto
> ```

### 2. Prepare your contacts file (CSV)

Create a CSV file anywhere, e.g. `contacts.csv`:

```csv
phone,name,session,meet_link,form_link
919876543210,Rahul Sharma,Session 1,https://meet.google.com/abc-defg-hij,https://forms.gle/xyz123
919876543211,Priya Verma,Session 2,https://meet.google.com/abc-defg-hij,https://forms.gle/xyz123
```

Columns: `phone` (with country code) | `name` | `session` | `meet_link` | `form_link`

You can also use an Excel file (`.xlsx`) — same columns.

### 3. Run it

```powershell
whatsauto
```

The program asks 4 questions — just type your answers:

```
[INTERACTIVE] WhatsApp bulk automation. Press Enter to accept the [default].

  File location (CSV or XLSX) [./data/contacts.csv]:  C:\Users\you\Desktop\contacts.csv
  Group name [SUSKBS Session Group]:                   SUMMER BATCH 2026
  Google Meet link (Enter to use links from CSV):      https://meet.google.com/abc-defg-hij
  Google Form link (Enter to use links from CSV):      https://forms.gle/xyz123
```

- **File location** — path to your CSV or XLSX file
- **Group name** — the WhatsApp group everyone will be added to
- **Meet link / Form link** — type one link to use it for *everyone*, or press
  Enter to use each contact's own link from the CSV

It then shows a preview message. Type **`YES`** to send for real.

---

## What happens next

1. A **QR code** appears on the first run — scan it with your phone:
   **WhatsApp → Settings → Linked Devices → Link a Device**
   (Your session is saved, so you only scan once.)
2. **WhatsAuto sends each person** their personalized message with their own
   name, session, meet link, and form link.
3. **WhatsAuto creates the group** (or adds new members if it already exists)
   and posts a group message with the session + group link + form link.
4. Results are logged to `logs/` for review.

---

## Advanced: skip the questions with flags

Every question above can be pre-filled on the command line:

```powershell
whatsauto both --file .\contacts.csv --group "SUMMER BATCH 2026" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
```

| What you'd type | Flags |
|-----------------|-------|
| File location | `--file`, `--csv`, `--input`, `--contacts` |
| Group name | `--group`, `--group-name`, `--name` |
| Meet link | `--meet`, `--meet-link`, `--meeting`, `--link`, `--url` |
| Form link | `--form`, `--form-link`, `--google-form`, `--gform` |

### Useful commands

```powershell
whatsauto                  # interactive mode (asks the 4 questions)
whatsauto preview          # dry-run preview, no WhatsApp login needed
whatsauto send             # only send personal messages
whatsauto group            # only create/update the group
whatsauto both             # send messages + create/update group
```

> **Tip:** Run `whatsauto preview` first to check your messages before sending
> for real.

---

## Use as an NPM library

```js
const { WhatsappBulk } = require('whatsauto');

const wa = new WhatsappBulk({
  contactsCsv: './contacts.csv',
  groupName: 'SUMMER BATCH 2026',
  meetLink: 'https://meet.google.com/abc-defg-hij',
  formLink: 'https://forms.gle/xyz123'
});

wa.previewMessages().forEach(({ contact, message }) => console.log(message));

await wa.init();                 // QR scan on first run
await wa.sendBulk();             // send personal messages
await wa.createOrUpdateGroup();  // create/update the group
await wa.destroy();
```

---

## Message template

Messages are built from `data/message_template_detailed.txt` (default):

```
Hello {{name}},
Session: {{session}}
Group: {{group_name}}
Meet: {{meet_link}}
Form: {{form_link}}
```

Available placeholders:
`{{name}}` `{{phone}}` `{{session}}` `{{meet_link}}` `{{form_link}}` `{{group_name}}`

---

## Configuration

Optional `config.json` controls defaults (group name, message delays, country code).
The program uses sensible defaults, so you usually never need to touch it.

---

## Project Structure

```
whatsapp/
├── bin/cli.js            # CLI (whatsauto / wa-bulk)
├── lib/index.js          # Library entry (WhatsappBulk)
├── lib/meet.js           # Meet/Form link validation & normalization
├── lib/formatter.js      # Detailed message builder
├── src/client.js         # WhatsApp client + QR
├── src/utils.js          # CSV + template helpers
├── src/bulkSender.js     # Bulk send logic
├── src/groupCreator.js   # createOrUpdateGroup logic
├── data/contacts.csv     # Sample contacts
├── data/message_template_detailed.txt
├── app.js                # Alternative interactive menu
└── config.json           # Optional settings
```

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| `npm.ps1 cannot be loaded` | Use `npm.cmd` instead of `npm` in PowerShell |
| Contacts CSV not found | Check the file path, make sure the file exists |
| Number not registered | The number isn't on WhatsApp — it's skipped and logged |
| QR not showing | Make sure the terminal is large enough & supports UTF-8 |
| Timeout waiting for ready | Scan the QR within 20 seconds, phone must have internet |
| Group creation fails | The CSV needs at least 1 valid WhatsApp number |
| Re-login needed | Delete the `.wwebjs_auth/` folder and scan QR again |

---

## Logs

After sending, check `logs/`:
- `send_results_<timestamp>.json` — full results
- `failed_<timestamp>.csv` — numbers that failed (for retrying)