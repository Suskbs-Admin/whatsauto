const { formatMeetLink, normalizeMeetLink, formatFormLink, normalizeFormLink } = require('./meet');

/**
 * Build detailed formatted WhatsApp message
 * Uses CSV fields: phone, name, session, meet_link + groupName
 * @param {object} contact - {phone, name, session, meet_link, custom_message}
 * @param {string} groupName - WhatsApp group name to mention
 * @param {string} template - message template with placeholders
 * @returns {string} rendered message
 */
function buildDetailedMessage(contact, groupName, template, extra = {}) {
    const meetLink = formatMeetLink(contact.meet_link);
    const formLink = formatFormLink(contact.form_link || extra.formLink || extra.form_link || '', { fallbackText: '' });
    const groupLink = extra.groupLink || extra.group_link || '';
    const data = {
        name: contact.name,
        phone: contact.phone,
        session: contact.session,
        meet_link: meetLink,
        meetlink: meetLink,
        link: meetLink,
        meet: meetLink,
        form_link: formLink,
        formlink: formLink,
        form: formLink,
        google_form: formLink,
        gform: formLink,
        google_form_link: formLink,
        group_name: groupName || '',
        group: groupName || '',
        group_link: groupLink,
        grouplink: groupLink,
        phone_display: `+${contact.phone}`
    };

    let out = template;
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        out = out.replace(regex, value);
    }
    return out;
}

/**
 * Build group-only message (no name/phone, only session + group link + form link + meet link)
 * Uses group template, aggregates unique sessions if multiple
 * @param {Array} contacts - contacts for session aggregation
 * @param {string} groupName
 * @param {string} groupLink - invite link https://chat.whatsapp.com/...
 * @param {string} template - group message template
 * @param {object} extra - {meetLink, formLink}
 * @returns {string}
 */
function buildGroupOnlyMessage(contacts, groupName, groupLink, template, extra = {}) {
    // Aggregate unique sessions with their meet links
    const sessionMap = {};
    for (const c of contacts) {
        const sess = c.session || 'General';
        if (!sessionMap[sess]) sessionMap[sess] = new Set();
        const ml = extra.meetLink || c.meet_link || '';
        if (ml) sessionMap[sess].add(formatMeetLink(ml));
    }
    const sessions = Object.keys(sessionMap);
    const sessionStr = sessions.length === 1 ? sessions[0] : sessions.join(', ');
    const meetLinks = [...new Set(Object.values(sessionMap).flatMap(s => [...s]))].join(', ') || (extra.meetLink ? formatMeetLink(extra.meetLink) : '');
    const formLink = formatFormLink(extra.formLink || contacts[0]?.form_link || '', { fallbackText: '' });

    let out = template;
    const data = {
        session: sessionStr,
        sessions: sessionStr,
        group_name: groupName || '',
        group: groupName || '',
        group_link: groupLink || '',
        grouplink: groupLink || '',
        groupLink: groupLink || '',
        invite_link: groupLink || '',
        meet_link: meetLinks,
        meetlink: meetLinks,
        meet: meetLinks,
        link: meetLinks,
        form_link: formLink,
        formlink: formLink,
        form: formLink,
        google_form: formLink,
        gform: formLink
    };
    for (const [key, value] of Object.entries(data)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        out = out.replace(regex, value);
    }
    return out;
}

/**
 * Validate contacts array for required fields and meet/form links
 * @param {Array} contacts
 * @returns {{valid: Array, invalid: Array, warnings: Array}}
 */
function validateContacts(contacts) {
    const warnings = [];
    const invalid = [];
    const valid = [];

    for (const c of contacts) {
        if (!c.phone || c.phone.length < 10) {
            invalid.push({ contact: c, reason: 'Invalid phone' });
            continue;
        }
        if (!c.meet_link) {
            warnings.push(`[WARN] ${c.name} (${c.phone}) has no meet_link`);
        } else {
            const normalized = normalizeMeetLink(c.meet_link);
            if (!normalized.includes('meet.google.com') && !normalized.startsWith('https://')) {
                warnings.push(`[WARN] ${c.name} (${c.phone}) meet_link looks invalid: ${c.meet_link}`);
            }
        }
        if (!c.form_link) {
            // Optional, just info - not warning as form may be via flag
            // warnings.push(`[INFO] ${c.name} (${c.phone}) has no form_link`);
        } else {
            const fn = normalizeFormLink(c.form_link);
            if (!fn.includes('docs.google.com') && !fn.includes('forms.gle') && !fn.includes('forms.google.com')) {
                // allow but warn if not a form link but still URL
                if (!fn.startsWith('https://')) warnings.push(`[WARN] ${c.name} (${c.phone}) form_link looks invalid: ${c.form_link}`);
            }
        }
        valid.push(c);
    }

    return { valid, invalid, warnings };
}

module.exports = { buildDetailedMessage, buildGroupOnlyMessage, validateContacts };
