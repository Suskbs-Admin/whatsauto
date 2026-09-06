const fs = require('fs');
const path = require('path');
const { createClient, waitForReady } = require('./client');
const { loadConfig, loadContacts, sleep, findGroupInLogs, saveGroupLog, isGroupInLogs } = require('./utils');
const { buildGroupOnlyMessage } = require('../lib/formatter');

/**
 * Find existing group by exact name
 * @param {import('whatsapp-web.js').Client} client
 * @param {string} groupName
 * @returns {Promise<import('whatsapp-web.js').GroupChat|null>}
 */
async function findGroupByName(client, groupName) {
    // Wait a bit for chats to sync
    await sleep(2000);
    let chats = [];
    try {
        chats = await client.getChats();
    } catch (e) {
        console.log(`[WARN] getChats failed: ${e.message}, retrying after 3s...`);
        await sleep(3000);
        chats = await client.getChats().catch(() => []);
    }
    console.log(`[DEBUG] Fetched ${chats.length} chats, searching for group "${groupName}"...`);
    const groups = chats.filter(c => c.isGroup);
    console.log(`[DEBUG] Found ${groups.length} groups: ${groups.slice(0,5).map(g=>`"${g.name}"`).join(', ')}${groups.length>5?'...':''}`);
    const target = chats.find(c => c.isGroup && c.name && c.name.trim().toLowerCase() === groupName.trim().toLowerCase());
    if (target) console.log(`[DEBUG] Matched group: "${target.name}" ID=${target.id._serialized}`);
    return target || null;
}

/**
 * Create WhatsApp group with contacts.
 * If group already exists with same name, adds new members instead.
 * @param {import('whatsapp-web.js').Client} client - ready client
 * @param {string} groupName - exact group name to create or update
 * @param {Array} contacts - normalized contacts [{phone, name, session, meet_link}]
 * @param {object} options - {description, welcomeMessage}
 */
async function createOrUpdateGroup(client, groupName, contacts, options = {}) {
    const participants = contacts.map(c => `${c.phone}@c.us`);
    const gidFlag = options.groupId || options.groupID || null;
    console.log(`\n[INFO] Checking for existing group "${groupName}"${gidFlag ? ` (ID flag: ${gidFlag})` : ''} — checking logs by name and ID...`);

    // 0) If --group-id flag provided, try it first (check logs by ID and live by ID)
    if (gidFlag) {
        const { findGroupByIdInLogs } = require('./utils');
        let logById = null;
        try { logById = findGroupByIdInLogs(gidFlag); } catch {}
        if (logById) console.log(`[INFO] Found group by ID in logs: "${logById.groupName}" (ID: ${logById.groupId})`);
        let liveById = null;
        try { liveById = await client.getChatById(gidFlag).catch(() => null); } catch {}
        if (liveById && liveById.isGroup) {
            console.log(`[INFO] Live group found by ID flag ${gidFlag} (name: "${liveById.name}"). Will send group-only message by ID+name.`);
            return await addMembersToGroup(client, liveById, contacts, { ...options, fromLogs: !!logById, logEntry: logById || { groupId: gidFlag, groupName } });
        } else if (logById) {
            console.log(`[WARN] Flag ID ${gidFlag} found in logs but live fetch failed. Will try name lookup...`);
        }
    }

    // 1) Check logs by name (as per requirement: check group name from logs)
    const logEntry = findGroupInLogs(groupName);
    if (logEntry) {
        console.log(`[INFO] Found group "${groupName}" in logs (ID: ${logEntry.groupId} | Invite: ${logEntry.inviteLink || 'none'}). Treating as existing. Will send by group ID and name.`);
        // Try to fetch live group via ID or name — prefer ID from logs
        let liveGroup = null;
        try {
            if (logEntry.groupId) {
                console.log(`[INFO] Fetching live group by ID from logs: ${logEntry.groupId}...`);
                liveGroup = await client.getChatById(logEntry.groupId).catch(() => null);
            }
        } catch {}
        if (!liveGroup) liveGroup = await findGroupByName(client, groupName);
        if (liveGroup && liveGroup.isGroup) {
            console.log(`[INFO] Live group found for "${groupName}" (ID: ${liveGroup.id._serialized}). Will send group-only message by ID ${liveGroup.id._serialized} and name "${groupName}".`);
            return await addMembersToGroup(client, liveGroup, contacts, { ...options, fromLogs: true, logEntry });
        } else {
            console.log(`[WARN] Log says group "${groupName}" exists (ID ${logEntry.groupId}) but live group not found. Will verify via live search again...`);
            // fall through to live check, but still have log ID to use for direct send if needed
            // Try direct send by ID even if getChatById failed? We can attempt to send via ID anyway
            try {
                const directChat = await client.getChatById(logEntry.groupId).catch(() => null);
                if (directChat) return await addMembersToGroup(client, directChat, contacts, { ...options, fromLogs: true, logEntry });
            } catch {}
        }
    }

    // 2) Check live WhatsApp groups by name
    const existing = await findGroupByName(client, groupName);
    if (existing) {
        console.log(`[INFO] Group "${groupName}" already exists live (ID: ${existing.id._serialized}). Will send group-only message (no personal) by ID+name.`);
        return await addMembersToGroup(client, existing, contacts, { ...options, fromLogs: false });
    }

    console.log(`[INFO] No existing group found in logs (by name/ID) or live. Creating new group "${groupName}" with ${participants.length} participants...`);
    return await createGroup(client, groupName, contacts, options);
}

