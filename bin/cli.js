#!/usr/bin/env node
const path = require('path');
const { WhatsappBulk } = require('../lib');
const { printStartupBannerWithTime, printCompletionBanner } = require('../lib/banner');

function printHelp() {
    console.log(`
Usage: wa-bulk [command] [options]

Commands:
  send              Send bulk detailed messages (CSV -> WhatsApp)
  group [name]      Create or update group (adds new members if exists)
  both              Do both send + group
  preview           Dry-run preview without WhatsApp login

Options:
  --csv <path>        Contacts file (CSV or XLSX) — auto-detects .csv / .xlsx
  --file <path>       Alias for --csv (supports .csv or .xlsx)
  --input <path>      Alias for --csv
                      (default: ./data/contacts.csv or ./data/Demo-list.xlsx)
  --template <path>   Message template path (default: ./data/message_template_detailed.txt)
  --group <name>      WhatsApp group name (default from config.json)
  --group-name <name> Alias for --group
  --group-id <id>     WhatsApp group ID (e.g., 120363...@g.us) — checked from logs/groups.json
                      aliases: --gid, --id, --groupId
  --meet <link>       Google Meet link for all contacts (overrides CSV meet_link)
                      aliases: --meet-link, --meeting, --link, --url, --meetLink
  --form <link>       Google Form link for all contacts (overrides CSV form_link)
                      aliases: --form-link, --google-form, --gform, --formLink

Examples:
  wa-bulk preview --csv ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz
  wa-bulk preview --file ./data/Demo-list.xlsx --group "SUSKBS Batch 1" --meet https://meet.google.com/test --form https://forms.gle/xyz
  wa-bulk send --csv ./data/contacts.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz
  wa-bulk send --file ./data/Demo-list.xlsx --group "SUSKBS Batch 1" --meet <link> --form <link>
  wa-bulk group --group "SUSKBS Batch 1" --group-id 120363411392259134@g.us
  wa-bulk both --file ./data/Demo-list.csv --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123 --group-id 120363411392259134@g.us
  wa-bulk both --file ./data/Demo-list.xlsx --group "SUSKBS Batch 1" --meet https://meet.google.com/abc-defg-hij --form https://forms.gle/xyz123
  wa-bulk both --template ./data/message_template.txt --meet https://meet.google.com/abc-defg-hij

Library usage:
  const { WhatsappBulk } = require('whatsapp-bulk-meet-automation');
  const wa = new WhatsappBulk({ 
    contactsCsv: './data/contacts.csv', // --csv / --file flag
    groupName: 'My Group',              // --group flag
    groupId: '120363...@g.us',          // --group-id flag (checked from logs/groups.json)
    meetLink: 'https://meet.google.com/...', // --meet flag
    formLink: 'https://forms.gle/...'        // --form flag
  });
  await wa.init(); await wa.sendBulk(); await wa.createOrUpdateGroup();
`);
}

