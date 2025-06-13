const express = require('express');
const router = express.Router({ mergeParams: true });
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Obter anamnese de um aluno
router.get('/alunos/:alunoId/anamnese', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.alunoId;
    try {
        const doc = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('anamnese').doc('respostas').get();
        if (!doc.exists) {
            return res.json(null);
        }
        res.json(doc.data());
    } catch (err) {
        console.error('Erro ao obter anamnese:', err);
        res.status(500).json({ error: 'Erro ao obter anamnese' });
    }
});

// Criar ou atualizar anamnese do aluno
router.post('/alunos/:alunoId/anamnese', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.alunoId;
    const data = req.body;

    try {
        await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('anamnese').doc('respostas')
            .set(data, { merge: true });

        res.status(200).json({ message: 'Anamnese salva' });
    } catch (err) {
        console.error('Erro ao salvar anamnese:', err);
        res.status(500).json({ error: 'Erro ao salvar anamnese' });
    }
});

// Importar dados da planilha do Google Sheets pelo email do aluno
router.get('/alunos/:alunoId/anamnese/sheet', verifyToken, async (req, res) => {
    const email = req.query.email;
    if (!email) return res.status(400).json({ error: 'Email requerido' });

    try {
        const { google } = require('googleapis');
        const auth = new google.auth.GoogleAuth({
            scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
        });
        const client = await auth.getClient();
        const sheets = google.sheets({ version: 'v4', auth: client });

        const spreadsheetId = process.env.GOOGLE_SHEETS_ID;
        const range = process.env.GOOGLE_SHEETS_RANGE || 'Sheet1!A:Z';
        const sheetRes = await sheets.spreadsheets.values.get({
            spreadsheetId,
            range
        });
        const rows = sheetRes.data.values;
        if (!rows || rows.length === 0) return res.json(null);
        const headers = rows[0].map(h => h.trim());
        const emailIdx = headers.findIndex(h => h.toLowerCase() === 'email');
        if (emailIdx === -1) return res.json(null);
        const row = rows.find((r, i) => i > 0 && r[emailIdx] && r[emailIdx].toLowerCase() === email.toLowerCase());
        if (!row) return res.json(null);
        const data = {};
        headers.forEach((h, idx) => {
            if (row[idx] !== undefined) data[h] = row[idx];
        });
        res.json(data);
    } catch (err) {
        console.error('Erro ao importar planilha:', err);
        res.status(500).json({ error: 'Erro ao importar planilha' });
    }
});

module.exports = router;
