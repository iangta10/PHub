const FIREBASE_RESET_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';

async function postJson(url, payload) {
    if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
    }

    const { request } = require('https');
    const parsedUrl = new URL(url);
    const body = JSON.stringify(payload);

    return new Promise((resolve, reject) => {
        const req = request({
            method: 'POST',
            hostname: parsedUrl.hostname,
            path: `${parsedUrl.pathname}${parsedUrl.search}`,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(body)
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => { data += chunk; });
            res.on('end', () => {
                const response = {
                    ok: res.statusCode >= 200 && res.statusCode < 300,
                    status: res.statusCode,
                    async json() {
                        return data ? JSON.parse(data) : {};
                    },
                    async text() {
                        return data;
                    }
                };
                resolve(response);
            });
        });

        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function resolveFirebaseApiKey() {
    return process.env.FIREBASE_WEB_API_KEY
        || process.env.FIREBASE_API_KEY
        || process.env.NEXT_PUBLIC_FIREBASE_API_KEY
        || process.env.VITE_FIREBASE_API_KEY
        || process.env.NEXT_PUBLIC_FIREBASE_WEB_API_KEY
        || null;
}

async function sendFirebasePasswordResetEmail(email, actionSettings = {}) {
    const apiKey = resolveFirebaseApiKey();
    if (!apiKey) {
        console.warn('Firebase API key não configurado. Defina FIREBASE_WEB_API_KEY (ou equivalente) para enviar e-mails de redefinição via Firebase.');
        return false;
    }

    const payload = {
        requestType: 'PASSWORD_RESET',
        email
    };

    if (actionSettings && typeof actionSettings === 'object') {
        if (actionSettings.url) {
            payload.continueUrl = actionSettings.url;
        }
        if (actionSettings.dynamicLinkDomain) {
            payload.dynamicLinkDomain = actionSettings.dynamicLinkDomain;
        }
    }

    try {
        const response = await postJson(`${FIREBASE_RESET_ENDPOINT}?key=${apiKey}`, payload);

        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            } catch (parseErr) {
                errorDetails = await response.text();
            }
            console.error('Erro ao solicitar e-mail de redefinição via Firebase:', errorDetails);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Erro ao enviar e-mail de redefinição via Firebase:', err);
        return false;
    }
}

module.exports = {
    sendFirebasePasswordResetEmail,
    resolveFirebaseApiKey
};
