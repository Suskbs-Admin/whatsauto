const path = require('path');
const { createClient, waitForReady } = require('./client');
const { loadConfig, loadContacts, loadTemplate, renderTemplate, sleep, randomDelay, logResults } = require('./utils');
const { printStartupBannerWithTime, printCompletionBanner } = require('../lib/banner');

/**
 * Core bulk sender logic - sends detailed formatted messages with Google Meet link + group name
 * @param {import('whatsapp-web.js').Client} client - ready client
 * @param {Array} contacts - normalized contacts
 * @param {string} template - message template
 * @param {object} config - config object
 * @param {object} extra - { groupName }
 */
async function sendBulkMessages(client, contacts, template, config, extra = {}) {
    const groupName = extra.groupName || config.group?.name || '';
    const results = [];
    const delayConfig = config.messaging.delayBetweenMessagesMs;

    console.log(`\n[INFO] Starting bulk send to ${contacts.length} contacts...`);
    console.log(`[INFO] Group: ${groupName} | Delay between messages: ${delayConfig.min}-${delayConfig.max}ms\n`);

    for (let i = 0; i < contacts.length; i++) {
        const contact = contacts[i];
        // If custom_message provided, use it directly; else render template with group_name + meet_link
        const message = contact.custom_message ? contact.custom_message : renderTemplate(template, contact, { groupName, group_name: groupName });
        const chatId = `${contact.phone}@c.us`;

        process.stdout.write(`[${i + 1}/${contacts.length}] Sending to ${contact.name} (${contact.phone})... `);

        try {
            // Check if number is registered
            const isRegistered = await client.isRegisteredUser(chatId);
            if (!isRegistered) {
                throw new Error('Number not registered on WhatsApp');
            }

            // Optional: simulate typing
            const chat = await client.getChatById(chatId).catch(() => null);
            if (chat) await chat.sendStateTyping();

            if (config.messaging.typingDelayMs) await sleep(config.messaging.typingDelayMs);
            if (chat) await chat.clearState();

            await client.sendMessage(chatId, message);
            console.log('[OK] Sent');
            results.push({ contact, success: true, chatId, timestamp: new Date().toISOString() });
        } catch (err) {
            console.log(`[FAIL] Failed: ${err.message}`);
            results.push({ contact, success: false, error: err.message, chatId, timestamp: new Date().toISOString() });
        }

        // Delay except for last
        if (i < contacts.length - 1) {
            const delay = randomDelay(delayConfig.min, delayConfig.max);
            await sleep(delay);
        }
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;
    console.log(`\n[DONE] Sent: ${successCount}/${results.length} | Failed: ${failCount}`);

    if (config.messaging.logResults) {
        const logFile = logResults(results);
        console.log(`[LOG] Results saved to ${logFile}`);
    }

    return results;
}

// Standalone execution: node src/bulkSender.js [--csv ./file.csv --meet https://meet.google.com/... --form https://forms.gle/... --group "Name"]
if (require.main === module) {
    (async () => {
        printStartupBannerWithTime();
        const config = loadConfig();
        // Parse flags: file, meet, form, group
        let meetLinkFlag = null, formLinkFlag = null, csvFlag = null, groupFlag = null;
        const args = process.argv.slice(2);
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if ((a === '--csv' || a === '--file' || a === '--contacts' || a === '--input') && args[i + 1]) csvFlag = args[++i];
            else if ((a === '--meet' || a === '--meet-link' || a === '--meetLink' || a === '--meeting' || a === '--link' || a === '--url') && args[i + 1]) {
                const { normalizeMeetLink } = require('../lib/meet');
                meetLinkFlag = normalizeMeetLink(args[++i]);
                console.log(`[FLAG] Overriding meet_link via --meet for all contacts: ${meetLinkFlag}`);
            } else if ((a === '--form' || a === '--form-link' || a === '--formLink' || a === '--google-form' || a === '--gform') && args[i + 1]) {
                const { normalizeFormLink } = require('../lib/meet');
                formLinkFlag = normalizeFormLink(args[++i]);
                console.log(`[FLAG] Overriding form_link via --form for all contacts: ${formLinkFlag}`);
            } else if ((a === '--group' || a === '--group-name' || a === '--name') && args[i + 1]) {
                groupFlag = args[++i];
                console.log(`[FLAG] Group override: ${groupFlag}`);
            }
        }
        const csvPath = csvFlag || config.paths.contactsCsv;
        let contacts = loadContacts(csvPath);
        if (meetLinkFlag) contacts = contacts.map(c => ({ ...c, meet_link: meetLinkFlag }));
        if (formLinkFlag) contacts = contacts.map(c => ({ ...c, form_link: formLinkFlag }));
        const template = loadTemplate(config.paths.messageTemplate);
        const groupName = groupFlag || config.group.name;

        console.log(`[CONFIG] Loaded ${contacts.length} contacts from ${csvPath}`);
        console.log(`[GROUP] ${groupName}`);
        if (meetLinkFlag) console.log(`[MEET] Using flag link: ${meetLinkFlag}`);
        if (formLinkFlag) console.log(`[FORM] Using flag link: ${formLinkFlag}`);
        console.log(`[TEMPLATE PREVIEW]\n${renderTemplate(template, contacts[0], { groupName })}\n${'-'.repeat(40)}`);

        const client = createClient();
        await client.initialize();
        await waitForReady(client, 120000);

        await sendBulkMessages(client, contacts, template, config, { groupName });

        console.log('\n[INFO] Session saved for next run.');
        printCompletionBanner();
        try { await client.destroy(); } catch {}
        setTimeout(() => process.exit(0), 600);
    })().catch(err => {
        console.error('[FATAL]', err);
        process.exit(1);
    });
}

module.exports = { sendBulkMessages };
