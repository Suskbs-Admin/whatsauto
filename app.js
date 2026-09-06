const readline = require('readline');
const path = require('path');
const { createClient, waitForReady } = require('./src/client');
const { sendBulkMessages } = require('./src/bulkSender');
const { createOrUpdateGroup } = require('./src/groupCreator');
const { loadConfig, loadContacts, loadTemplate, renderTemplate } = require('./src/utils');

const { printStartupBannerWithTime, printCompletionBanner } = require('./lib/banner');
const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
function ask(q) {
    return new Promise(res => rl.question(q, ans => res(ans.trim())));
}

function parseFlags() {
    const args = process.argv.slice(2);
    let meet = null, form = null, csv = null, group = null, groupId = null;
    for (let i = 0; i < args.length; i++) {
        const a = args[i];
        if ((a === '--csv' || a === '--file' || a === '--contacts' || a === '--input') && args[i + 1]) csv = args[++i];
        else if ((a === '--group' || a === '--group-name' || a === '--name') && args[i + 1]) group = args[++i];
        else if ((a === '--group-id' || a === '--groupId' || a === '--gid' || a === '--id') && args[i + 1]) {
            groupId = args[++i];
            if (!groupId.includes('@g.us')) groupId = groupId + '@g.us';
        }
        else if (['--meet', '--meet-link', '--meetLink', '--meeting', '--link', '--url'].includes(a) && args[i + 1]) {
            const { normalizeMeetLink } = require('./lib/meet');
            meet = normalizeMeetLink(args[++i]);
        } else if (['--form', '--form-link', '--formLink', '--google-form', '--gform', '--forms'].includes(a) && args[i + 1]) {
            const { normalizeFormLink } = require('./lib/meet');
            form = normalizeFormLink(args[++i]);
        }
    }
    return { meet, form, csv, group, groupId };
}

