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
    const { categoria, grupo, nome } = req.query;

    try {
        const personalSnap = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('exercicios').get();

        const globalSnap = await admin.firestore()
            .collection('exerciciosSistema').get();

        const pessoais = personalSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), global: false }));
        const globais = globalSnap.docs.map(doc => ({ id: doc.id, ...doc.data(), global: true }));

        let exercicios = [...globais, ...pessoais];

        if (categoria) {
            const cat = categoria.toLowerCase();
            exercicios = exercicios.filter(e => e.categoria && e.categoria.toLowerCase() === cat);
        }

        if (grupo) {
            const g = grupo.toLowerCase();
            exercicios = exercicios.filter(e => {
                const principal = (e.grupoMuscularPrincipal || '').toLowerCase();
                const outros = Array.isArray(e.gruposMusculares) ? e.gruposMusculares.map(x => x.toLowerCase()) : [];
                return principal === g || outros.includes(g);
            });
        }

        if (nome) {
            const n = nome.toLowerCase();
            exercicios = exercicios.filter(e => (e.nome || '').toLowerCase().includes(n));
        }

        res.json(exercicios);
    } catch (err) {
        console.error('Erro ao listar exercícios:', err);
        res.status(500).json({ error: 'Erro ao listar exercícios' });
    }
});

// Atualizar exercício
router.put('/exercicios/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const exercicioId = req.params.id;
    const isGlobal = req.query.global === 'true';
    const { nome, categoria, grupoMuscularPrincipal, gruposMusculares } = req.body;

    try {
        const userDoc = await admin.firestore().collection('users').doc(personalId).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        if (isGlobal && role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const docRef = isGlobal
            ? admin.firestore().collection('exerciciosSistema').doc(exercicioId)
            : admin.firestore().collection('users').doc(personalId).collection('exercicios').doc(exercicioId);

        const updateData = {};
        if (nome !== undefined) updateData.nome = nome;
        if (categoria !== undefined) updateData.categoria = categoria;
        if (grupoMuscularPrincipal !== undefined) updateData.grupoMuscularPrincipal = grupoMuscularPrincipal;
        if (gruposMusculares !== undefined) updateData.gruposMusculares = Array.isArray(gruposMusculares) ? gruposMusculares : [];

        await docRef.update(updateData);
        res.json({ message: 'Exercício atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar exercício:', err);
        res.status(500).json({ error: 'Erro ao atualizar exercício' });
    }
});

// Remover exercício
router.delete('/exercicios/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const exercicioId = req.params.id;
    const isGlobal = req.query.global === 'true';

    try {
        const userDoc = await admin.firestore().collection('users').doc(personalId).get();
        const role = userDoc.exists ? userDoc.data().role : 'personal';

        if (isGlobal && role !== 'admin') {
            return res.status(403).json({ error: 'Acesso negado' });
        }

        const docRef = isGlobal
            ? admin.firestore().collection('exerciciosSistema').doc(exercicioId)
            : admin.firestore().collection('users').doc(personalId).collection('exercicios').doc(exercicioId);

        await docRef.delete();
        res.json({ message: 'Exercício removido' });
    } catch (err) {
        console.error('Erro ao remover exercício:', err);
        res.status(500).json({ error: 'Erro ao remover exercício' });
    }
});

module.exports = router;
