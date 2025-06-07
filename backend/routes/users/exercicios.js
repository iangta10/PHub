const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Criar exercício personalizado
router.post('/exercicios', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { nome, categoria, grupoMuscularPrincipal, gruposMusculares } = req.body;

    if (!nome) {
        return res.status(400).json({ error: 'Nome é obrigatório' });
    }

    try {
        const userDoc = await admin.firestore().collection('users').doc(personalId).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        const collectionRef = role === 'admin'
            ? admin.firestore().collection('exerciciosSistema')
            : admin.firestore().collection('users').doc(personalId).collection('exercicios');

        const docRef = await collectionRef.add({
            nome,
            categoria: categoria || null,
            grupoMuscularPrincipal: grupoMuscularPrincipal || null,
            gruposMusculares: Array.isArray(gruposMusculares) ? gruposMusculares : [],
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
        const personalSnap = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('exercicios').get();

        const globalSnap = await admin.firestore()
            .collection('exerciciosSistema').get();

        const pessoais = personalSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), global: false }));
        const globais = globalSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), global: true }));

        res.json([...globais, ...pessoais]);
    } catch (err) {
        console.error('Erro ao listar exercícios:', err);
        res.status(500).json({ error: 'Erro ao listar exercícios' });
    }
});

module.exports = router;
