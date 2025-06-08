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

module.exports = router;
