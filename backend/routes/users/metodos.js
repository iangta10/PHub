const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

function normalizeRepeticoes(value) {
    if (Array.isArray(value)) {
        return value
            .map(v => (v !== undefined && v !== null ? String(v).trim() : ''))
            .filter(v => v !== '');
    }
    if (value === null || value === undefined) {
        return [];
    }
    const str = String(value).trim();
    return str ? [str] : [];
}

function parseSeries(value) {
    if (value === undefined || value === null) return null;
    const str = String(value).trim();
    if (!str) return null;
    const num = Number(str);
    return Number.isNaN(num) ? null : num;
}

// Criar método de treino
router.post('/metodos', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { nome, series, repeticoes, observacoes } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    try {
        const userDoc = await admin.firestore().collection('users').doc(personalId).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        const collectionRef = role === 'admin'
            ? admin.firestore().collection('metodosSistema')
            : admin.firestore().collection('users').doc(personalId).collection('metodos');

        const docRef = await collectionRef.add({
            nome,
            series: parseSeries(series),
            repeticoes: normalizeRepeticoes(repeticoes),
            observacoes: observacoes || '',
            criadoEm: new Date().toISOString()
        });

        res.status(201).json({ id: docRef.id });
    } catch (err) {
        console.error('Erro ao criar método:', err);
        res.status(500).json({ error: 'Erro ao criar método' });
    }
});

// Listar métodos do personal
router.get('/metodos', verifyToken, async (req, res) => {
    const personalId = req.user.uid;

    try {
        const personalSnap = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('metodos').get();

        const globalSnap = await admin.firestore()
            .collection('metodosSistema').get();

        const pessoais = personalSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), global: false }));
        const globais = globalSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), global: true }));

        res.json([...globais, ...pessoais]);
    } catch (err) {
        console.error('Erro ao listar métodos:', err);
        res.status(500).json({ error: 'Erro ao listar métodos' });
    }
});

// Atualizar método
router.put('/metodos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const metodoId = req.params.id;
    const isGlobal = req.query.global === 'true';
    const { nome, series, repeticoes, observacoes } = req.body;

    try {
        const userDoc = await admin.firestore().collection('users').doc(personalId).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        if (isGlobal && role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const docRef = isGlobal
            ? admin.firestore().collection('metodosSistema').doc(metodoId)
            : admin.firestore().collection('users').doc(personalId).collection('metodos').doc(metodoId);

        const updateData = {};
        if (nome !== undefined) updateData.nome = nome;
        if (series !== undefined) updateData.series = parseSeries(series);
        if (repeticoes !== undefined) updateData.repeticoes = normalizeRepeticoes(repeticoes);
        if (observacoes !== undefined) updateData.observacoes = observacoes;

        await docRef.update(updateData);
        res.json({ message: 'Método atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar método:', err);
        res.status(500).json({ error: 'Erro ao atualizar método' });
    }
});

// Remover método
router.delete('/metodos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const metodoId = req.params.id;
    const isGlobal = req.query.global === 'true';

    try {
        const userDoc = await admin.firestore().collection('users').doc(personalId).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        if (isGlobal && role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const docRef = isGlobal
            ? admin.firestore().collection('metodosSistema').doc(metodoId)
            : admin.firestore().collection('users').doc(personalId).collection('metodos').doc(metodoId);

        await docRef.delete();
        res.json({ message: 'Método removido' });
    } catch (err) {
        console.error('Erro ao remover método:', err);
        res.status(500).json({ error: 'Erro ao remover método' });
    }
});

module.exports = router;
