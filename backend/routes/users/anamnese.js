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

        const normalize = str => str.toLowerCase()
            .normalize('NFD').replace(/[^\w]/g, '');

        const fieldMap = {
            email: ['email', 'e-mail', 'mail'],
            nome: ['nome', 'nomecompleto', 'name'],
            idade: ['idade', 'age'],
            genero: ['genero', 'sexo', 'gender'],
            altura: ['altura', 'height'],
            peso: ['peso', 'weight'],
            objetivos: ['objetivos', 'objetivo', 'goals'],
            doencas: ['doencas', 'doen\u00e7as', 'doenca', 'condicoes'],
            doencasFamilia: ['doencasfamilia', 'doencasfamiliares', 'historico', 'familia'],
            medicamentos: ['medicamentos', 'medicacao', 'remedios'],
            cirurgias: ['cirurgias', 'cirurgia', 'surgeries'],
            doresLesoes: ['doreslesoes', 'lesoes', 'dores', 'injuries'],
            limitacoes: ['limitacoes', 'restricoes', 'limitations'],
            fuma: ['fuma', 'fumante', 'smoker'],
            bebe: ['bebe', 'alcool', 'bebida'],
            qualidadeSono: ['qualidadesono', 'qualidadedsono', 'sleepquality'],
            horasSono: ['horassono', 'tempodesono', 'sleephours'],
            nivelAtividade: ['nivelatividade', 'atividadenivel', 'activitylevel'],
            tiposExercicio: ['tiposexercicio', 'exercicios', 'exercisestatus'],
            frequenciaTreinos: ['frequenciatreinos', 'frequenciatreino', 'workoutfrequency'],
            agua: ['agua', 'hidrata', 'water'],
            tempoObjetivos: ['tempoobjetivos', 'tempoobjetivo', 'goalstime'],
            dispostoMudanca: ['dispostomudanca', 'mudanca', 'readiness'],
            comentarios: ['comentarios', 'observacoes', 'comments']
        };

        const headers = rows[0].map(h => h.trim());
        const normalizedHeaders = headers.map(h => normalize(h));
        const emailIdx = normalizedHeaders.findIndex(h => fieldMap.email.some(f => h.includes(normalize(f))));
        if (emailIdx === -1) return res.json(null);

        const row = rows.find((r, i) => i > 0 && r[emailIdx] && r[emailIdx].toLowerCase() === email.toLowerCase());
        if (!row) return res.json(null);

        const headerToField = {};
        headers.forEach((h, idx) => {
            const norm = normalize(h);
            for (const [field, synonyms] of Object.entries(fieldMap)) {
                if (synonyms.some(s => norm.includes(normalize(s)))) {
                    headerToField[idx] = field;
                    return;
                }
            }
            headerToField[idx] = h;
        });

        const data = {};
        Object.entries(headerToField).forEach(([idx, field]) => {
            if (row[idx] !== undefined) data[field] = row[idx];
        });

        res.json(data);
    } catch (err) {
        console.error('Erro ao importar planilha:', err);
        res.status(500).json({ error: 'Erro ao importar planilha' });
    }
});

module.exports = router;