/**
 * Add new members to an existing group (skips already present)
 */
async function addMembersToGroup(client, groupChat, contacts, options = {}) {
    const groupId = groupChat.id._serialized;
    const existingIds = new Set(groupChat.participants.map(p => p.id._serialized));

    // Validate numbers and filter out already-in-group
    const candidates = contacts.map(c => `${c.phone}@c.us`);
    const toAdd = [];
    const skippedExists = [];
    const skippedInvalid = [];

    for (const p of candidates) {
        if (existingIds.has(p)) {
            skippedExists.push(p);
            continue;
        }
        const isReg = await client.isRegisteredUser(p).catch(() => false);
        if (!isReg) {
            console.log(`[WARN] Skipping unregistered number: ${p}`);
            skippedInvalid.push(p);
            continue;
        }
        toAdd.push(p);
        await sleep(300);
    }

    console.log(`[INFO] Group has ${existingIds.size} members. New valid members to add: ${toAdd.length}. Already in group: ${skippedExists.length}. Invalid: ${skippedInvalid.length}.`);

    // Prepare group-only message data (session, group link, form link — no name/phone)
    let inviteLink = null;
    try { inviteLink = await groupChat.getInviteCode().then(c => `https://chat.whatsapp.com/${c}`).catch(() => null); } catch {}
    if (!inviteLink && options.logEntry) inviteLink = options.logEntry.inviteLink;
    const groupMsgTemplate = (() => {
        try {
            const { loadTemplate } = require('./utils');
            return loadTemplate('./data/group_message_template.txt');
        } catch { return `Group: {{group_name}}\nSession: {{session}}\nGroup Link: {{group_link}}\nMeet Link: {{meet_link}}\nForm Link: {{form_link}}`; }
    })();
    const groupOnlyMsg = buildGroupOnlyMessage(contacts, groupChat.name || groupName, inviteLink || '', groupMsgTemplate, {
        meetLink: options.meetLink || contacts[0]?.meet_link || '',
        formLink: options.formLink || contacts[0]?.form_link || ''
    });

    if (toAdd.length > 0) {
        try {
            await groupChat.addParticipants(toAdd);
            console.log(`[SUCCESS] Added ${toAdd.length} new members to group "${groupChat.name}"`);
        } catch (e) {
            console.error(`[ERROR] Failed to add participants: ${e.message}`);
            for (const p of toAdd) {
                try {
                    await groupChat.addParticipants([p]);
                    console.log(`[OK] Added ${p}`);
                    await sleep(500);
                } catch (err) {
                    console.log(`[FAIL] Could not add ${p}: ${err.message}`);
                }
            }
        }
        // Send group-only message (session + group link + form link, no name/phone)
        try {
            await client.sendMessage(groupId, groupOnlyMsg);
            console.log('[INFO] Group message sent (session + group link + form link, no name/phone)');
        } catch (e) { console.log('[WARN] Group message failed:', e.message); }
    } else {
        console.log('[INFO] No new members to add. Will still send group update (session/group link/form link).');
        try {
            await client.sendMessage(groupId, groupOnlyMsg);
            console.log('[INFO] Group update sent (session + group link + form link)');
        } catch (e) { console.log('[WARN] Group update failed:', e.message); }
    }

    // Ensure description is updated
    if (options.description) {
        await groupChat.setDescription(options.description).catch(e => console.log('[WARN] Could not set description:', e.message));
    }

    // Save to logs (group name -> groupId mapping for future checks)
    try {
        const finalInvite = inviteLink || (await groupChat.getInviteCode().then(c => `https://chat.whatsapp.com/${c}`).catch(() => inviteLink));
        if (finalInvite) {
            console.log(`[INVITE] ${finalInvite}`);
            saveGroupLog({ groupName: groupChat.name || groupName, groupId, inviteLink: finalInvite, sessions: [...new Set(contacts.map(c => c.session))], formLink: options.formLink || contacts[0]?.form_link || '', meetLink: options.meetLink || contacts[0]?.meet_link || '' });
            console.log(`[LOG] Group "${groupChat.name || groupName}" saved to logs/groups.json`);
            return { groupId, inviteLink: finalInvite, added: toAdd.length, existing: existingIds.size, updated: true };
        } else {
            saveGroupLog({ groupName: groupChat.name || groupName, groupId, inviteLink: '', sessions: [...new Set(contacts.map(c => c.session))], formLink: options.formLink || contacts[0]?.form_link || '', meetLink: options.meetLink || contacts[0]?.meet_link || '' });
        }
    } catch (e) {
        console.log('[WARN] Could not get/save invite code:', e.message);
    }
    return { groupId, inviteLink: inviteLink || '', added: toAdd.length, existing: existingIds.size, updated: true };
}

