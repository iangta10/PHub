const express = require('express');
const router = express.Router();
const admin = require('../firebase-admin');
const verifyToken = require('../middleware/verifyToken');
const { gerarTreinoIA } = require('../iaService');

// Rota para gerar treino via IA
router.post('/gerar-ia', verifyToken, async (req, res) => {
  const personalId = req.user.uid;
  const { alunoId } = req.body;

  if (!alunoId) {
    return res.status(400).json({ error: 'alunoId não informado' });
  }

  try {
    const alunoDoc = await admin.firestore()
      .collection('users').doc(personalId)
      .collection('alunos').doc(alunoId)
      .get();

    if (!alunoDoc.exists) {
      return res.status(404).json({ error: 'Aluno não encontrado' });
    }

    const treino = await gerarTreinoIA(alunoDoc.data());
    res.json({ treino });
  } catch (err) {
    console.error('Erro ao gerar treino com IA:', err);
    res.status(500).json({ error: 'Erro ao gerar treino com IA' });
  }
});

module.exports = router;