async function main() {
    printStartupBannerWithTime();

    const config = loadConfig();
    const { meet: meetLinkFlag, form: formLinkFlag, csv: csvFlag, group: groupFlag, groupId: groupIdFlag } = parseFlags();
    const effectiveCsv = csvFlag || config.paths.contactsCsv;
    let effectiveGroupFlag = groupFlag;
    let effectiveGroupIdFlag = groupIdFlag;
    if (meetLinkFlag) console.log(`[FLAG] --meet override: ${meetLinkFlag} (applies to all contacts)`);
    if (formLinkFlag) console.log(`[FLAG] --form override: ${formLinkFlag} (applies to all contacts)`);
    if (csvFlag) console.log(`[FLAG] --file override: ${csvFlag}`);
    if (groupFlag) console.log(`[FLAG] --group override: ${groupFlag}`);
    if (groupIdFlag) console.log(`[FLAG] --group-id override: ${groupIdFlag} (checked from logs)`);
    // If groupId flag provided but no group name, resolve name from logs
    if (effectiveGroupIdFlag && !effectiveGroupFlag) {
        try { const { findGroupByIdInLogs } = require('./src/utils'); const e = findGroupByIdInLogs(effectiveGroupIdFlag); if (e) { effectiveGroupFlag = e.groupName; console.log(`[FLAG] Resolved group name from logs by ID: ${effectiveGroupFlag}`); } } catch {}
    }
    // If group name flag provided but no ID, resolve ID from logs
    if (effectiveGroupFlag && !effectiveGroupIdFlag) {
        try { const { findGroupInLogs } = require('./src/utils'); const e = findGroupInLogs(effectiveGroupFlag); if (e) { effectiveGroupIdFlag = e.groupId; console.log(`[FLAG] Resolved group ID from logs by name: ${effectiveGroupIdFlag}`); } } catch {}
    }
    console.log(`[CONFIG] contacts: ${effectiveCsv}`);
    console.log(`[CONFIG] template: ${config.paths.messageTemplate}`);
    console.log(`[CONFIG] session storage: ${config.paths.sessionDir}\n`);

    // Pre-load & preview (detailed formatted with Google Meet + Form + group name)
    try {
        let contacts = loadContacts(effectiveCsv);
        if (meetLinkFlag) contacts = contacts.map(c => ({ ...c, meet_link: meetLinkFlag }));
        if (formLinkFlag) contacts = contacts.map(c => ({ ...c, form_link: formLinkFlag }));
        const template = loadTemplate(config.paths.messageTemplate);
        const previewGroup = effectiveGroupFlag || config.group.name;
        console.log(`[PREVIEW] Loaded ${contacts.length} contacts. Example message for ${contacts[0].name}:`);
        console.log(`[GROUP] ${previewGroup}`);
        if (meetLinkFlag) console.log(`[MEET] Using --meet flag: ${meetLinkFlag}`);
        if (formLinkFlag) console.log(`[FORM] Using --form flag: ${formLinkFlag}`);
        console.log('-'.repeat(50));
        console.log(renderTemplate(template, contacts[0], { groupName: previewGroup }));
        console.log('-'.repeat(50) + '\n');
    } catch (e) {
        console.error(`[ERROR] Failed to load data: ${e.message}`);
        console.log('Fix data/contacts.csv and data/message_template.txt then restart.');
        process.exit(1);
    }

    console.log('Menu:');
    console.log('  1) Send BULK personalized messages');
    console.log('  2) Create WhatsApp GROUP from CSV');
    console.log('  3) Do BOTH (send messages + create group)');
    console.log('  4) Preview all messages (dry run, no WhatsApp login)');
    console.log('  5) Exit\n');

    const choice = await ask('Select option [1-5]: ');

    if (choice === '4') {
        let contacts = loadContacts(effectiveCsv);
        if (meetLinkFlag) contacts = contacts.map(c => ({ ...c, meet_link: meetLinkFlag }));
        if (formLinkFlag) contacts = contacts.map(c => ({ ...c, form_link: formLinkFlag }));
        const previewGroup = effectiveGroupFlag || config.group.name;
        const template = loadTemplate(config.paths.messageTemplate);
        console.log(`\n[DRY RUN] All rendered messages (Group: ${previewGroup}${meetLinkFlag ? ` | Meet: ${meetLinkFlag}` : ''}${formLinkFlag ? ` | Form: ${formLinkFlag}` : ''}):\n`);
        contacts.forEach((c, i) => {
            const msg = c.custom_message ? c.custom_message : renderTemplate(template, c, { groupName: previewGroup });
            console.log(`\n--- [${i + 1}] ${c.name} | ${c.phone} | ${c.session} | Meet: ${c.meet_link} | Form: ${c.form_link || 'none'} ---`);
            console.log(msg);
        });
        rl.close();
        return;
    }

    if (choice === '5') {
        console.log('Bye!');
        rl.close();
        return;
    }

    if (!['1', '2', '3'].includes(choice)) {
        console.log('Invalid choice');
        rl.close();
        return;
    }

    // Ask group name if group creation involved (flag overrides default, then ask to confirm)
    let groupName = effectiveGroupFlag || config.group.name;
    if (choice === '2' || choice === '3') {
        const input = await ask(`Group name [${groupName}]: `);
        if (input) groupName = input;
    }

    // Ask meet/form link overrides if not provided via flag and user wants to override
    let effectiveMeetLink = meetLinkFlag;
    let effectiveFormLink = formLinkFlag;
    if (!effectiveMeetLink && (choice === '1' || choice === '3')) {
        const meetInput = await ask(`Google Meet link to use for ALL contacts [press Enter to use CSV links]: `);
        if (meetInput) {
            const { normalizeMeetLink } = require('./lib/meet');
            effectiveMeetLink = normalizeMeetLink(meetInput.trim());
            console.log(`[INPUT] Using meet link for all: ${effectiveMeetLink}`);
        }
    } else if (effectiveMeetLink) {
        console.log(`[INFO] Using --meet flag link for all contacts: ${effectiveMeetLink}`);
    }
    if (!effectiveFormLink && (choice === '1' || choice === '3')) {
        const formInput = await ask(`Google Form link to use for ALL contacts [press Enter to use CSV links or skip]: `);
        if (formInput) {
            const { normalizeFormLink } = require('./lib/meet');
            effectiveFormLink = normalizeFormLink(formInput.trim());
            console.log(`[INPUT] Using form link for all: ${effectiveFormLink}`);
        }
    } else if (effectiveFormLink) {
        console.log(`[INFO] Using --form flag link for all contacts: ${effectiveFormLink}`);
    }

    // Confirm
    if (choice === '1') console.log(`\n[CONFIRM] Will send to ${loadContacts(effectiveCsv).length} numbers...`);
    if (choice === '2') console.log(`\n[CONFIRM] Will create group "${groupName}" with ${loadContacts(effectiveCsv).length} numbers...`);
    if (choice === '3') console.log(`\n[CONFIRM] Will BOTH send messages AND create group "${groupName}"...`);

    const confirm = await ask('Type YES to proceed: ');
    if (confirm !== 'YES') {
        console.log('Cancelled.');
        rl.close();
        return;
    }

    // Initialize WhatsApp client
    console.log('\n[INIT] Starting WhatsApp client... (first time needs QR scan)');
    const client = createClient();
    await client.initialize();
    try {
        await waitForReady(client, 120000);
    } catch (e) {
        console.error('[ERROR]', e.message);
        rl.close();
        process.exit(1);
    }

    // Close readline before async work (qr already shown)
    rl.close();

    let contacts = loadContacts(effectiveCsv);
    if (effectiveMeetLink) contacts = contacts.map(c => ({ ...c, meet_link: effectiveMeetLink }));
    if (effectiveFormLink) contacts = contacts.map(c => ({ ...c, form_link: effectiveFormLink }));
    const template = loadTemplate(config.paths.messageTemplate);

    // Requirement: check group name AND group ID from logs, if found dont create again, just send group message by ID+name
    // and if group already exists, skip personal sending — group message only mentions session + group link + form link
    const { isGroupInLogs, isGroupIdInLogs, findGroupInLogs, findGroupByIdInLogs } = require('./src/utils');
    const { findGroupByName: findLive } = require('./src/groupCreator');

    // Resolve ID for display
    let resolvedIdForLog = effectiveGroupIdFlag;
    if (!resolvedIdForLog) try { const e = findGroupInLogs(groupName); if (e) resolvedIdForLog = e.groupId; } catch {}

    if (choice === '1') {
        await sendBulkMessages(client, contacts, template, config, { groupName });
    } else if (choice === '2') {
        // Group only — will send group-only message (session + group link + form link, no name/phone) by ID+name
        console.log(`[INFO] Sending to group by ID ${resolvedIdForLog || groupName} and name "${groupName}"...`);
        await createOrUpdateGroup(client, groupName, contacts, {
            description: config.group.description,
            meetLink: effectiveMeetLink || contacts[0]?.meet_link || '',
            formLink: effectiveFormLink || contacts[0]?.form_link || '',
            groupId: effectiveGroupIdFlag || resolvedIdForLog || ''
        });
    } else if (choice === '3') {
        let existsInLogs = false; try { existsInLogs = isGroupInLogs(groupName); } catch {}
        let existsById = false; try { if (effectiveGroupIdFlag) existsById = isGroupIdInLogs(effectiveGroupIdFlag); } catch {}
        let existsLive = false; try { const g = await findLive(client, groupName); existsLive = !!g; } catch {}
        let existsLiveById = false; try { if (effectiveGroupIdFlag) { const c = await client.getChatById(effectiveGroupIdFlag).catch(()=>null); existsLiveById = !!(c && c.isGroup); } } catch {}
        const alreadyExists = existsInLogs || existsById || existsLive || existsLiveById;
        if (alreadyExists) {
            let idToShow = effectiveGroupIdFlag || resolvedIdForLog || '';
            console.log(`\n[INFO] Group "${groupName}" ${idToShow ? '('+idToShow+')' : ''} already exists ${existsInLogs ? '(logs by name)' : ''}${existsById ? '(logs by ID)' : ''}${existsLive ? '(live)' : ''}${existsLiveById ? '(live by ID)' : ''} — skipping personal messages.`);
            console.log(`[INFO] Sending group-only message (session + group link + form link, no name/phone) by group ID and name...`);
            await createOrUpdateGroup(client, groupName, contacts, {
                description: config.group.description,
                meetLink: effectiveMeetLink || contacts[0]?.meet_link || '',
                formLink: effectiveFormLink || contacts[0]?.form_link || '',
                groupId: effectiveGroupIdFlag || resolvedIdForLog || ''
            });
        } else {
            console.log(`\n[INFO] Group "${groupName}" not found in logs (by name/ID) or live — will send personal messages + create group.`);
            await sendBulkMessages(client, contacts, template, config, { groupName });
            await createOrUpdateGroup(client, groupName, contacts, {
                description: config.group.description,
                meetLink: effectiveMeetLink || contacts[0]?.meet_link || '',
                formLink: effectiveFormLink || contacts[0]?.form_link || '',
                groupId: effectiveGroupIdFlag || ''
            });
        }
    }

    console.log('\n[OK] All tasks completed. Keep session directory (.wwebjs_auth) to avoid re-scanning QR next time.');
    try { await client.destroy(); } catch {}
    console.log('[EXIT] Closing, process will exit in 1s...');
    setTimeout(() => process.exit(0), 800);
}

main().catch(err => {
    console.error('[FATAL]', err);
    process.exit(1);
});
