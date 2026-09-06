/**
 * Example: Using whatsauto as NPM library
 * 
 * Covers: CSV -> detailed formatted messages with Google Meet + Google Form linking + group creation (update if exists)
 * Flags mapping: --csv/--file (file), --group (group name), --meet (meet link), --form (form link)
 */

const path = require('path');

// 1. Class-based usage with all flags
async function classExample() {
    const { WhatsappBulk } = require('whatsauto');

    const wa = new WhatsappBulk({
        contactsCsv: './data/contacts.csv',                 // flag: --csv / --file / --input
        templatePath: './data/message_template_detailed.txt', // detailed template with {{group_name}}, {{form_link}}
        groupName: 'SUSKBS Session Group',                  // flag: --group
        groupDescription: 'SUSKBS - Session updates',
        meetLink: 'https://meet.google.com/abc-defg-hij',   // flag: --meet (overrides CSV for all)
        formLink: 'https://forms.gle/exampleForm'           // flag: --form (overrides CSV for all)
    });

    // Preview without login (dry run)
    console.log('=== PREVIEW ===');
    wa.previewMessages().forEach(({ contact, message }) => {
        console.log(`\n--- ${contact.name} | ${contact.phone} | ${contact.session} ---`);
        console.log(message);
    });

    // Actual send (requires QR scan first time)
    // await wa.init(); // shows QR, waits for scan
    // await wa.sendBulk(); // sends detailed messages: name, phone, session, Google Meet, group
    // const groupRes = await wa.createOrUpdateGroup(); // creates or adds new members if exists
    // console.log('Group:', groupRes);
    // await wa.destroy();
}

// 2. Functional helper with Google Meet + Form linking
async function functionalExample() {
    const wa = require('whatsauto');
    const { isValidMeetLink, normalizeMeetLink, formatMeetLink, isValidFormLink, normalizeFormLink, formatFormLink } = wa;

    const meet = 'meet.google.com/abc-defg-hij';
    console.log('Meet Raw:', meet);
    console.log('Meet Normalized:', normalizeMeetLink(meet)); // https://meet.google.com/abc-defg-hij
    console.log('Meet Valid:', isValidMeetLink(meet)); // true
    console.log('Meet Formatted:', formatMeetLink(meet));

    const form = 'forms.gle/xyz123';
    console.log('Form Raw:', form);
    console.log('Form Normalized:', normalizeFormLink(form));
    console.log('Form Valid:', isValidFormLink(form));
    console.log('Form Formatted:', formatFormLink(form));

    // Validate contacts meet/form links before sending
    const contacts = wa.loadContacts('./data/contacts.csv');
    const { warnings, invalid } = wa.validateContacts(contacts);
    warnings.forEach(w => console.log(w));
    if (invalid.length) console.log('Invalid contacts:', invalid);
}

// 3. One-shot helper with all flags
async function oneShotExample() {
    const { sendFromCsv } = require('whatsauto');
    // Dry run with flags mapped: file, group, meet, form
    await sendFromCsv({
        contactsCsv: './data/contacts.csv', // --file
        groupName: 'SUSKBS Demo',           // --group
        meetLink: 'https://meet.google.com/demo', // --meet
        formLink: 'https://forms.gle/demo',       // --form
        dryRun: true
    });
    // Real:
    // await sendFromCsv({ contactsCsv: './data/contacts.csv', groupName: 'SUSKBS Demo', meetLink: 'https://meet.google.com/xxx', formLink: 'https://forms.gle/xxx' });
}

if (require.main === module) {
    (async () => {
        await classExample();
        await functionalExample();
        await oneShotExample();
    })();
}

module.exports = { classExample, functionalExample, oneShotExample };
