/**
 * whatsauto - NPM Library Entry
 * 
 * Usage as library:
 *   const { WhatsappBulk } = require('whatsauto');
 *   const wa = new WhatsappBulk({ contactsCsv: './data/contacts.csv', groupName: 'My Group' });
 *   await wa.init();
 *   await wa.sendBulk();
 *   await wa.createOrUpdateGroup();
 *   await wa.destroy();
 * 
 * Or functional:
 *   const wa = require('whatsauto');
 *   const contacts = wa.loadContacts('./data/contacts.csv');
 *   const template = wa.loadTemplate('./data/message_template_detailed.txt');
 */

const path = require('path');
const { createClient, waitForReady } = require('../src/client');
const { sendBulkMessages } = require('../src/bulkSender');
const { createGroup, createOrUpdateGroup, findGroupByName } = require('../src/groupCreator');
const { loadConfig, loadContacts, loadTemplate, renderTemplate, formatPhone, sleep, randomDelay, logResults } = require('../src/utils');
const { isValidMeetLink, normalizeMeetLink, extractMeetCode, formatMeetLink, isValidFormLink, normalizeFormLink, formatFormLink } = require('./meet');
const { buildDetailedMessage, validateContacts } = require('./formatter');

class WhatsappBulk {
    /**
     * @param {object} opts
     * @param {string} [opts.contactsCsv] - path to CSV (default from config) — flags: --csv, --file, --input
     * @param {string} [opts.templatePath] - path to message template (detailed template)
     * @param {string} [opts.groupName] - WhatsApp group name to create/update and mention in messages — flags: --group
     * @param {string} [opts.groupDescription]
     * @param {string} [opts.meetLink] - Google Meet link to apply to all contacts (overrides CSV) — flags: --meet, --meet-link
     * @param {string} [opts.formLink] - Google Form link to apply to all contacts (overrides CSV) — flags: --form, --form-link
     * @param {object} [opts.config] - override config object
     */
    constructor(opts = {}) {
        this.opts = opts;
        this.config = opts.config || loadConfig();
        this.contactsCsv = opts.contactsCsv || path.join(__dirname, '..', this.config.paths.contactsCsv);
        this.templatePath = opts.templatePath || path.join(__dirname, '..', this.config.paths.messageTemplate);
        this.groupName = opts.groupName || this.config.group.name;
        this.groupId = opts.groupId || opts.groupID || null;
        if (this.groupId && !this.groupId.includes('@g.us')) this.groupId = this.groupId + '@g.us';
        // If groupId provided but groupName not, try to resolve name from logs
        if (this.groupId && !opts.groupName) {
            try {
                const { findGroupByIdInLogs } = require('../src/utils');
                const entry = findGroupByIdInLogs(this.groupId);
                if (entry) {
                    this.groupName = entry.groupName;
                    console.log(`[LIB] Resolved group name from logs by ID ${this.groupId} -> "${this.groupName}"`);
                }
            } catch {}
        }
        // If groupName provided but groupId not, try to resolve ID from logs
        if (this.groupName && !this.groupId) {
            try {
                const { findGroupInLogs } = require('../src/utils');
                const entry = findGroupInLogs(this.groupName);
                if (entry) {
                    this.groupId = entry.groupId;
                    console.log(`[LIB] Resolved group ID from logs by name "${this.groupName}" -> ${this.groupId}`);
                }
            } catch {}
        }
        this.groupDescription = opts.groupDescription || this.config.group.description;
        this.meetLink = opts.meetLink ? normalizeMeetLink(opts.meetLink) : null;
        if (this.meetLink && !isValidMeetLink(this.meetLink)) {
            console.log(`[WARN] Provided --meet link may be invalid: ${opts.meetLink} -> normalized: ${this.meetLink}`);
        }
        this.formLink = opts.formLink ? normalizeFormLink(opts.formLink) : null;
        if (this.formLink && !isValidFormLink(this.formLink)) {
            console.log(`[WARN] Provided --form link may be invalid: ${opts.formLink} -> normalized: ${this.formLink}`);
        }
        this.client = null;
        this.contacts = [];
        this.template = '';
    }

