const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let credentials;


// Permite carregar as credenciais via variável de ambiente ou arquivo local
if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    try {
        credentials = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
    } catch (err) {
        console.error('FIREBASE_SERVICE_ACCOUNT inválida');
        throw err;
    }
} else if (process.env.project_id && process.env.private_key && process.env.client_email) {
    credentials = {
        project_id: process.env.project_id,
        private_key: process.env.private_key.replace(/\\n/g, '\n'),
        client_email: process.env.client_email
    };
} else {
    const keyPath = path.join(__dirname, 'serviceAccountKey.json');
    if (fs.existsSync(keyPath)) {
        credentials = require(keyPath);
    } else {
        throw new Error('Credenciais do Firebase não encontradas');
    }
}

admin.initializeApp({
    credential: admin.credential.cert(credentials)
});

module.exports = admin;
