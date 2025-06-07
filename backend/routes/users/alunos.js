const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Criar aluno
router.post('/alunos', verifyToken, async (req, res) => {
    const { nome, email, observacoes } = req.body;
    const personalId = req.user.uid;

    try {
        const docRef = await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .add({
                nome,
                email,
                observacoes,
                criadoEm: new Date().toISOString()
            });

        res.status(201).json({ id: docRef.id });
    } catch (err) {
        console.error("Erro ao criar aluno:", err);
        res.status(500).json({ error: "Erro ao criar aluno" });
    }
});

// Listar alunos
router.get('/alunos', verifyToken, async (req, res) => {
    const personalId = req.user.uid;

    try {
        const snapshot = await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .get();

        let alunos = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));

        const { nome } = req.query;
        if (nome) {
            const search = nome.toLowerCase();
            alunos = alunos.filter(aluno => aluno.nome && aluno.nome.toLowerCase().includes(search));
        }

        res.status(200).json(alunos);
    } catch (err) {
        console.error("Erro ao buscar alunos:", err);
        res.status(500).json({ error: "Erro ao buscar alunos" });
    }
});

module.exports = router;