    /**
     * Apply meetLink/formLink overrides to contacts if flags were used
     * @param {Array} contacts
     * @returns {Array}
     */
    applyMeetLinkOverride(contacts) {
        let out = contacts;
        if (this.meetLink) {
            console.log(`[LIB] Override: applying --meet link to all ${out.length} contacts: ${this.meetLink}`);
            out = out.map(c => ({ ...c, meet_link: this.meetLink }));
        }
        if (this.formLink) {
            console.log(`[LIB] Override: applying --form link to all ${out.length} contacts: ${this.formLink}`);
            out = out.map(c => ({ ...c, form_link: this.formLink }));
        }
        return out;
    }

    applyLinkOverrides(contacts) { return this.applyMeetLinkOverride(contacts); }

    /**
     * Initialize WhatsApp client (QR scan on first run, session persisted)
     * @param {number} [timeoutMs=120000]
     */
    async init(timeoutMs = 120000) {
        this.contacts = loadContacts(this.contactsCsv);
        // Apply --meet flag override if provided
        this.contacts = this.applyMeetLinkOverride(this.contacts);
        this.template = loadTemplate(this.templatePath);

        // Validate meet links
        const { warnings } = validateContacts(this.contacts);
        warnings.forEach(w => console.log(w));

        console.log(`[LIB] Loaded ${this.contacts.length} contacts from ${this.contactsCsv}`);
        console.log(`[LIB] Template: ${this.templatePath}`);
        console.log(`[LIB] Group: ${this.groupName}${this.groupId ? ` (${this.groupId})` : ''}`);
        if (this.groupId) console.log(`[LIB] Group ID (from logs/flag): ${this.groupId}`);
        if (this.meetLink) console.log(`[LIB] Meet Link (flag): ${this.meetLink}`);
        if (this.formLink) console.log(`[LIB] Form Link (flag): ${this.formLink}`);

        this.client = createClient();
        await this.client.initialize();
        await waitForReady(this.client, timeoutMs);
        console.log('[LIB] Client ready');
        return this.client;
    }

    /**
     * Send detailed formatted bulk messages to all contacts
     * Message includes: name, phone, session, Google Meet link, group name
     * @returns {Promise<Array>} results
     */
    async sendBulk() {
        if (!this.client) throw new Error('Call init() first');
        if (!this.contacts.length) this.contacts = loadContacts(this.contactsCsv);
        if (!this.template) this.template = loadTemplate(this.templatePath);
        return await sendBulkMessages(this.client, this.contacts, this.template, this.config, { groupName: this.groupName });
    }

    /**
     * Create group if not exists, else add new members.
     * Always mentions group name in welcome.
     * @param {string} [groupNameOverride]
     * @returns {Promise<object>} {groupId, inviteLink, added, created, etc}
     */
    async createOrUpdateGroup(groupNameOverride, groupIdOverride) {
        if (!this.client) throw new Error('Call init() first');
        const name = groupNameOverride || this.groupName;
        const gid = groupIdOverride || this.groupId;
        if (!this.contacts.length) {
            this.contacts = loadContacts(this.contactsCsv);
            this.contacts = this.applyMeetLinkOverride(this.contacts);
        }
        // If groupId provided, try to ensure groupName is resolved for logs
        let effectiveName = name;
        let effectiveId = gid;
        if (gid && !name) {
            try { const { findGroupByIdInLogs } = require('../src/utils'); const e = findGroupByIdInLogs(gid); if (e) effectiveName = e.groupName; } catch {}
        }
        if (name && !gid) {
            try { const { findGroupInLogs } = require('../src/utils'); const e = findGroupInLogs(name); if (e) effectiveId = e.groupId; } catch {}
        }
        // New group message will be built inside groupCreator (session + group link + form link, no name/phone)
        return await createOrUpdateGroup(this.client, effectiveName, this.contacts, {
            description: this.groupDescription,
            meetLink: this.meetLink,
            formLink: this.formLink,
            groupId: effectiveId,
            welcomeMessage: `Group: ${effectiveName}\nSession: info\nGroup Link: will be added\nForm Link: ${this.formLink || 'see CSV'}`
        });
    }

