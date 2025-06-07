const express = require('express');
const router = express.Router({ mergeParams: true });
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Criar treino para um aluno especifico (personal)
router.post('/alunos/:alunoId/treinos', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.alunoId;
    const { nome, dias } = req.body;

    try {
        const treinoRef = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('treinos')
            .add({
                nome: nome || 'Treino',
                dias: Array.isArray(dias) ? dias : [],
                criadoEm: new Date().toISOString()
            });

        res.status(201).json({ id: treinoRef.id });
    } catch (err) {
        console.error('Erro ao criar treino:', err);
        res.status(500).json({ error: 'Erro ao criar treino' });
    }
});

// Listar treinos de um aluno (personal)
router.get('/alunos/:alunoId/treinos', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.alunoId;

    try {
        const snapshot = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('treinos').get();

        const treinos = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.json(treinos);
    } catch (err) {
        console.error('Erro ao listar treinos:', err);
        res.status(500).json({ error: 'Erro ao listar treinos' });
    }
});

// Listar treinos do aluno logado
router.get('/me/treinos', verifyToken, async (req, res) => {
    const email = req.user.email;

    try {
        const alunoSnap = await admin.firestore()
            .collectionGroup('alunos')
            .where('email', '==', email)
            .limit(1)
            .get();

        if (alunoSnap.empty) {
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }

        const alunoDoc = alunoSnap.docs[0];
        const treinosSnap = await alunoDoc.ref.collection('treinos').get();
        const treinos = treinosSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

        res.json(treinos);
    } catch (err) {
        console.error('Erro ao obter treinos do aluno:', err);
        res.status(500).json({ error: 'Erro ao obter treinos' });
    }
});

module.exports = router;