async function main() {
    printStartupBannerWithTime();
    const args = process.argv.slice(2);
    const cmd = args[0];

    if (!cmd || cmd === '--help' || cmd === '-h') {
        printHelp();
        process.exit(0);
    }

    // Parse flags - support all aliases
    const opts = {};
    for (let i = 1; i < args.length; i++) {
        const a = args[i];
        if ((a === '--csv' || a === '--file' || a === '--contacts' || a === '--input') && args[i + 1]) {
            opts.contactsCsv = args[++i];
        } else if ((a === '--template' || a === '--tmpl') && args[i + 1]) {
            opts.templatePath = args[++i];
        } else if ((a === '--group' || a === '--group-name' || a === '--groupName' || a === '--name') && args[i + 1]) {
            opts.groupName = args[++i];
        } else if ((a === '--group-id' || a === '--groupId' || a === '--gid' || a === '--id') && args[i + 1]) {
            opts.groupId = args[++i];
            // Ensure it ends with @g.us
            if (!opts.groupId.includes('@g.us')) opts.groupId = opts.groupId + '@g.us';
        } else if ((a === '--meet' || a === '--meet-link' || a === '--meetLink' || a === '--meeting' || a === '--link' || a === '--url') && args[i + 1]) {
            opts.meetLink = args[++i];
        } else if ((a === '--form' || a === '--form-link' || a === '--formLink' || a === '--google-form' || a === '--googleForm' || a === '--gform' || a === '--forms') && args[i + 1]) {
            opts.formLink = args[++i];
        }
    }
    // For "group <name>" positional (if group not already via flag)
    if (cmd === 'group' && args[1] && !args[1].startsWith('--') && !opts.groupName) {
        opts.groupName = args[1];
    }

    if (cmd === 'preview') {
        const wa = new WhatsappBulk(opts);
        const previews = wa.previewMessages();
        // Show group ID from logs if exists
        let logInfo = '';
        try {
            const { findGroupInLogs, findGroupByIdInLogs } = require('../src/utils');
            const byName = findGroupInLogs(wa.groupName);
            const byId = wa.groupId ? findGroupByIdInLogs(wa.groupId) : null;
            if (byName) logInfo += ` | Log ID: ${byName.groupId}`;
            if (byId && (!byName || byId.groupId !== byName.groupId)) logInfo += ` | Log Name: ${byId.groupName}`;
            if (wa.groupId) logInfo += ` | Flag ID: ${wa.groupId}`;
        } catch {}
        console.log(`\n[PREVIEW] ${previews.length} messages (Group: ${wa.groupName}${logInfo} | File: ${wa.contactsCsv}${wa.meetLink ? ` | Meet: ${wa.meetLink}` : ''}${wa.formLink ? ` | Form: ${wa.formLink}` : ''}):\n`);
        previews.forEach(({ contact, message }, idx) => {
            console.log(`--- [${idx + 1}] ${contact.name} | ${contact.phone} | ${contact.session} | Meet: ${contact.meet_link} | Form: ${contact.form_link || 'none'} ---`);
            console.log(message);
            console.log('');
        });
        // Also preview group-only message (as would be sent to group)
        try {
            const { loadContacts } = require('../src/utils');
            const { buildGroupOnlyMessage } = require('../lib/formatter');
            const { loadTemplate } = require('../src/utils');
            const contacts = loadContacts(wa.contactsCsv);
            const groupTpl = loadTemplate('./data/group_message_template.txt');
            const { findGroupInLogs } = require('../src/utils');
            const logEntry = findGroupInLogs(wa.groupName);
            const groupLink = logEntry ? logEntry.inviteLink : (wa.groupId ? `https://chat.whatsapp.com/invite-by-id-${wa.groupId}` : '');
            const grpMsg = buildGroupOnlyMessage(contacts, wa.groupName, groupLink || 'https://chat.whatsapp.com/<will-be-fetched>', groupTpl, { meetLink: wa.meetLink || contacts[0]?.meet_link, formLink: wa.formLink || contacts[0]?.form_link });
            console.log(`\n[GROUP PREVIEW] Message that will be sent to group "${wa.groupName}" ${wa.groupId ? '('+wa.groupId+')' : (logEntry ? '('+logEntry.groupId+')' : '')} (session + group link + form link, no name/phone):\n`);
            console.log(grpMsg);
            console.log('');
        } catch (e) { console.log(`[WARN] Group preview failed: ${e.message}`); }
        return;
    }

    const wa = new WhatsappBulk(opts);
    await wa.init();

    try {
        if (cmd === 'send') {
            await wa.sendBulk();
        } else if (cmd === 'group') {
            const res = await wa.createOrUpdateGroup();
            console.log('[RESULT]', res);
        } else if (cmd === 'both') {
            // Requirement: check group name AND group ID from logs, if found dont create again, just send group message by ID+name
            // and if group already exists, skip personal sending (only session + group link + form link to group)
            const { isGroupInLogs, isGroupIdInLogs, findGroupInLogs, findGroupByIdInLogs } = require('../src/utils');
            const { findGroupByName } = require('../src/groupCreator');
            let existsInLogs = false;
            let existsById = false;
            let existsLive = false;
            let logEntryByName = null;
            let logEntryById = null;
            try { logEntryByName = findGroupInLogs(wa.groupName); existsInLogs = !!logEntryByName; } catch {}
            try { if (wa.groupId) { logEntryById = findGroupByIdInLogs(wa.groupId); existsById = !!logEntryById; } } catch {}
            try { existsLive = !!(await findGroupByName(wa.client, wa.groupName)); } catch {}
            // Also check live by ID if flag provided
            let existsLiveById = false;
            if (wa.groupId && !existsLive) {
                try { const c = await wa.client.getChatById(wa.groupId).catch(()=>null); existsLiveById = !!(c && c.isGroup); if (existsLiveById) console.log(`[INFO] Found live group by ID ${wa.groupId} (name: ${c.name})`); } catch {}
            }
            const alreadyExists = existsInLogs || existsById || existsLive || existsLiveById;
            // Resolve group ID to use (prefer flag, then log by name, then log by ID)
            const resolvedId = wa.groupId || (logEntryByName ? logEntryByName.groupId : '') || (logEntryById ? logEntryById.groupId : '');
            const resolvedName = wa.groupName || (logEntryById ? logEntryById.groupName : '') || (logEntryByName ? logEntryByName.groupName : '');
            if (alreadyExists) {
                console.log(`\n[INFO] Group "${resolvedName}" ${resolvedId ? '('+resolvedId+')' : ''} already exists ${existsInLogs ? '(found in logs by name)' : ''}${existsById ? '(found in logs by ID)' : ''}${existsInLogs && existsLive ? ' + ' : ''}${existsLive ? '(found live on WhatsApp)' : ''}${existsLiveById ? '(found live by ID)' : ''} — skipping personal messages.`);
                console.log(`[INFO] Sending group-only message (session + group link + form link, no name/phone) to existing group by ID+name...`);
                const res = await wa.createOrUpdateGroup();
                console.log('[RESULT]', res);
                console.log(`[INFO] Personal messages skipped as group already exists. Sent to group ID ${resolvedId || res.groupId || 'live'} and name "${resolvedName}".`);
            } else {
                console.log(`[INFO] Group "${wa.groupName}" not found in logs (by name/ID) or live — will send personal messages + create group.`);
                await wa.sendBulk();
                const res = await wa.createOrUpdateGroup();
                console.log('[RESULT]', res);
            }
        } else {
            console.error(`Unknown command: ${cmd}`);
            printHelp();
        }
        console.log('\n[OK] Done. Session saved.');
        printCompletionBanner();
    } finally {
        // Clean shutdown so process exits (closes Puppeteer)
        try { await wa.destroy(); } catch {}
        // Re-show banner on next start is automatic; give a moment then exit
        setTimeout(() => process.exit(0), 600);
    }
}

main().catch(async e => { 
    console.error('[FATAL]', e); 
    try { 
        // attempt cleanup if client was created
        const { WhatsappBulk: WB } = require('../lib');
    } catch {}
    process.exit(1); 
});
