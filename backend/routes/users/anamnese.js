const express = require('express');
const router = express.Router({ mergeParams: true });
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');
const path = require('path');

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
        const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS
            || path.join(__dirname, '..', '..', 'serviceAccountKey.json');
        const auth = new google.auth.GoogleAuth({
            keyFile,
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

        const columnToIndex = col => {
            let idx = 0;
            for (let i = 0; i < col.length; i++) {
                idx = idx * 26 + (col.toUpperCase().charCodeAt(i) - 64);
            }
            return idx - 1;
        };

        const columnMap = {
            B: 'email',
            C: 'nome',
            D: 'idade',
            E: 'genero',
            H: 'objetivos',
            I: 'doencas',
            J: 'doencasFamilia',
            K: 'medicamentos',
            L: 'cirurgias',
            M: 'doresLesoes',
            N: 'limitacoes',
            O: 'fuma',
            P: 'bebe',
            Q: 'qualidadeSono',
            R: 'horasSono',
            S: 'nivelAtividade',
            T: 'tiposExercicio',
            U: 'frequenciaTreinos',
            X: 'agua',
            AB: 'tempoObjetivos',
            AC: 'dispostoMudanca',
            AD: 'comentarios'
        };

        const fieldMap = {
            email: ['email', 'e-mail', 'mail'],
            nome: ['nome', 'nomecompleto', 'name'],
            idade: ['idade', 'age'],
            genero: ['g\u00eanero', 'sexo', 'gender'],
            altura: ['altura', 'height'],
            peso: ['peso', 'weight'],
            objetivos: ['objetivos', 'objetivo', 'goals'],
            doencas: ['doencas', 'doen\u00e7as', 'doenca', 'condicoes'],
            doencasFamilia: [
                'familiatemdoen\u00e7as',
                'doencasfamiliares',
                'historicofamiliar',
                'fam\u00edlia',
                'alguemdafamiliatemalgumadoenca',
                'doencafamilia'
            ],
            medicamentos: ['medicamentos', 'medicacao', 'remedios'],
            cirurgias: ['cirurgias', 'cirurgia', 'surgeries'],
            doresLesoes: ['doreslesoes', 'lesoes', 'dores', 'injuries'],
            limitacoes: ['limitacoes', 'limitação', 'limitations'],
            fuma: ['fuma', 'fumante', 'smoker'],
            bebe: ['bebe', 'alcool', 'bebida'],
            qualidadeSono: ['qualidadesono', 'qualidadedosono', 'sleepquality'],
            horasSono: ['horasdesono', 'tempodesono', 'sleephours', 'horasdesonopornoite'],
            nivelAtividade: [
                'nivelatividade',
                'atividadenivel',
                'activitylevel',
                'niveldeatividade',
                'nivelatividadefisica'
            ],
            tiposExercicio: [
                'tiposexercicio',
                'tiposdeexercicio',
                'exercicios',
                'exercisestatus'
            ],
            frequenciaTreinos: [
                'frequenciatreinos',
                'frequenciadetreinos',
                'frequenciatreino',
                'workoutfrequency'
            ],
            agua: ['agua', 'hidrata', 'water'],
            tempoObjetivos: [
                'tempoobjetivos',
                'tempoobjetivo',
                'quantotempo',
                'goalstime'
            ],
            dispostoMudanca: [
                'dispostomudanca',
                'dispostoamudar',
                'mudanca',
                'readiness'
            ],
            comentarios: ['comentarios', 'comentario', 'observacoes', 'observacao', 'comments']
        };

        const headers = rows[0].map(h => h.trim());
        const normalizedHeaders = headers.map(h => normalize(h));
        let emailIdx = normalizedHeaders.findIndex(h => fieldMap.email.some(f => h.includes(normalize(f))));
        if (emailIdx === -1) {
            const col = Object.entries(columnMap).find(([, field]) => field === 'email');
            if (col) {
                const idx = columnToIndex(col[0]);
                if (idx < headers.length) emailIdx = idx;
            }
        }
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
        for (const [col, field] of Object.entries(columnMap)) {
            const idx = columnToIndex(col);
            if (idx < headers.length) headerToField[idx] = field;
        }

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
