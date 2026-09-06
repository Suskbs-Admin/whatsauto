/**
 * Optional: Create separate WhatsApp groups per session
 * e.g., if you have Session 1, Session 2 with different meet links,
 * this creates one group per session automatically.
 * Usage: node src/groupBySession.js
 */
const { createClient, waitForReady } = require('./client');
const { loadConfig, loadContacts } = require('./utils');

async function createGroupsBySession(client, contacts, config) {
    // Group contacts by session
    const bySession = {};
    for (const c of contacts) {
        const key = c.session || 'General';
        if (!bySession[key]) bySession[key] = [];
        bySession[key].push(c);
    }

    console.log(`\n[INFO] Found ${Object.keys(bySession).length} unique sessions:`);
    Object.entries(bySession).forEach(([sess, list]) => console.log(` - "${sess}": ${list.length} participants`));

    const results = [];
    for (const [session, list] of Object.entries(bySession)) {
        const groupName = `${config.group.name} - ${session}`.slice(0, 35); // WhatsApp limit ~25-35 chars safe
        const meetLinks = [...new Set(list.map(c => c.meet_link).filter(Boolean))];
        const welcome = `Welcome to *${groupName}*\n\nSession: *${session}*\nMeet: ${meetLinks.join(', ') || 'Will be shared soon'}\nGroup: ${groupName}\n\nThis group is auto-created for your session. Personal invites already sent.\n- SUSKBS Team`;

        try {
            const { createOrUpdateGroup } = require('./groupCreator');
            const res = await createOrUpdateGroup(client, groupName, list, {
                description: `Group for ${session} | ${config.group.description}`,
                welcomeMessage: welcome
            });
            results.push({ session, groupName, ...res, count: list.length, success: true });
        } catch (e) {
            console.error(`[FAIL] Group "${groupName}" failed:`, e.message);
            results.push({ session, groupName, success: false, error: e.message });
        }
        // delay between group creations
        await new Promise(r => setTimeout(r, 3000));
    }

    console.log('\n[SUMMARY] Group creation by session:');
    results.forEach(r => console.log(` ${r.success ? '[OK]' : '[FAIL]'} ${r.groupName} (${r.count}) ${r.inviteLink || r.error || ''}`));
    return results;
}

if (require.main === module) {
    (async () => {
        const config = require('./utils').loadConfig();
        const contacts = loadContacts(config.paths.contactsCsv);
        const client = createClient();
        await client.initialize();
        await waitForReady(client, 120000);
        await createGroupsBySession(client, contacts, config);
        console.log('\n[DONE]');
    })().catch(e => { console.error(e); process.exit(1); });
}

module.exports = { createGroupsBySession };
