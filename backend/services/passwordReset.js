const admin = require('../firebase-admin');

const FIREBASE_RESET_ENDPOINT = 'https://identitytoolkit.googleapis.com/v1/accounts:sendOobCode';

async function postJson(url, payload, { headers = {} } = {}) {
    if (typeof globalThis.fetch === 'function') {
        return globalThis.fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...headers
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
                'Content-Length': Buffer.byteLength(body),
                ...headers
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
    const payload = buildFirebasePayload(email, actionSettings);

    if (await trySendWithApiKey(payload)) {
        return true;
    }

    return trySendWithServiceAccount(payload);
}

function buildFirebasePayload(email, actionSettings = {}) {
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

    return payload;
}

async function trySendWithApiKey(payload) {
    const apiKey = resolveFirebaseApiKey();
    if (!apiKey) {
        console.warn('Firebase API key não configurado. Tentando enviar e-mail de redefinição via credencial de serviço do Firebase.');
        return false;
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

async function trySendWithServiceAccount(payload) {
    let credential;
    try {
        const app = admin.app();
        credential = app?.options?.credential;
        if (!credential || typeof credential.getAccessToken !== 'function') {
            console.warn('Credencial do Firebase Admin indisponível para envio de e-mail de redefinição.');
            return false;
        }

        const { access_token: accessToken } = await credential.getAccessToken() || {};
        if (!accessToken) {
            console.warn('Não foi possível obter token de acesso para envio de e-mail de redefinição via Firebase.');
            return false;
        }

        const projectId = app?.options?.projectId
            || process.env.GOOGLE_CLOUD_PROJECT
            || process.env.GCLOUD_PROJECT
            || process.env.FIREBASE_PROJECT_ID
            || process.env.PROJECT_ID;

        if (!projectId) {
            console.warn('ID do projeto Firebase não configurado. Informe FIREBASE_PROJECT_ID ou PROJECT_ID.');
            return false;
        }

        const requestBody = {
            ...payload,
            targetProjectId: payload.targetProjectId || projectId,
            returnOobLink: true
        };

        const response = await postJson(
            `https://identitytoolkit.googleapis.com/v1/projects/${projectId}/accounts:sendOobCode`,
            requestBody,
            { headers: { Authorization: `Bearer ${accessToken}` } }
        );

        if (!response.ok) {
            let errorDetails;
            try {
                errorDetails = await response.json();
            } catch (parseErr) {
                errorDetails = await response.text();
            }
            console.error('Erro ao solicitar e-mail de redefinição via credencial de serviço Firebase:', errorDetails);
            return false;
        }

        return true;
    } catch (err) {
        console.error('Erro ao enviar e-mail de redefinição via credencial de serviço Firebase:', err);
        return false;
    }
}

module.exports = {
    sendFirebasePasswordResetEmail,
    resolveFirebaseApiKey
};
