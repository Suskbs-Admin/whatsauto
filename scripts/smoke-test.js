const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');

const lib = require('../lib');

(async () => {
    // Export surface
    assert.strictEqual(typeof lib.WhatsappBulk, 'function', 'WhatsappBulk is exported');
    assert.strictEqual(typeof lib.loadContacts, 'function', 'loadContacts is exported');
    assert.strictEqual(typeof lib.loadTemplate, 'function', 'loadTemplate is exported');
    assert.strictEqual(typeof lib.renderTemplate, 'function', 'renderTemplate is exported');
    assert.strictEqual(typeof lib.formatPhone, 'function', 'formatPhone is exported');
    assert.strictEqual(typeof lib.buildDetailedMessage, 'function', 'buildDetailedMessage is exported');
    assert.strictEqual(typeof lib.validateContacts, 'function', 'validateContacts is exported');
    assert.strictEqual(typeof lib.sendFromCsv, 'function', 'sendFromCsv is exported');
    assert.strictEqual(lib.default, lib.WhatsappBulk, 'default export === WhatsappBulk');

    // Type definitions ship with the package
    const dts = path.join(__dirname, '..', 'lib', 'index.d.ts');
    assert.ok(fs.existsSync(dts), 'lib/index.d.ts exists');

    // Default template + config ship with the package
    const cfg = require('../config.json');
    assert.ok(cfg.paths && cfg.paths.messageTemplate, 'config.json has paths');
    const tpl = path.join(__dirname, '..', cfg.paths.messageTemplate);
    assert.ok(fs.existsSync(tpl), 'default template exists');

    // Meet / Form utilities
    assert.strictEqual(lib.normalizeMeetLink('meet.google.com/abc-defg-hij'), 'https://meet.google.com/abc-defg-hij');
    assert.ok(lib.isValidMeetLink('https://meet.google.com/abc-defg-hij'), 'valid meet link');
    assert.ok(lib.isValidFormLink('https://forms.gle/xyz123'), 'valid form link');
    assert.strictEqual(lib.extractMeetCode('https://meet.google.com/abc-defg-hij'), 'abc-defg-hij');

    // CSV -> preview pipeline (no WhatsApp connection needed)
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'whatsauto-smoke-'));
    const csv = path.join(tmp, 'contacts.csv');
    fs.writeFileSync(csv,
        'phone,name,session,meet_link,form_link\n' +
        '919876543210,Rahul Sharma,Session 1,https://meet.google.com/abc-defg-hij,https://forms.gle/xyz123\n');

    const contacts = lib.loadContacts(csv);
    assert.strictEqual(contacts.length, 1, 'one contact parsed');
    assert.strictEqual(contacts[0].phone, '919876543210', 'phone normalized');

    const wa = new lib.WhatsappBulk({
        contactsCsv: csv,
        groupName: 'Smoke Test Group',
        meetLink: 'https://meet.google.com/abc-defg-hij',
        formLink: 'https://forms.gle/xyz123'
    });
    const previews = wa.previewMessages();
    assert.strictEqual(previews.length, 1, 'preview renders one message');
    assert.ok(previews[0].message.includes('Rahul Sharma'), 'preview contains name');
    assert.ok(previews[0].message.includes('Smoke Test Group'), 'preview contains group name');
    assert.ok(previews[0].message.includes('https://meet.google.com/abc-defg-hij'), 'preview contains meet link');

    // One-shot dry-run helper
    const dry = await lib.sendFromCsv({ contactsCsv: csv, groupName: 'Smoke Test Group', dryRun: true });
    assert.strictEqual(dry.length, 1, 'sendFromCsv dry-run returns previews');

    fs.rmSync(tmp, { recursive: true, force: true });
    console.log('[SMOKE] whatsauto OK — exports, defaults, preview, and dry-run all pass.');
})().catch(err => {
    console.error('[SMOKE] FAILED:', err);
    process.exit(1);
});