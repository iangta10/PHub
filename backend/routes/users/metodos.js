const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Criar método de treino
router.post('/metodos', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { nome, series, repeticoes } = req.body;

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
            series: series !== undefined ? Number(series) : null,
            repeticoes: repeticoes !== undefined ? Number(repeticoes) : null,
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

module.exports = router;
