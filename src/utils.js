const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');
const { normalizeMeetLink, formatMeetLink, normalizeFormLink, formatFormLink } = require('../lib/meet');

function loadConfig() {
    const configPath = path.join(__dirname, '..', 'config.json');
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
}

function loadContacts(csvPath) {
    const absolutePath = path.isAbsolute(csvPath) ? csvPath : path.join(__dirname, '..', csvPath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Contacts file not found: ${absolutePath}`);
    const ext = path.extname(absolutePath).toLowerCase();
    let records = [];

    if (ext === '.xlsx' || ext === '.xls') {
        // XLSX/XLS support
        let XLSX;
        try { XLSX = require('xlsx'); } catch (e) { throw new Error(`xlsx package not installed. Run npm.cmd install — missing: ${e.message}`); }
        const workbook = XLSX.readFile(absolutePath);
        if (!workbook.SheetNames.length) throw new Error(`No sheets found in ${csvPath}`);
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        // defval:'' keeps empty cells as '', raw:false keeps formatted text
        records = XLSX.utils.sheet_to_json(sheet, { defval: '', raw: false, blankrows: false });
        // sheet_to_json uses first row as headers; trim headers and values
        records = records.map(r => {
            const obj = {};
            for (const k of Object.keys(r)) {
                const cleanK = stripBOM(String(k)).trim();
                obj[cleanK] = stripBOM(String(r[k] ?? ''));
            }
            return obj;
        });
        // Filter out completely empty rows
        records = records.filter(r => Object.values(r).some(v => String(v).trim() !== ''));
        console.log(`[INFO] Loaded ${records.length} rows from XLSX sheet "${sheetName}" in ${csvPath}`);
    } else {
        // CSV support (default)
        let content = fs.readFileSync(absolutePath, 'utf8');
        if (content.charCodeAt(0) === 0xFEFF) content = content.slice(1);
        records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true,
            bom: true
        });
    }

    const contacts = [];
    for (const r of records) {
        try {
            contacts.push(normalizeContact(r));
        } catch (e) {
            console.log(`[WARN] Skipping row: ${e.message} | Row: ${JSON.stringify(r)}`);
        }
    }
    if (contacts.length === 0) throw new Error(`No valid contacts found in ${csvPath}. Check headers: need phone / name / session. Found headers: ${Object.keys(records[0] || {}).join(', ')}`);
    return contacts;
}

function stripBOM(str) {
    return String(str || '').replace(/^\uFEFF/, '').trim();
}

function getAliasedValue(obj, aliases) {
    for (const alias of aliases) {
        if (obj[alias] !== undefined && String(obj[alias]).trim() !== '') return String(obj[alias]).trim();
    }
    return '';
}

function normalizeContact(r) {
    // normalize keys: lower case, strip BOM, trim, replace underscores/spaces handling
    const obj = {};
    for (const k of Object.keys(r)) {
        const cleanKey = stripBOM(k).toLowerCase().trim();
        obj[cleanKey] = stripBOM(r[k]);
    }
    // Aliases for flexible CSV headers (supports Demo-list.csv style)
    const phoneAliases = ['phone', 'phone number', 'phone_number', 'phone no', 'phone no.', 'mobile', 'mobile number', 'number', 'contact', 'whatsapp', 'tel', 'phone no '];
    const nameAliases = ['name', 'full name', 'student name', 'names', 'person', 'contact name', 'username'];
    const sessionAliases = ['session', 'sesssion', 'sessions', 'session name', 'batch', 'slot', 'time', 'course', 'sesssion'];

    const phoneRaw = getAliasedValue(obj, phoneAliases);
    const nameRaw = getAliasedValue(obj, nameAliases);
    const sessionRaw = getAliasedValue(obj, sessionAliases);

    // required: phone
    if (!phoneRaw) throw new Error(`Missing phone in row: ${JSON.stringify(r)} (tried aliases: ${phoneAliases.join(', ')})`);
    const rawLink = obj.meet_link || obj.meetlink || obj.link || obj.meet || obj['google meet'] || obj['meet link'] || getAliasedValue(obj, ['meet_link', 'meet']) || '';
    const rawForm = obj.form_link || obj.formlink || obj.form || obj['google form'] || obj['form link'] || obj.gform || obj['google form link'] || '';
    return {
        phone: formatPhone(phoneRaw),
        name: nameRaw || obj.name || 'there',
        session: sessionRaw || obj.session || obj['session name'] || 'Your Session',
        meet_link: rawLink ? normalizeMeetLink(rawLink) : '',
        form_link: rawForm ? normalizeFormLink(rawForm) : '',
        custom_message: obj.custom_message || obj.message || ''
    };
}

function formatPhone(raw) {
    const config = loadConfig();
    let p = String(raw).replace(/\D/g, ''); // remove non digits
    p = p.replace(/^0+/, ''); // remove leading zeros

    // if 10 digits, prepend default country code
    if (p.length === 10) {
        p = config.countryCodeDefault + p;
    }
    // if starts with 0 + country code edge case already handled
    // Ensure no '+' prefix for whatsapp-web.js (uses 91xxxx@c.us)
    return p;
}

function loadTemplate(templatePath) {
    const absolutePath = path.isAbsolute(templatePath) ? templatePath : path.join(__dirname, '..', templatePath);
    if (!fs.existsSync(absolutePath)) throw new Error(`Template not found: ${absolutePath}`);
    return fs.readFileSync(absolutePath, 'utf8');
}

/**
 * Render template with contact data.
 * Supports {{name}}, {{phone}}, {{session}}, {{meet_link}}, {{form_link}}, {{group_name}}, etc.
 */
function renderTemplate(template, contact, extra = {}) {
    const meetFormatted = contact.meet_link ? formatMeetLink(contact.meet_link) : '';
    const formFormatted = contact.form_link ? formatFormLink(contact.form_link) : (extra.form_link || extra.formLink || '');
    const groupName = extra.groupName || extra.group_name || contact.group_name || '';
    let out = template;
    const map = {
        name: contact.name,
        phone: contact.phone,
        phone_display: `+${contact.phone}`,
        session: contact.session,
        meet_link: meetFormatted || contact.meet_link,
        meetlink: meetFormatted || contact.meet_link,
        link: meetFormatted || contact.meet_link,
        meet: meetFormatted || contact.meet_link,
        form_link: formFormatted || contact.form_link || '',
        formlink: formFormatted || contact.form_link || '',
        form: formFormatted || contact.form_link || '',
        google_form: formFormatted || contact.form_link || '',
        gform: formFormatted || contact.form_link || '',
        google_form_link: formFormatted || contact.form_link || '',
        group_name: groupName,
        group: groupName
    };
    // Merge any extra keys
    for (const [k, v] of Object.entries(extra)) {
        map[k.toLowerCase()] = v;
    }
    for (const [key, value] of Object.entries(map)) {
        const regex = new RegExp(`\\{\\{\\s*${key}\\s*\\}\\}`, 'gi');
        out = out.replace(regex, value);
    }
    return out;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function randomDelay(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ensureLogsDir() {
    const config = loadConfig();
    const logsDir = path.isAbsolute(config.paths.logsDir) ? config.paths.logsDir : path.join(__dirname, '..', config.paths.logsDir);
    if (!fs.existsSync(logsDir)) fs.mkdirSync(logsDir, { recursive: true });
    return logsDir;
}

function logResults(results) {
    const logsDir = ensureLogsDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const file = path.join(logsDir, `send_results_${timestamp}.json`);
    fs.writeFileSync(file, JSON.stringify(results, null, 2));
    // also write failed.csv
    const failed = results.filter(r => !r.success);
    if (failed.length) {
        const failedPath = path.join(logsDir, `failed_${timestamp}.csv`);
        const header = 'phone,name,session,meet_link,error\n';
        const rows = failed.map(f => `${f.contact.phone},"${f.contact.name}","${f.contact.session}",${f.contact.meet_link},"${(f.error || '').replace(/"/g, '""')}"`).join('\n');
        fs.writeFileSync(failedPath, header + rows);
    }
    return file;
}