    /**
     * Check if group already exists in logs (by name or ID) or live (for skipping personal sends)
     */
    async isGroupAlreadyExists(groupName, groupId) {
        const { isGroupInLogs, isGroupIdInLogs, findGroupInLogs, findGroupByIdInLogs } = require('../src/utils');
        const name = groupName || this.groupName;
        const gid = groupId || this.groupId;
        try { if (isGroupInLogs(name)) return true; } catch {}
        try { if (gid && isGroupIdInLogs(gid)) return true; } catch {}
        if (this.client) {
            try { const live = await findGroupByName(this.client, name); if (live) return true; } catch {}
            try { if (gid) { const liveById = await this.client.getChatById(gid).catch(()=>null); if (liveById && liveById.isGroup) return true; } } catch {}
            // Also check logs by ID -> try live by that ID
            try {
                const entry = findGroupInLogs(name);
                if (entry && entry.groupId) {
                    const liveByLogId = await this.client.getChatById(entry.groupId).catch(()=>null);
                    if (liveByLogId && liveByLogId.isGroup) return true;
                }
            } catch {}
        }
        return false;
    }

    /**
     * Both flow: if group already exists (logs or live), skip personal and only send group message
     */
    async sendBothIfNeeded() {
        const alreadyExists = await this.isGroupAlreadyExists(this.groupName);
        if (alreadyExists) {
            console.log(`[LIB] Group "${this.groupName}" already exists (logs/live) — skipping personal messages, will send group-only message.`);
            const groupRes = await this.createOrUpdateGroup();
            return { sendRes: [], skippedPersonal: true, groupRes };
        } else {
            const sendRes = await this.sendBulk();
            const groupRes = await this.createOrUpdateGroup();
            return { sendRes, skippedPersonal: false, groupRes };
        }
    }

    /**
     * Preview rendered messages (no WhatsApp connection needed)
     * @returns {Array<{contact, message}>}
     */
    previewMessages() {
        if (!this.contacts.length) this.contacts = loadContacts(this.contactsCsv);
        this.contacts = this.applyMeetLinkOverride(this.contacts);
        if (!this.template) this.template = loadTemplate(this.templatePath);
        return this.contacts.map(c => ({
            contact: c,
            message: c.custom_message || buildDetailedMessage(c, this.groupName, this.template, { formLink: this.formLink })
        }));
    }

    async destroy() {
        if (this.client) {
            try { await this.client.destroy(); } catch {}
            this.client = null;
        }
    }
}

// Convenience functional helpers for direct CSV + meet linking

/**
 * One-shot: load CSV, validate meet links, send detailed messages + create/update group
 * @param {object} opts - {contactsCsv, templatePath, groupName, dryRun}
 */
async function sendFromCsv(opts = {}) {
    const instance = new WhatsappBulk(opts);
    if (opts.dryRun) {
        const previews = instance.previewMessages();
        previews.forEach(({ contact, message }, i) => {
            console.log(`\n--- [${i + 1}] ${contact.name} | ${contact.phone} | ${contact.session} | Group: ${instance.groupName} ---`);
            console.log(message);
        });
        return previews;
    }
    await instance.init();
    // Requirement: if group already exists in logs/live, skip personal
    const { isGroupInLogs } = require('../src/utils');
    const { findGroupByName } = require('../src/groupCreator');
    let existsInLogs = false; try { existsInLogs = isGroupInLogs(instance.groupName); } catch {}
    let existsLive = false; try { existsLive = !!(await findGroupByName(instance.client, instance.groupName)); } catch {}
    if (existsInLogs || existsLive) {
        console.log(`[LIB] Group "${instance.groupName}" exists ${existsInLogs ? '(logs)' : ''}${existsInLogs && existsLive ? '+' : ''}${existsLive ? '(live)' : ''} — skipping personal, sending group-only.`);
        const groupRes = await instance.createOrUpdateGroup();
        await instance.destroy();
        return { sendRes: [], skippedPersonal: true, groupRes };
    }
    const sendRes = await instance.sendBulk();
    const groupRes = await instance.createOrUpdateGroup();
    await instance.destroy();
    return { sendRes, groupRes };
}

module.exports = {
    // Class
    WhatsappBulk,
    // Core client
    createClient,
    waitForReady,
    // Bulk & group
    sendBulkMessages,
    createGroup,
    createOrUpdateGroup,
    findGroupByName,
    // Utils
    loadContacts,
    loadTemplate,
    renderTemplate,
    formatPhone,
    sleep,
    randomDelay,
    logResults,
    // Meet linking
    isValidMeetLink,
    normalizeMeetLink,
    extractMeetCode,
    formatMeetLink,
    isValidFormLink,
    normalizeFormLink,
    formatFormLink,
    // Formatter
    buildDetailedMessage,
    validateContacts,
    // Helper
    sendFromCsv,
    // Default export is class for `require('whatsauto')` -> class
    default: WhatsappBulk
};
