const express = require('express');
const router = express.Router();
const admin = require('../../firebase-admin');
const verifyToken = require('../../middleware/verifyToken');

// Criar aluno
router.post('/alunos', verifyToken, async (req, res) => {
    const { nome, email, observacoes, aulasPorSemana } = req.body;
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
                aulasPorSemana: aulasPorSemana || 2,
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

// Buscar dados de um aluno especifico
router.get('/alunos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;

    try {
        const doc = await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId)
            .get();

        if (!doc.exists) {
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }

        return res.status(200).json({ id: doc.id, ...doc.data() });
    } catch (err) {
        console.error('Erro ao buscar aluno:', err);
        res.status(500).json({ error: 'Erro ao buscar aluno' });
    }
});

// Atualizar dados de um aluno
router.put('/alunos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;
    const { nome, email, observacoes, aulasPorSemana } = req.body;

    try {
        const alunoRef = admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId);

        const updateData = {};
        if (nome !== undefined) updateData.nome = nome;
        if (email !== undefined) updateData.email = email;
        if (observacoes !== undefined) updateData.observacoes = observacoes;
        if (aulasPorSemana !== undefined) updateData.aulasPorSemana = aulasPorSemana;

        await alunoRef.update(updateData);
        res.status(200).json({ message: 'Aluno atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar aluno:', err);
        res.status(500).json({ error: 'Erro ao atualizar aluno' });
    }
});

// Definir plano de um aluno (após confirmação de pagamento)
router.post('/alunos/:id/plan', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;
    const { planId, aulasPorSemana } = req.body;

    if (!aulasPorSemana) {
        return res.status(400).json({ error: 'Dados incompletos' });
    }

    try {
        const alunoRef = admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId);
        await alunoRef.set({ planId: planId || null, aulasPorSemana }, { merge: true });
        res.json({ message: 'Plano definido' });
    } catch (err) {
        console.error('Erro ao definir plano:', err);
        res.status(500).json({ error: 'Erro ao definir plano' });
    }
});

// Remover aluno
router.delete('/alunos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.id;

    try {
        await admin.firestore()
            .collection('users')
            .doc(personalId)
            .collection('alunos')
            .doc(alunoId)
            .delete();

        res.status(200).json({ message: 'Aluno removido' });
    } catch (err) {
        console.error('Erro ao remover aluno:', err);
        res.status(500).json({ error: 'Erro ao remover aluno' });
    }
});

module.exports = router;
