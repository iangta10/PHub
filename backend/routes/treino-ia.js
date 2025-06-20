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
    const anamneseDoc = await admin.firestore()
      .collection('users').doc(personalId)
      .collection('alunos').doc(alunoId)
      .collection('anamnese').doc('respostas')
      .get();

    const alunoData = alunoDoc.data();
    const anamneseData = anamneseDoc.exists ? anamneseDoc.data() : {};

    const [globaisSnap, pessoaisSnap] = await Promise.all([
      admin.firestore().collection('exerciciosSistema').get(),
      admin.firestore().collection('users').doc(personalId).collection('exercicios').get()
    ]);

    const nomesExercicios = [];
    globaisSnap.forEach(d => { if (d.data().nome) nomesExercicios.push(d.data().nome); });
    pessoaisSnap.forEach(d => { if (d.data().nome) nomesExercicios.push(d.data().nome); });

    const treinoIA = await gerarTreinoIA({ ...alunoData, ...anamneseData }, nomesExercicios);

    if (!treinoIA || !Array.isArray(treinoIA.dias)) {
      return res.status(400).json({ error: 'Resposta de IA invalida' });
    }

    const exerciciosValidos = new Set(nomesExercicios);

    const diasProcessados = [];

    treinoIA.dias.forEach(dia => {
      if (!Array.isArray(dia.exercicios)) return;
      const exs = [];
      dia.exercicios.forEach(ex => {
        if (!ex.nome) return;
        exs.push({
          nome: ex.nome,
          series: ex.series || null,
          repeticoes: ex.repeticoes || null,
          invalido: exerciciosValidos.has(ex.nome) ? undefined : true
        });
      });
      if (exs.length) {
        diasProcessados.push({
          nome: dia.dia || dia.nome || '',
          grupo: dia.grupo || null,
          exercicios: exs
        });
      }
    });

    res.json({ dias: diasProcessados });
  } catch (err) {
    console.error('Erro ao gerar treino com IA:', err);
    res.status(500).json({ error: 'Erro ao gerar treino com IA' });
  }
});

module.exports = router;
