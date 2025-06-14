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

// Atualizar treino de um aluno
router.put('/alunos/:alunoId/treinos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId, id } = req.params;
    const { nome, dias } = req.body;

    const updateData = {};
    if (nome !== undefined) updateData.nome = nome;
    if (dias !== undefined) updateData.dias = Array.isArray(dias) ? dias : [];

    try {
        const docRef = admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('treinos').doc(id);

        await docRef.update(updateData);
        res.json({ message: 'Treino atualizado' });
    } catch (err) {
        console.error('Erro ao atualizar treino:', err);
        res.status(500).json({ error: 'Erro ao atualizar treino' });
    }
});

// Remover treino de um aluno
router.delete('/alunos/:alunoId/treinos/:id', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const { alunoId, id } = req.params;

    try {
        await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('treinos').doc(id)
            .delete();

        res.json({ message: 'Treino removido' });
    } catch (err) {
        console.error('Erro ao remover treino:', err);
        res.status(500).json({ error: 'Erro ao remover treino' });
    }
});

// Listar treinos do aluno logado
router.get('/me/treinos', verifyToken, async (req, res) => {
    const email = req.user.email;

    try {
        const alunoSnap = await admin.firestore()
            .collectionGroup('alunos')
            .where('email', '==', email)
            .where('nome', '!=', null)
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

// Gerar treino automaticamente com IA para um aluno
router.post('/alunos/:alunoId/gerarTreinoIA', verifyToken, async (req, res) => {
    const personalId = req.user.uid;
    const alunoId = req.params.alunoId;

    try {
        const alunoDoc = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .get();

        if (!alunoDoc.exists) {
            return res.status(404).json({ error: 'Aluno não encontrado' });
        }

        const alunoData = alunoDoc.data();

        const prompt = `Gere um plano de treino em JSON considerando os dados a seguir:\n` +
            `Nome: ${alunoData.nome}\n` +
            `Idade: ${alunoData.idade}\n` +
            `Altura: ${alunoData.altura}\n` +
            `Peso: ${alunoData.peso}\n` +
            `Nivel: ${alunoData.nivel}\n` +
            `Objetivo: ${alunoData.objetivo}\n` +
            `Frequencia: ${alunoData.frequencia}`;

        const hfUrl = process.env.HF_ENDPOINT || '';
        const hfToken = process.env.HF_TOKEN || '';

        const hfResp = await fetch(hfUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                ...(hfToken ? { 'Authorization': `Bearer ${hfToken}` } : {})
            },
            body: JSON.stringify({ prompt })
        });

        if (!hfResp.ok) {
            return res.status(500).json({ error: 'Falha ao gerar treino via IA' });
        }

        const treinoIA = await hfResp.json();

        if (!treinoIA || !Array.isArray(treinoIA.dias)) {
            return res.status(400).json({ error: 'Resposta de IA inválida' });
        }

        const [globaisSnap, pessoaisSnap] = await Promise.all([
            admin.firestore().collection('exerciciosSistema').get(),
            admin.firestore().collection('users').doc(personalId).collection('exercicios').get()
        ]);

        const exerciciosValidos = new Set();
        globaisSnap.forEach(d => { if (d.data().nome) exerciciosValidos.add(d.data().nome); });
        pessoaisSnap.forEach(d => { if (d.data().nome) exerciciosValidos.add(d.data().nome); });

        const diasSalvos = [];

        treinoIA.dias.forEach(dia => {
            if (!Array.isArray(dia.exercicios)) return;
            const exs = [];
            dia.exercicios.forEach(ex => {
                if (exerciciosValidos.has(ex.nome)) {
                    exs.push({
                        nome: ex.nome,
                        series: ex.series || null,
                        repeticoes: ex.repeticoes || null
                    });
                } else {
                    console.warn(`Exercício não encontrado: ${ex.nome}`);
                }
            });
            if (exs.length) {
                diasSalvos.push({
                    nome: dia.dia || dia.nome || '',
                    grupo: dia.grupo || null,
                    exercicios: exs
                });
            }
        });

        const docRef = await admin.firestore()
            .collection('users').doc(personalId)
            .collection('alunos').doc(alunoId)
            .collection('treinos')
            .add({
                nome: `Treino IA - ${new Date().toLocaleDateString('pt-BR')}`,
                dias: diasSalvos,
                criadoEm: new Date().toISOString()
            });

        res.json({ id: docRef.id, dias: diasSalvos });
    } catch (err) {
        console.error('Erro ao gerar treino com IA:', err);
        res.status(500).json({ error: 'Erro ao gerar treino com IA' });
    }
});

module.exports = router;