// ---------------- Group logs (check group name from logs) ----------------

function getGroupLogsPath() {
    const logsDir = ensureLogsDir();
    return path.join(logsDir, 'groups.json');
}

function loadGroupLogs() {
    const p = getGroupLogsPath();
    if (!fs.existsSync(p)) return [];
    try {
        const data = fs.readFileSync(p, 'utf8');
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}

function saveGroupLog(entry) {
    const p = getGroupLogsPath();
    const logs = loadGroupLogs();
    const idx = logs.findIndex(g => g.groupName && g.groupName.trim().toLowerCase() === entry.groupName.trim().toLowerCase());
    const record = {
        groupName: entry.groupName,
        groupId: entry.groupId,
        inviteLink: entry.inviteLink || '',
        createdAt: entry.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        sessions: entry.sessions || [],
        formLink: entry.formLink || '',
        meetLink: entry.meetLink || ''
    };
    if (idx >= 0) {
        logs[idx] = { ...logs[idx], ...record, updatedAt: new Date().toISOString() };
    } else {
        logs.push(record);
    }
    fs.writeFileSync(p, JSON.stringify(logs, null, 2));
    return p;
}

function findGroupInLogs(groupName) {
    const logs = loadGroupLogs();
    return logs.find(g => g.groupName && g.groupName.trim().toLowerCase() === groupName.trim().toLowerCase()) || null;
}

function findGroupByIdInLogs(groupId) {
    const logs = loadGroupLogs();
    const cleanId = String(groupId).trim();
    return logs.find(g => g.groupId && g.groupId.trim() === cleanId) || logs.find(g => g.groupId && g.groupId.includes(cleanId.replace('@g.us',''))) || null;
}

function isGroupInLogs(groupName) {
    return !!findGroupInLogs(groupName);
}

function isGroupIdInLogs(groupId) {
    return !!findGroupByIdInLogs(groupId);
}

function getGroupIdFromLogs(groupName) {
    const entry = findGroupInLogs(groupName);
    return entry ? entry.groupId : null;
}

function getGroupNameFromLogsById(groupId) {
    const entry = findGroupByIdInLogs(groupId);
    return entry ? entry.groupName : null;
}

module.exports = {
    loadConfig,
    loadContacts,
    loadTemplate,
    renderTemplate,
    formatPhone,
    sleep,
    randomDelay,
    logResults,
    ensureLogsDir,
    getGroupLogsPath,
    loadGroupLogs,
    saveGroupLog,
    findGroupInLogs,
    findGroupByIdInLogs,
    isGroupInLogs,
    isGroupIdInLogs,
    getGroupIdFromLogs,
    getGroupNameFromLogsById
};