/**
 * Core createGroup - always creates new group (internal)
 */
async function createGroup(client, groupName, contacts, options = {}) {
    const participants = contacts.map(c => `${c.phone}@c.us`);
    const skipCheck = options.skipCheck || process.argv.includes('--skip-check');

    // Validate numbers first (with detailed logging)
    const validParticipants = [];
    const invalid = [];
    console.log(`[INFO] Validating ${participants.length} numbers for group...`);
    for (const p of participants) {
        let isReg = false;
        try {
            isReg = await client.isRegisteredUser(p);
            console.log(`[CHECK] ${p} -> ${isReg ? 'VALID' : 'NOT on WhatsApp'}`);
        } catch (e) {
            console.log(`[WARN] Check failed for ${p}: ${e.message} (will treat as invalid, use --skip-check to bypass)`);
            isReg = false;
        }
        if (isReg || skipCheck) {
            validParticipants.push(p);
            if (skipCheck && !isReg) console.log(`[INFO] --skip-check: including ${p} anyway`);
        } else {
            invalid.push(p);
            console.log(`[WARN] Skipping unregistered number: ${p}`);
        }
        await sleep(500);
    }

    if (invalid.length > 0) console.log(`[WARN] ${invalid.length} numbers not on WhatsApp will be skipped. Use real WhatsApp numbers. Invalid: ${invalid.join(', ')}`);
    if (validParticipants.length === 0) {
        console.error(`[FATAL] No valid WhatsApp numbers to create group. All ${participants.length} failed validation.`);
        console.error(`[HINT] 1) Ensure numbers include country code (e.g., 91 for India) and are on WhatsApp`);
        console.error(`[HINT] 2) Try with your own test number first`);
        console.error(`[HINT] 3) Bypass check with --skip-check (may still fail if WhatsApp rejects)`);
        throw new Error(`No valid WhatsApp numbers to create group. Checked ${participants.length}, all invalid. Invalid list: ${invalid.join(', ')}`);
    }

    console.log(`[INFO] Calling WhatsApp to create group "${groupName}" with ${validParticipants.length} participants...`);
    console.log(`[DEBUG] Participants: ${validParticipants.join(', ')}`);

    let result;
    try {
        result = await client.createGroup(groupName, validParticipants);
    } catch (e) {
        console.error(`[FATAL] client.createGroup failed: ${e.message}`);
        throw e;
    }

    let groupId;
    if (typeof result === 'string') groupId = result;
    else if (result.gid) groupId = result.gid._serialized || result.gid;
    else if (result.id) groupId = result.id._serialized || result.id;
    else groupId = JSON.stringify(result);

    console.log(`[SUCCESS] Group created! ID: ${groupId} | Name: "${groupName}"`);

    // Post-create: description, group-only message (session + group link + form link, no name/phone), invite
    let finalInvite = '';
    try {
        await sleep(1500);
        const chat = await client.getChatById(groupId).catch(e => { console.log(`[WARN] getChatById failed: ${e.message}`); return null; });
        if (chat) {
            if (options.description) {
                await chat.setDescription(options.description).catch(e => console.log('[WARN] Could not set description:', e.message));
            }
            // Build group-only message (no name/phone, only session + group link + form link)
            const inviteTmp = await chat.getInviteCode().then(c => `https://chat.whatsapp.com/${c}`).catch(() => '');
            finalInvite = inviteTmp || '';
            const groupTpl = (() => {
                try { const { loadTemplate } = require('./utils'); return loadTemplate('./data/group_message_template.txt'); }
                catch { return `Group: {{group_name}}\nSession: {{session}}\nGroup Link: {{group_link}}\nMeet Link: {{meet_link}}\nForm Link: {{form_link}}`; }
            })();
            const grpMsg = buildGroupOnlyMessage(contacts, groupName, finalInvite, groupTpl, {
                meetLink: options.meetLink || contacts[0]?.meet_link || '',
                formLink: options.formLink || contacts[0]?.form_link || ''
            });
            await client.sendMessage(groupId, grpMsg).catch(e => console.log(`[WARN] Group message send failed: ${e.message}`));
            console.log('[INFO] Group message sent (session + group link + form link, no name/phone)');
            if (!finalInvite) {
                await sleep(1000);
                const retryInvite = await chat.getInviteCode().then(c => `https://chat.whatsapp.com/${c}`).catch(() => '');
                if (retryInvite) finalInvite = retryInvite;
            }
            if (finalInvite) {
                console.log(`[INVITE] ${finalInvite}`);
            } else {
                console.log(`[INFO] Invite not available yet. Open group "${groupName}" in WhatsApp > Group Info > Invite via link to get it.`);
            }
            // Save to logs for future checks
            saveGroupLog({ groupName, groupId, inviteLink: finalInvite, sessions: [...new Set(contacts.map(c => c.session))], formLink: options.formLink || contacts[0]?.form_link || '', meetLink: options.meetLink || contacts[0]?.meet_link || '' });
            console.log(`[LOG] Group "${groupName}" saved to logs/groups.json`);
            if (finalInvite) return { groupId, groupName, inviteLink: finalInvite, created: true };
        }
    } catch (e) {
        console.log('[WARN] Post-create actions failed:', e.message);
    }
    // Ensure log even if invite missing
    try { saveGroupLog({ groupName, groupId, inviteLink: finalInvite, sessions: [...new Set(contacts.map(c => c.session))], formLink: options.formLink || contacts[0]?.form_link || '', meetLink: options.meetLink || contacts[0]?.meet_link || '' }); } catch {}
    return { groupId, groupName, inviteLink: finalInvite, created: true };
}

