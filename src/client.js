const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const path = require('path');
const { loadConfig } = require('./utils');

function createClient() {
    const config = loadConfig();
    const client = new Client({
        authStrategy: new LocalAuth({
            dataPath: path.isAbsolute(config.paths.sessionDir) ? config.paths.sessionDir : path.join(__dirname, '..', config.paths.sessionDir)
        }),
        puppeteer: {
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu']
        }
    });

    client.on('qr', (qr) => {
        console.log('\n[QR] Scan this QR code with WhatsApp > Linked Devices > Link a device:\n');
        qrcode.generate(qr, { small: true });
        console.log('\n[INFO] QR also available as string:', qr.slice(0, 30) + '...');
    });

    client.on('authenticated', () => {
        console.log('[OK] Authenticated successfully. Session saved.');
    });

    client.on('auth_failure', msg => {
        console.error('[ERROR] Authentication failure:', msg);
    });

    client.on('ready', () => {
        console.log('[READY] WhatsApp client is ready!');
    });

    client.on('disconnected', (reason) => {
        console.log('[DISCONNECTED]', reason);
    });

    return client;
}

function waitForReady(client, timeoutMs = 60000) {
    return new Promise((resolve, reject) => {
        if (client.info && client.info.wid) return resolve();

        const onReady = () => {
            clearTimeout(timer);
            client.removeListener('auth_failure', onFail);
            resolve();
        };
        const onFail = (msg) => {
            clearTimeout(timer);
            client.removeListener('ready', onReady);
            reject(new Error('Auth failure: ' + msg));
        };
        client.once('ready', onReady);
        client.once('auth_failure', onFail);

        const timer = setTimeout(() => {
            client.removeListener('ready', onReady);
            client.removeListener('auth_failure', onFail);
            reject(new Error(`Timeout waiting for client ready after ${timeoutMs}ms. Did you scan QR?`));
        }, timeoutMs);
    });
}

module.exports = { createClient, waitForReady };
