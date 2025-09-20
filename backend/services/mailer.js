const nodemailer = require('nodemailer');

let transporter;

function buildTransporter() {
    const {
        SMTP_HOST,
        SMTP_PORT,
        SMTP_USER,
        SMTP_PASS,
        SMTP_SECURE
    } = process.env;

    if (!SMTP_HOST) {
        return null;
    }

    const port = Number(SMTP_PORT || 587);
    const secure = SMTP_SECURE === 'true' || port === 465;

    const auth = SMTP_USER ? { user: SMTP_USER, pass: SMTP_PASS } : undefined;

    return nodemailer.createTransport({
        host: SMTP_HOST,
        port,
        secure,
        auth
    });
}

async function getTransporter() {
    if (!transporter) {
        transporter = buildTransporter();
    }
    return transporter;
}

async function sendMail(options) {
    const mailer = await getTransporter();
    if (!mailer) {
        console.warn('Serviço de email não configurado. Defina as variáveis SMTP_HOST, SMTP_PORT, SMTP_USER e SMTP_PASS.');
        return false;
    }

    const from = options.from || process.env.SMTP_FROM || process.env.SMTP_USER;
    const mailOptions = { ...options, from };

    await mailer.sendMail(mailOptions);
    return true;
}

module.exports = {
    sendMail
};