// Standalone execution: node src/groupCreator.js [groupName] [--csv ./file.csv --group "Name" --group-id 1203...@g.us]
if (require.main === module) {
    (async () => {
        const config = loadConfig();
        // Parse flags for file, group, group ID
        let csvFlag = null, groupFlag = null, groupIdFlag = null;
        const args = process.argv.slice(2);
        for (let i = 0; i < args.length; i++) {
            const a = args[i];
            if ((a === '--csv' || a === '--file' || a === '--contacts' || a === '--input') && args[i + 1]) csvFlag = args[++i];
            else if ((a === '--group' || a === '--group-name' || a === '--name') && args[i + 1]) groupFlag = args[++i];
            else if ((a === '--group-id' || a === '--groupId' || a === '--gid' || a === '--id') && args[i + 1]) { groupIdFlag = args[++i]; if (!groupIdFlag.includes('@g.us')) groupIdFlag = groupIdFlag + '@g.us'; }
        }
        const csvPath = csvFlag || config.paths.contactsCsv;
        const contacts = loadContacts(csvPath);
        let positionalGroup = null;
        if (args[0] && !args[0].startsWith('--') && !groupFlag) positionalGroup = args[0];
        const groupName = groupFlag || positionalGroup || config.group.name;
        // Resolve ID from logs if not provided via flag
        if (!groupIdFlag) try { const { findGroupInLogs } = require('./utils'); const e = findGroupInLogs(groupName); if (e) groupIdFlag = e.groupId; } catch {}

        console.log(`[CONFIG] Loaded ${contacts.length} contacts from ${csvPath}`);
        console.log(`[GROUP] Name: ${groupName}${groupIdFlag ? ` (ID: ${groupIdFlag})` : ''}`);
        if (csvFlag) console.log(`[FLAG] --file: ${csvFlag}`);
        if (groupIdFlag) console.log(`[FLAG] --group-id: ${groupIdFlag} (checked from logs)`);

        const client = createClient();
        await client.initialize();
        await waitForReady(client, 120000);

        // Group message will be session + group link + form link (no name/phone) built inside createOrUpdateGroup
        const res = await createOrUpdateGroup(client, groupName, contacts, {
            description: config.group.description,
            groupId: groupIdFlag || '',
            meetLink: contacts[0]?.meet_link || '',
            formLink: contacts[0]?.form_link || ''
        });
        console.log('[RESULT]', res);
        console.log('\n[DONE] Group creation/update complete. Session saved.');
        try { await client.destroy(); } catch {}
        setTimeout(() => process.exit(0), 500);
    })().catch(err => {
        console.error('[FATAL]', err);
        process.exit(1);
    });
}

module.exports = { createGroup, createOrUpdateGroup, findGroupByName, addMembersToGroup };
