const { loadConfig, loadContacts, loadTemplate, renderTemplate } = require('./utils');
const { normalizeMeetLink, normalizeFormLink } = require('../lib/meet');

const config = loadConfig();
let csvPath = config.paths.contactsCsv;
let groupName = config.group.name;
let meetLinkFlag = null, formLinkFlag = null;
for (let i = 2; i < process.argv.length; i++) {
    const a = process.argv[i];
    if ((a === '--csv' || a === '--file' || a === '--contacts' || a === '--input') && process.argv[i + 1]) csvPath = process.argv[++i];
    else if ((a === '--group' || a === '--group-name' || a === '--name') && process.argv[i + 1]) groupName = process.argv[++i];
    else if (['--meet', '--meet-link', '--meetLink', '--meeting', '--link', '--url'].includes(a) && process.argv[i + 1]) meetLinkFlag = normalizeMeetLink(process.argv[++i]);
    else if (['--form', '--form-link', '--formLink', '--google-form', '--gform', '--forms'].includes(a) && process.argv[i + 1]) formLinkFlag = normalizeFormLink(process.argv[++i]);
}
let contacts = loadContacts(csvPath);
if (meetLinkFlag) {
    console.log(`[FLAG] --meet override: ${meetLinkFlag}`);
    contacts = contacts.map(c => ({ ...c, meet_link: meetLinkFlag }));
}
if (formLinkFlag) {
    console.log(`[FLAG] --form override: ${formLinkFlag}`);
    contacts = contacts.map(c => ({ ...c, form_link: formLinkFlag }));
}
// Prefer detailed template if available
const fs = require('fs');
const path = require('path');
let templatePath = config.paths.messageTemplate;
const detailed = path.join(__dirname, '..', 'data', 'message_template_detailed.txt');
if (fs.existsSync(detailed) && !process.argv.includes('--simple')) templatePath = './data/message_template_detailed.txt';

const template = loadTemplate(templatePath);

console.log(`Template: ${templatePath}`);
console.log(`Group: ${groupName}`);
if (meetLinkFlag) console.log(`Meet (flag): ${meetLinkFlag}`);
if (formLinkFlag) console.log(`Form (flag): ${formLinkFlag}`);
console.log(`File: ${csvPath}`);
console.log(`Loaded ${contacts.length} contacts\n`);
contacts.forEach(c => {
    console.log(`--- ${c.name} (${c.phone}) | ${c.session} | Group: ${groupName} | Meet: ${c.meet_link} | Form: ${c.form_link || 'none'} ---`);
    const msg = c.custom_message ? c.custom_message : renderTemplate(template, c, { groupName });
    console.log(msg);
    console.log('');
});
