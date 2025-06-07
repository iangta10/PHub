const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Criar exercício personalizado
router.post('/exercicios', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { nome, categoria, seriesPadrao, repeticoesPadrao } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    try {
        const docRef = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('exercicios')
            .add({
                nome,
                categoria: categoria || null,
                seriesPadrao: seriesPadrao !== undefined ? Number(seriesPadrao) : null,
                repeticoesPadrao: repeticoesPadrao !== undefined ? Number(repeticoesPadrao) : null,
                criadoEm: new Date().toISOString()
            });

        res.status(201).json({ id: docRef.id });
    } catch (err) {
        console.error('Erro ao criar exercício:', err);
        res.status(500).json({ error: 'Erro ao criar exercício' });
    }
});

// Listar exercícios do personal
router.get('/exercicios', verifyToken, async (req, res) => {
    const personalId = req.user.uid;

    try {
        const snapshot = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('exercicios').get();

        const exercicios = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(exercicios);
    } catch (err) {
        console.error('Erro ao listar exercícios:', err);
        res.status(500).json({ error: 'Erro ao listar exercícios' });
    }
});

module.exports = router;
